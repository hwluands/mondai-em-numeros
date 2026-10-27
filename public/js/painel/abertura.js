// Abertura: manchete, lide, ranking das 295 cidades e ficha do topo, todos calculados dos dados.
import { P, IND as I } from "./dados.js";
import { int, d1, reais, milReais } from "./formato.js";
import { ranking } from "./ranking.js";

export function abertura() {
  const pc = I.pib_pc, sal = I.salario_rs;
  document.getElementById("manchete").innerHTML =
    'Mondaí é a <span class="m">' + pc.maior_sc + "ª</span> cidade mais rica de Santa Catarina por habitante, e a " + pc.maior_regiao + "ª da região.";
  // O outro lado: riqueza produzida não é o mesmo que salário.
  const perto = Math.abs(sal.mondai - sal.mediana_sc) / sal.mediana_sc < 0.1;
  document.getElementById("lide").textContent =
    "Em " + pc.ano + ", a economia produziu " + reais(pc.mondai) + " por morador, " + d1.format(pc.mondai / pc.mediana_sc) + " vezes a mediana do estado. " +
    "Isso mede o que é produzido, não o que cada pessoa ganha: o salário médio de quem trabalha em empresas, " + reais(sal.mondai) + " em " + sal.ano + ", fica " +
    (perto ? "perto da" : sal.mondai < sal.mediana_sc ? "abaixo da" : "acima da") + " mediana catarinense, de " + reais(sal.mediana_sc) + ".";
  document.getElementById("faixaAbertura").innerHTML =
    '<figcaption class="ranking-titulo"><b>PIB por habitante, ' + pc.ano + ".</b> As " + pc.total_sc + " cidades de SC, da maior para a menor.</figcaption>" +
    ranking("pib_pc", { altura: 110, rotulo: "PIB por habitante das " + pc.total_sc + " cidades de SC; Mondaí é a " + pc.maior_sc + "ª" });
  const numeros = [
    [int.format(I.pop2026.mondai), "habitantes, estimativa oficial de " + I.pop2026.ano],
    [milReais(pc.mondai), "de PIB por habitante em " + pc.ano],
    [int.format(I.empresas.mondai), "empresas e organizações ativas em " + I.empresas.ano]
  ];
  document.getElementById("numerosTopo").innerHTML = numeros.map(([n, t]) => "<div><dt>" + t + "</dt><dd>" + n + "</dd></div>").join("");
  document.getElementById("selo").textContent = "Dados do IBGE e do Tesouro Nacional, baixados em " + P.gerado_em;
}
