// Ranking das cidades de SC em traços, do maior para o menor valor, com Mondaí em destaque.
// Escala linear até o 98º percentil: as poucas cidades acima dele ficam cortadas no topo, para não
// achatarem as outras. Os rótulos são HTML posicionados em %, para continuarem legíveis no celular.
import { P, MUN } from "./dados.js";

export function ranking(chave, { altura = 90, rotulo, mini = false }) {
  const cidades = Object.entries(MUN).filter(([, m]) => m[chave] !== null && m[chave] !== undefined).sort((a, b) => b[1][chave] - a[1][chave]);
  const vals = cidades.map(([, m]) => m[chave]);
  const n = cidades.length;
  const piso = Math.min(0, vals[n - 1]);
  const teto = vals[Math.floor(n * 0.02)];
  const h = v => Math.max(1.5, (Math.min(v, teto) - piso) / (teto - piso) * 100);
  const iM = cidades.findIndex(([id]) => id === P.mondai);
  const iMed = Math.floor(n / 2);
  const pct = i => (i + 0.5) / n * 100;

  let barras = "";
  cidades.forEach(([id], i) => {
    const y = 100 - h(vals[i]);
    barras += `<rect class="${id === P.mondai ? "barra-mondai" : "barra-cidade"}" x="${i}" y="${y}" width="0.72" height="${100 - y}"/>`;
    if (vals[i] > teto) barras += `<rect class="corte" x="${i}" y="0" width="0.72" height="1.2"/>`;
  });
  const medEsquerda = iM > iMed && iM - iMed < n * 0.35;
  return `<div class="ranking${mini ? " mini" : ""}" style="--altura:${altura}px" role="img" aria-label="${rotulo}">
    <svg viewBox="0 0 ${n} 100" preserveAspectRatio="none" aria-hidden="true">${barras}</svg>
    <span class="marca-mediana${medEsquerda ? " esquerda" : ""}" style="left:${pct(iMed)}%"><span>mediana de SC</span></span>
    ${iM < 0 ? "" : `<span class="marca-mondai${iM < n * 0.7 ? "" : " esquerda"}" style="left:${pct(iM)}%; --topo:${100 - h(vals[iM])}%"><span>Mondaí, ${iM + 1}º</span></span>`}
    ${mini ? "" : `<span class="eixo"><span>1º</span><span>${n}º</span></span>`}
  </div>`;
}
