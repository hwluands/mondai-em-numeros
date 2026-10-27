// Testes da formatação do painel e da integridade dos dados gerados pelo pipeline.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const texto = readFileSync(new URL("../public/dados/painel.js", import.meta.url), "utf8");
globalThis.window = { PAINEL: JSON.parse(texto.slice(texto.indexOf("=") + 1).trim().replace(/;$/, "")) };
const { P, IND, MUN } = await import("../public/js/painel/dados.js");
const { posicao, percentil, fmt, reais, mediana } = await import("../public/js/painel/formato.js");

test("dados: 295 cidades de SC e Mondaí presente", () => {
  assert.equal(Object.keys(MUN).length, 295);
  assert.equal(MUN[P.mondai].nome, "Mondaí");
  assert.ok(P.vizinhos.every(id => MUN[id]), "toda vizinha existe na tabela");
});

test("dados: todo indicador tem rótulo, ano, valor de Mondaí e posição coerente", () => {
  for (const [chave, i] of Object.entries(IND)) {
    assert.ok(i.rotulo && i.ano, chave);
    if (i.mondai === null) continue;
    assert.ok(i.maior_sc >= 1 && i.maior_sc <= i.total_sc, chave + ": posição dentro do total");
  }
});

test("posicao: metade de cima diz maior, de baixo diz menor", () => {
  assert.equal(posicao({ maior_sc: 1, menor_sc: 295 }, "sc"), "maior");
  assert.equal(posicao({ maior_sc: 8, menor_sc: 288 }, "sc"), "8º maior");
  assert.equal(posicao({ maior_sc: 290, menor_sc: 6 }, "sc"), "6º menor");
  assert.equal(posicao({ maior_sc: 295, menor_sc: 1 }, "sc"), "menor");
  assert.equal(posicao({}, "sc"), "");
});

test("percentil vai de 0 (menor de SC) a 100 (maior)", () => {
  const vals = Object.values(MUN).map(m => m.pop2026).filter(v => v !== null);
  assert.equal(percentil("pop2026", Math.min(...vals)), 0);
  assert.equal(percentil("pop2026", Math.max(...vals)), 100);
  assert.equal(percentil("pop2026", null), null);
});

test("formatação em português", () => {
  assert.equal(reais(1250000000), "R$ 1,25 bi");
  assert.equal(reais(3036), "R$ 3.036");
  assert.equal(fmt("esgoto_adequado", 73.78), "73,8%");
  assert.equal(fmt("pib_pc", null), "sem dado");
  assert.equal(mediana([3, null, 1, 2]), 2);
  assert.equal(mediana([4, 1, 2, 3]), 2.5);
});
