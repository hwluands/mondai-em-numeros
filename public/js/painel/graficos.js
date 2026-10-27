// Base dos gráficos: plugins do Chart.js, opções comuns e os tipos de gráfico reaproveitados.
import { S } from "./dados.js";
import { d1, tabelaHtml } from "./formato.js";

export function cor(n) { return getComputedStyle(document.body).getPropertyValue("--" + n).trim(); }

// Opções originais do plugin. As resolvidas pelo Chart.js chamariam "formatar" como opção calculada.
const opcaoBruta = (chart, id) => ((chart.config.options || {}).plugins || {})[id];

// Rótulos de valor escritos na ponta das barras, para não depender de legenda.
const pluginRotulos = {
  id: "rotulos",
  afterDatasetsDraw(chart) {
    const op = opcaoBruta(chart, "rotulos");
    if (!op || !op.formatar) return;
    const { ctx } = chart;
    const horizontal = chart.options.indexAxis === "y";
    ctx.save();
    ctx.font = "600 12px " + getComputedStyle(document.body).fontFamily;
    ctx.fillStyle = cor("tinta");
    chart.data.datasets.forEach((ds, di) => {
      const meta = chart.getDatasetMeta(di);
      if (meta.hidden || ds.semRotulo) return;
      meta.data.forEach((el, i) => {
        const v = ds.data[i];
        if (v === null || v === undefined) return;
        const t = op.formatar(v, i, di);
        const x = horizontal ? el.x + 6 : el.x, y = horizontal ? el.y : el.y - 4;
        const w = ctx.measureText(t).width;
        // Fundo da cor do cartão atrás do texto, para linhas de referência e grade não o encobrirem.
        ctx.fillStyle = cor("papel");
        if (horizontal) ctx.fillRect(x - 3, y - 9, w + 6, 18);
        else ctx.fillRect(x - w / 2 - 3, y - 16, w + 6, 16);
        ctx.fillStyle = cor("tinta");
        ctx.textAlign = horizontal ? "left" : "center";
        ctx.textBaseline = horizontal ? "middle" : "bottom";
        ctx.fillText(t, x, y);
      });
    });
    ctx.restore();
  }
};

// Linha vertical de referência (ex.: mediana de SC = 100).
const pluginReferencia = {
  id: "referencia",
  afterDatasetsDraw(chart) {
    const op = opcaoBruta(chart, "referencia");
    if (!op) return;
    const { ctx, chartArea } = chart;
    const x = chart.scales.x.getPixelForValue(op.valor);
    ctx.save();
    ctx.strokeStyle = cor("suave");
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(x, chartArea.top); ctx.lineTo(x, chartArea.bottom); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = cor("suave");
    ctx.font = "12px " + getComputedStyle(document.body).fontFamily;
    ctx.textAlign = "left";
    ctx.fillText(op.rotulo, x + 6, chartArea.top + 12);
    ctx.restore();
  }
};
if (window.Chart) Chart.register(pluginRotulos, pluginReferencia);

export function opcoes(extra) {
  Chart.defaults.color = cor("suave");
  Chart.defaults.borderColor = cor("linha");
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.font.size = 12;
  return Object.assign({ responsive: true, maintainAspectRatio: false, animation: { duration: 400 } }, extra);
}

export const legendaBaixo = () => ({ position: "bottom", labels: { boxWidth: 12, color: cor("tinta") } });

// Em telas estreitas, nomes longos viram duas ou mais linhas para não serem cortados no eixo.
function quebrar(texto, max) {
  if (texto.length <= max) return texto;
  const linhas = [];
  let atual = "";
  texto.split(" ").forEach(p => {
    if ((atual + " " + p).trim().length > max && atual) { linhas.push(atual); atual = p; }
    else atual = (atual + " " + p).trim();
  });
  if (atual) linhas.push(atual);
  return linhas;
}

