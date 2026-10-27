// Testes da formatação do painel e da integridade dos dados gerados pelo pipeline.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const texto = readFileSync(new URL("../public/dados/painel.js", import.meta.url), "utf8");
globalThis.window = { PAINEL: JSON.parse(texto.slice(texto.indexOf("=") + 1).trim().replace(/;$/, "")) };
const { P, IND, MUN, S, esgSC, precario } = await import("../public/js/painel/dados.js");
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

// Algumas frases das histórias (historias.js) e a prévia do link (index.html) são escritas à mão,
// não calculadas. Se uma atualização dos dados as contradisser, o teste falha antes de publicar.
test("frases fixas das histórias e da prévia do link continuam verdadeiras", () => {
  const sal = IND.salario_rs;
  assert.ok(Math.abs(sal.mondai - sal.mediana_sc) / sal.mediana_sc < 0.1, "história 1: salário perto da mediana do estado");

  const entreOsMaiores = i => i.maior_sc <= i.total_sc * 0.15;
  assert.ok(entreOsMaiores(IND.suinos) && entreOsMaiores(IND.leite), "história 3: rebanhos e leite entre os maiores de SC");
  assert.ok(IND.pct_ind.mondai > IND.pct_agro.mondai, "história 3: a indústria pesa mais que a agropecuária");

  const media = (a, k) => a.reduce((s, x) => s + x[k], 0) / a.length;
  const ini = S.vitais.slice(0, 3), fim = S.vitais.slice(-3);
  assert.ok(Math.abs(media(fim, "nascimentos") / media(ini, "nascimentos") - 1) < 0.1, "história 4: os nascimentos se mantiveram");
  assert.ok(media(fim, "obitos") > media(ini, "obitos"), "história 4: os óbitos aumentaram");
  const saldo = a => media(a, "nascimentos") - media(a, "obitos");
  assert.ok(saldo(fim) < 0 || saldo(fim) < saldo(ini), "história 4: a diferença diminuiu");
  assert.ok(IND.envelhecimento.mondai < IND.envelhecimento.mediana_regiao, "história 4: envelhece menos que a região");

  assert.ok(IND.esgoto_adequado.mondai < 100 - precario(esgSC), "história 5: esgoto adequado abaixo de SC");

  const desp = Object.values(P.prefeitura.mondai).reduce((s, v) => s + v, 0);
  const eduSaude = (P.prefeitura.mondai["Educação"] + P.prefeitura.mondai["Saúde"]) / desp;
  assert.ok(eduSaude >= 0.45 && eduSaude < 0.5, "história 7: de cada R$ 10, quase R$ 5 para educação e saúde");

  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const previa = html.match(/og:description" content="([^"]+)"/)[1];
  assert.ok(previa.includes(`a ${IND.pib_pc.maior_sc}ª cidade mais rica de SC`), "prévia do link: posição em SC");
  assert.ok(previa.includes(`a ${IND.pib_pc.maior_regiao}ª da região`), "prévia do link: posição na região");
});
