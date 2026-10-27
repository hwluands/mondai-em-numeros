// Protótipo: abertura e primeira história, com os mesmos dados e formatação do painel.
import { P, IND as I, MUN } from "./painel/dados.js";
import { int, reais, milReais } from "./painel/formato.js";

// Ranking de 295 traços, do maior para o menor, com Mondaí em destaque. Escala linear até o 98º percentil;
// as poucas cidades acima dele ficam cortadas no topo, para não achatarem as outras. Os rótulos são HTML
// posicionados em %, para continuarem legíveis no celular.
function faixa(chave, { altura = 90, rotulo }) {
  const cidades = Object.entries(MUN).filter(([, m]) => m[chave] > 0).sort((a, b) => b[1][chave] - a[1][chave]);
  const vals = cidades.map(([, m]) => m[chave]);
  const n = cidades.length;
  const teto = vals[Math.floor(n * 0.02)];
  const h = v => Math.max(1.5, Math.min(v, teto) / teto * 100);
  const iM = cidades.findIndex(([id]) => id === P.mondai);
  const iMed = Math.floor(n / 2);
  const pct = i => (i + 0.5) / n * 100;

  let barras = "";
  cidades.forEach(([id], i) => {
    const y = 100 - h(vals[i]);
    barras += `<rect x="${i}" y="${y}" width="0.72" height="${100 - y}" fill="var(${id === P.mondai ? "--mondai" : "--cidade"})"/>`;
    if (vals[i] > teto) barras += `<rect x="${i}" y="0" width="0.72" height="1.2" fill="var(--fundo)"/>`;
  });
  const ladoDireito = iM < n * 0.7;
  return `<div class="ranking" style="--altura:${altura}px" role="img" aria-label="${rotulo}">
    <svg viewBox="0 0 ${n} 100" preserveAspectRatio="none" aria-hidden="true">${barras}</svg>
    <span class="marca-mediana ${iM > iMed && iM - iMed < n * 0.35 ? "esquerda" : ""}" style="left:${pct(iMed)}%"><span>mediana de SC</span></span>
    <span class="marca-mondai ${ladoDireito ? "" : "esquerda"}" style="left:${pct(iM)}%; --topo:${100 - h(vals[iM])}%"><span>Mondaí, ${iM + 1}º</span></span>
    <span class="eixo"><span>1º</span><span>${n}º</span></span>
  </div>`;
}

const pc = I.pib_pc, sal = I.salario_rs;
const vezes = pc.mondai / pc.mediana_sc;

document.getElementById("edicao").textContent = "Dados do IBGE e do Tesouro Nacional · atualizados em " + P.gerado_em;

document.getElementById("manchete").innerHTML =
  `Mondaí é a <span class="m">${pc.maior_sc}ª</span> cidade mais rica de Santa Catarina por habitante. No salário, é a ${sal.maior_sc}ª.`;
document.getElementById("lide").textContent =
  `Em ${pc.ano}, a economia produziu ${reais(pc.mondai)} por morador, ${vezes.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} vezes a mediana do estado. ` +
  `Mas o salário médio de quem trabalha em empresas, ${reais(sal.mondai)} em ${sal.ano}, ficou abaixo da mediana catarinense, de ${reais(sal.mediana_sc)}.`;

document.getElementById("faixaAbertura").innerHTML =
  `<p class="faixa-titulo"><b>PIB por habitante, ${pc.ano}.</b> As ${pc.total_sc} cidades de SC, da maior para a menor.</p>` +
  faixa("pib_pc", { altura: 110, rotulo: `PIB por habitante das ${pc.total_sc} cidades de SC; Mondaí é a ${pc.maior_sc}ª` });

document.getElementById("ficha").innerHTML = [
  [int.format(I.pop2026.mondai), `habitantes, estimativa de ${I.pop2026.ano}`],
  [milReais(pc.mondai), `de PIB por habitante em ${pc.ano}`],
  [int.format(I.empresas.mondai), `empresas e organizações em ${I.empresas.ano}`]
].map(([n, t]) => `<div><dd>${n}</dd><dt>${t}</dt></div>`).join("");

// Distância entre a posição no salário e a posição no PIB por habitante, cidade a cidade.
const rank = chave => {
  const ids = Object.keys(MUN).filter(id => MUN[id].pib_pc && MUN[id].salario_rs).sort((a, b) => MUN[b][chave] - MUN[a][chave]);
  return Object.fromEntries(ids.map((id, i) => [id, i + 1]));
};
const rPib = rank("pib_pc"), rSal = rank("salario_rs");
const distancias = Object.keys(rPib).map(id => rSal[id] - rPib[id]).sort((a, b) => b - a);
const posDistancia = distancias.indexOf(rSal[P.mondai] - rPib[P.mondai]) + 1;

document.getElementById("h1-t").textContent = "A riqueza fica entre as primeiras do estado. O salário, no meio da fila.";
document.getElementById("h1-p").textContent =
  `O PIB por habitante divide pela população tudo o que é produzido na cidade, incluindo o valor gerado pelas agroindústrias. ` +
  `O salário médio mostra quanto recebe, em média, quem trabalha em empresas e organizações. Em Mondaí, a diferença entre as duas posições ` +
  `(${pc.maior_sc}º e ${sal.maior_sc}º) é a ${posDistancia}ª maior entre as ${distancias.length} cidades de SC.`;

document.getElementById("fig1").innerHTML =
  `<div class="linha-ranking"><p class="faixa-titulo"><b>PIB por habitante, ${pc.ano}</b></p>${faixa("pib_pc", { altura: 70, rotulo: `PIB por habitante: Mondaí é a ${pc.maior_sc}ª de ${pc.total_sc}` })}</div>` +
  `<div class="linha-ranking"><p class="faixa-titulo"><b>Salário médio mensal, ${sal.ano}</b></p>${faixa("salario_rs", { altura: 70, rotulo: `Salário médio: Mondaí é a ${sal.maior_sc}ª de ${sal.total_sc}` })}</div>`;
