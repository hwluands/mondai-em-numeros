// POST /api/registro: grava um acesso, retorno ou opinião vindo do painel.
import { bloqueado, contar, muitasTentativas } from "../../lib/limite.js";

// Folga para uma turma inteira na mesma rede: cada visita manda dois ou três registros.
export const LIMITE = { maximo: 60, janela: 10 * 60 };

const TIPOS = new Set(["acesso", "retorno", "opiniao"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function resposta(corpo, status) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function texto(valor, maximo) {
  if (valor === undefined || valor === null || valor === "") return null;
  if (typeof valor !== "string") throw new Error("campo de texto inválido");
  const limpo = valor.replace(/\s+/g, " ").trim();
  if (limpo.length > maximo) throw new Error(`texto com mais de ${maximo} caracteres`);
  return limpo || null;
}

function mesmoSite(origem, url) {
  try { return new URL(origem).host === new URL(url).host; } catch { return false; }
}

export function validar(corpo) {
  if (!corpo || typeof corpo !== "object") throw new Error("corpo vazio");
  if (!TIPOS.has(corpo.tipo)) throw new Error("tipo inválido");
  if (typeof corpo.visitante !== "string" || !UUID.test(corpo.visitante)) throw new Error("visitante inválido");

  const nota = corpo.nota === undefined || corpo.nota === null || corpo.nota === "" ? null : Number(corpo.nota);
  if (nota !== null && !(Number.isInteger(nota) && nota >= 1 && nota <= 5)) throw new Error("nota deve ser de 1 a 5");
  if (corpo.tipo === "opiniao" && nota === null) throw new Error("opinião sem nota");

  return {
    tipo: corpo.tipo,
    visitante: corpo.visitante,
    nome: texto(corpo.nome, 80),
    cidade: texto(corpo.cidade, 80),
    nota: corpo.tipo === "opiniao" ? nota : null,
    comentario: corpo.tipo === "opiniao" ? texto(corpo.comentario, 500) : null,
  };
}

export async function onRequestPost({ request, env }) {
  // Só aceita envios feitos pelo próprio site. Navegadores sempre mandam Origin num POST com fetch.
  // Não impede quem forja o cabeçalho de propósito, mas barra robôs e envios casuais de fora do site.
  if (!mesmoSite(request.headers.get("Origin"), request.url)) {
    return resposta({ erro: "origem não permitida" }, 403);
  }
  const espera = await bloqueado(request, env, "registro", LIMITE);
  if (espera) return muitasTentativas(espera);
  await contar(request, env, "registro");
  if (!(request.headers.get("Content-Type") || "").includes("application/json")) {
    return resposta({ erro: "envie JSON" }, 415);
  }
  if (Number(request.headers.get("Content-Length") || 0) > 4096) {
    return resposta({ erro: "registro grande demais" }, 413);
  }

  let registro;
  try {
    registro = validar(await request.json());
  } catch (erro) {
    return resposta({ erro: erro.message }, 400);
  }

  await env.DB.prepare(
    "INSERT INTO registros (tipo, visitante, nome, cidade, nota, comentario) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(registro.tipo, registro.visitante, registro.nome, registro.cidade, registro.nota, registro.comentario).run();

  return resposta({ ok: true }, 201);
}