export function barrasH(rotulos, valores, cores, formatar, extra) {
  const estreito = window.innerWidth < 640;
  return {
    type: "bar",
    data: { labels: estreito ? rotulos.map(r => quebrar(r, 16)) : rotulos, datasets: [{ data: valores, backgroundColor: cores, borderRadius: 1 }] },
    options: opcoes(Object.assign({
      indexAxis: "y",
      layout: { padding: { right: 64 } },
      plugins: { legend: { display: false }, rotulos: { formatar }, tooltip: { callbacks: { label: c => formatar(c.parsed.x) } } },
      scales: { x: { display: false, beginAtZero: true }, y: { grid: { display: false }, border: { display: false }, ticks: { autoSkip: false, color: cor("tinta") } } }
    }, extra))
  };
}

// Barras 100% empilhadas comparando Mondaí e Santa Catarina.
export function composicao(dist, cores, juntar) {
  const locais = Object.keys(dist);
  const valores = {};
  locais.forEach(l => {
    const bruto = Object.assign({}, dist[l]);
    if (juntar) {
      bruto[juntar.nome] = juntar.itens.reduce((s, k) => s + (bruto[k] || 0), 0);
      juntar.itens.forEach(k => delete bruto[k]);
    }
    const total = Object.values(bruto).reduce((s, v) => s + (v || 0), 0);
    valores[l] = Object.fromEntries(Object.entries(bruto).map(([k, v]) => [k, (v || 0) / total * 100]));
  });
  const categorias = Object.keys(valores[locais[0]]);
  return {
    config: {
      type: "bar",
      data: {
        labels: locais,
        datasets: categorias.map((c, i) => ({ label: c, data: locais.map(l => valores[l][c]), backgroundColor: cor(cores[i % cores.length]) }))
      },
      options: opcoes({
        indexAxis: "y",
        layout: { padding: { left: 6 } },
        plugins: { legend: { position: "bottom", labels: { boxWidth: 12, color: cor("tinta") } },
          tooltip: { callbacks: { label: c => c.dataset.label + ": " + d1.format(c.parsed.x) + "%" } } },
        scales: { x: { stacked: true, max: 100, ticks: { callback: v => v + "%" } }, y: { stacked: true, grid: { display: false }, ticks: { color: cor("tinta") } } }
      })
    },
    descricao: locais.map(l => l + ": " + categorias.map(c => c + " " + d1.format(valores[l][c]) + "%").join(", ")).join(". "),
    tabela: [["Categoria", ...locais], categorias.map(c => [c, ...locais.map(l => d1.format(valores[l][c]) + "%")])]
  };
}

// Esgoto agrupado pelo critério do Plansab, com a classificação escrita no próprio rótulo.
export function esgotoRotulado() {
  const r = {};
  Object.entries(S.esgoto).forEach(([local, e]) => {
    r[local] = {
      "Rede geral ou fossa ligada à rede (adequado)": e["Rede geral ou fossa ligada à rede"],
      "Fossa séptica (adequado)": e["Fossa séptica não ligada à rede"],
      "Fossa rudimentar ou buraco (precário)": e["Fossa rudimentar ou buraco"],
      "Outras formas (precário)": e["Vala"] + e["Rio, lago ou córrego"] + e["Outra forma"] + e["Sem banheiro nem sanitário"]
    };
  });
  return r;
}

// Cada gráfico guarda a função que o monta; é redesenhado ao trocar o contraste.
export const GRAFICOS = [];
// montar() devolve { config } para o Chart.js ou { html } para figuras próprias, como os rankings.
export function desenhar(g) {
  if (g.chart) g.chart.destroy();
  const r = g.montar();
  if (r.html) {
    // O canvas sai do lugar na primeira vez; guarda o contêiner para os redesenhos (tema, contraste).
    g.alvo = g.alvo || g.canvas.parentElement;
    g.alvo.classList.add("livre");
    g.alvo.innerHTML = r.html;
    g.chart = { destroy() {}, resize() {} };
  } else {
    g.chart = new Chart(g.canvas, r.config);
    g.canvas.setAttribute("aria-label", r.descricao);
  }
  if (r.tabela && g.tabela) g.tabela.innerHTML = tabelaHtml(...r.tabela);
}
