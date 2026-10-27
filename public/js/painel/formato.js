// Formatação de números, posições no ranking e tabelas.
import { IND, MUN } from "./dados.js";

const nf = (min, max) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: min, maximumFractionDigits: max });
export const int = nf(0, 0), d1 = nf(1, 1), d2 = nf(2, 2);

export function reais(v) {
  const a = Math.abs(v);
  if (a >= 1e9) return "R$ " + d2.format(v / 1e9) + " bi";
  if (a >= 1e6) return "R$ " + d1.format(v / 1e6) + " mi";
  return "R$ " + int.format(v);
}
export const milReais = v => "R$ " + int.format(Math.round(v / 1000)) + " mil";

export function fmt(chave, v) {
  if (v === null || v === undefined) return "sem dado";
  const u = IND[chave] ? IND[chave].unidade : chave;
  switch (u) {
    case "mil R$": return reais(v * 1000);
    case "R$": return reais(v);
    case "%": return d1.format(v) + "%";
    case "% ao ano": return (v > 0 ? "+" : "") + d2.format(v) + "% ao ano";
    case "salários mínimos": return d1.format(v) + " sal. mín.";
    case "hab/km²": return d1.format(v) + " hab/km²";
    case "km²": return int.format(v) + " km²";
    case "anos": return int.format(v) + " anos";
    case "mil litros": return v >= 1000 ? d1.format(v / 1000) + " mi de litros" : int.format(v) + " mil litros";
    case "litros": return int.format(v) + " litros";
    case "cabeças": return v < 100 ? d1.format(v) : int.format(v);
    case "por mil": case "por 100": case "índice": return d1.format(v);
    default: return int.format(v);
  }
}

// "8º maior" na metade de cima do ranking, "12º menor" na de baixo. Empates contam a favor.
export function posicao(i, escopo) {
  const maior = i["maior_" + escopo], menor = i["menor_" + escopo];
  if (!maior) return "";
  if (maior <= menor) return maior === 1 ? "maior" : maior + "º maior";
  return menor === 1 ? "menor" : menor + "º menor";
}

// Posição relativa entre as cidades de SC: 0 = menor valor, 100 = maior.
export function percentil(chave, v) {
  const vals = Object.values(MUN).map(m => m[chave]).filter(x => x !== null && x !== undefined);
  if (v === null || v === undefined || vals.length < 2) return null;
  return vals.filter(x => x < v).length / (vals.length - 1) * 100;
}

export const mediana = arr => {
  const a = arr.filter(x => x !== null && x !== undefined).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

export function tabelaHtml(cabecalho, linhas, destacar) {
  let h = "<table><thead><tr>" + cabecalho.map((c, j) => "<th" + (j ? ' class="n"' : "") + ">" + c + "</th>").join("") + "</tr></thead><tbody>";
  linhas.forEach(l => {
    h += "<tr" + (destacar && destacar(l) ? ' class="destaque"' : "") + ">" +
      l.map((c, j) => "<td" + (j ? ' class="n"' : "") + ">" + c + "</td>").join("") + "</tr>";
  });
  return h + "</tbody></table>";
}
