// Abertura: manchete, lide e os três números do topo, todos calculados dos dados.
import { P, IND as I, esgM, esgSC } from "./dados.js";
import { int, milReais } from "./formato.js";

export function abertura() {
  const pc = I.pib_pc;
  document.getElementById("manchete").innerHTML =
    "Mondaí produz mais riqueza por habitante que <em>" + int.format(pc.menor_sc - 1) + " das " + int.format(pc.total_sc) + "</em> cidades de Santa Catarina.";
  document.getElementById("lide").textContent =
    "Mas " + Math.round(esgM["Fossa rudimentar ou buraco"]) + " em cada 100 moradores ainda usam fossa rudimentar ou buraco para o esgoto, contra " +
    Math.round(esgSC["Fossa rudimentar ou buraco"]) + " no estado. Veja o que mais os números oficiais contam sobre a cidade, e como a sua se compara.";
  const numeros = [
    [int.format(I.pop2026.mondai), "habitantes, estimativa oficial de " + I.pop2026.ano],
    [milReais(pc.mondai), "de PIB por habitante em " + pc.ano + ", o " + pc.maior_sc + "º de SC"],
    [int.format(I.empresas.mondai), "empresas e organizações ativas em " + I.empresas.ano]
  ];
  document.getElementById("numerosTopo").innerHTML = numeros.map(([n, t]) => "<div><strong>" + n + "</strong><span>" + t + "</span></div>").join("");
  document.getElementById("selo").textContent = "Dados do IBGE e do Tesouro Nacional, baixados em " + P.gerado_em;
}
