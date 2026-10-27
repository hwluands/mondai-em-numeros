// Testes da API (functions/api) com um banco D1 de mentira em memória.
import { test } from "node:test";
import assert from "node:assert/strict";
import { timingSafeEqual } from "node:crypto";
import { onRequestPost, validar, LIMITE as LIMITE_REGISTRO } from "../functions/api/registro.js";
import { onRequestGet as listar, csv } from "../functions/api/registros.js";
import { bloqueado, contar } from "../lib/limite.js";

// crypto.subtle.timingSafeEqual é uma extensão do runtime da Cloudflare; no Node, usa a equivalente.
crypto.subtle.timingSafeEqual ??= (a, b) => timingSafeEqual(Buffer.from(a), Buffer.from(b));

const SITE = "https://mondai-em-numeros.pages.dev";
const VISITANTE = "3f2b8c1e-9a4d-4e7f-b1c2-0d9e8f7a6b5c";

// Guarda os INSERT em registros e simula a tabela de tentativas do limite.
function bancoFalso(linhas = []) {
  const gravados = [];
  const tentativas = [];
  const executar = (sql, valores) => {
    if (sql.startsWith("INSERT INTO tentativas")) tentativas.push({ chave: valores[0], criado_em: valores[1] });
    else if (sql.startsWith("DELETE FROM tentativas")) tentativas.splice(0, Infinity, ...tentativas.filter(t => t.criado_em >= valores[0]));
    else gravados.push({ sql, valores });
  };
  return {
    gravados,
    tentativas,
    prepare: sql => ({
      bind: (...valores) => ({
        sql, valores,
        run: async () => executar(sql, valores),
        first: async () => {
          const achadas = tentativas.filter(t => t.chave === valores[0] && t.criado_em > valores[1]);
          return { n: achadas.length, primeira: achadas.length ? Math.min(...achadas.map(t => t.criado_em)) : null };
        },
      }),
      all: async () => ({ results: linhas }),
    }),
    batch: async comandos => { comandos.forEach(c => executar(c.sql, c.valores)); },
  };
}

const post = (corpo, cabecalhos = {}) => new Request(SITE + "/api/registro", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: SITE, ...cabecalhos },
  body: JSON.stringify(corpo),
});

test("grava um acesso válido", async () => {
  const DB = bancoFalso();
  const r = await onRequestPost({ request: post({ tipo: "acesso", visitante: VISITANTE, nome: "  Ana   Paula ", cidade: "Mondaí" }), env: { DB } });
  assert.equal(r.status, 201);
  assert.deepEqual(DB.gravados[0].valores, ["acesso", VISITANTE, "Ana Paula", "Mondaí", null, null]);
});

test("recusa envio de outro site e envio sem Origin", async () => {
  const DB = bancoFalso();
  const corpo = { tipo: "acesso", visitante: VISITANTE };
  assert.equal((await onRequestPost({ request: post(corpo, { Origin: "https://outro.site" }), env: { DB } })).status, 403);
  const semOrigem = new Request(SITE + "/api/registro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  assert.equal((await onRequestPost({ request: semOrigem, env: { DB } })).status, 403);
  assert.equal(DB.gravados.length, 0);
});

test("recusa corpo que não é JSON", async () => {
  const r = await onRequestPost({ request: post({}, { "Content-Type": "text/plain" }), env: { DB: bancoFalso() } });
  assert.equal(r.status, 415);
});

test("recusa corpo grande demais mesmo sem Content-Length", async () => {
  const DB = bancoFalso();
  const r = await onRequestPost({ request: post({ tipo: "acesso", visitante: VISITANTE, sobra: "x".repeat(5000) }), env: { DB } });
  assert.equal(r.status, 413);
  assert.equal(DB.gravados.length, 0);
});

test("validar: campos inválidos", () => {
  assert.throws(() => validar({ tipo: "outro", visitante: VISITANTE }), /tipo/);
  assert.throws(() => validar({ tipo: "acesso", visitante: "123" }), /visitante/);
  assert.throws(() => validar({ tipo: "opiniao", visitante: VISITANTE }), /sem nota/);
  assert.throws(() => validar({ tipo: "opiniao", visitante: VISITANTE, nota: 6 }), /1 a 5/);
  assert.throws(() => validar({ tipo: "acesso", visitante: VISITANTE, nome: "x".repeat(81) }), /80/);
  assert.throws(() => validar({ tipo: "acesso", visitante: VISITANTE, nome: 42 }), /texto/);
});

test("validar: nota e comentário só valem para opinião", () => {
  const r = validar({ tipo: "acesso", visitante: VISITANTE, nota: 5, comentario: "oi" });
  assert.equal(r.nota, null);
  assert.equal(r.comentario, null);
  assert.equal(validar({ tipo: "opiniao", visitante: VISITANTE, nota: "4" }).nota, 4);
});

test("registros: exige a senha", async () => {
  const pedir = senha => new Request(SITE + "/api/registros", { headers: senha ? { Authorization: "Bearer " + senha } : {} });
  const env = { DB: bancoFalso([]), ADMIN_TOKEN: "senha-certa" };
  assert.equal((await listar({ request: pedir(), env })).status, 401);
  assert.equal((await listar({ request: pedir("errada"), env })).status, 401);
  assert.equal((await listar({ request: pedir("senha-certa"), env })).status, 200);
  assert.equal((await listar({ request: pedir("qualquer"), env: { DB: bancoFalso([]) } })).status, 401, "sem ADMIN_TOKEN configurado, ninguém entra");
});

test("registros: bloqueia o IP depois de 5 senhas erradas", async () => {
  const pedir = (senha, ip = "200.1.1.1") => new Request(SITE + "/api/registros", { headers: { Authorization: "Bearer " + senha, "CF-Connecting-IP": ip } });
  const env = { DB: bancoFalso([]), ADMIN_TOKEN: "senha-certa" };
  for (let i = 0; i < 5; i++) assert.equal((await listar({ request: pedir("errada"), env })).status, 401);
  const r = await listar({ request: pedir("senha-certa"), env });
  assert.equal(r.status, 429, "bloqueado mesmo acertando a senha");
  assert.ok(Number(r.headers.get("Retry-After")) > 0);
  assert.equal((await listar({ request: pedir("senha-certa", "200.2.2.2"), env })).status, 200, "outro IP continua entrando");
  assert.ok(env.DB.tentativas.every(t => !t.chave.includes("200.1.1.1")), "o IP não é gravado");
});

test("registro: limita envios por IP", async () => {
  const DB = bancoFalso();
  const corpo = { tipo: "acesso", visitante: VISITANTE };
  for (let i = 0; i < LIMITE_REGISTRO.maximo; i++) assert.equal((await onRequestPost({ request: post(corpo), env: { DB } })).status, 201);
  assert.equal((await onRequestPost({ request: post(corpo), env: { DB } })).status, 429);
  assert.equal(DB.gravados.length, LIMITE_REGISTRO.maximo);
});

test("limite: libera depois da janela e não derruba o site se o banco falhar", async () => {
  const pedido = new Request(SITE, { headers: { "CF-Connecting-IP": "200.3.3.3" } });
  const env = { DB: bancoFalso(), ADMIN_TOKEN: "x" };
  const regra = { maximo: 2, janela: 60 };
  const t0 = Date.UTC(2026, 9, 27, 12);
  await contar(pedido, env, "teste", t0);
  await contar(pedido, env, "teste", t0);
  assert.equal(await bloqueado(pedido, env, "teste", regra, t0 + 10_000), 50);
  assert.equal(await bloqueado(pedido, env, "teste", regra, t0 + 61_000), 0);
  const quebrado = { prepare: () => { throw new Error("sem tabela"); }, batch: async () => { throw new Error("sem tabela"); } };
  assert.equal(await bloqueado(pedido, { DB: quebrado }, "teste", regra), 0);
  await contar(pedido, { DB: quebrado }, "teste");
});

test("csv: data em Brasília, aspas e fórmulas neutralizadas", () => {
  const saida = csv([{ id: 1, criado_em: "2026-10-27T15:04:05Z", tipo: "opiniao", nome: "=HYPERLINK(\"x\")", cidade: "Mondaí", nota: 5, comentario: "bom; muito", visitante: VISITANTE }]);
  const linha = saida.split("\n")[1];
  assert.match(linha, /^1;27\/10\/2026 12:04:05;opiniao;/);
  assert.match(linha, /;"'=HYPERLINK\(""x""\)";/);
  assert.match(linha, /;"bom; muito";/);
});
