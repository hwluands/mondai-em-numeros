// Explorar: indicadores com a posição de Mondaí em SC e os gráficos em abas.
import { P, IND, S, M, MUN, VIZ, nomeDe } from "./dados.js";
import { int, d1, reais, fmt, posicao, percentil, mediana } from "./formato.js";
import { cor, opcoes, legendaBaixo, barrasH, composicao, esgotoRotulado, GRAFICOS, desenhar } from "./graficos.js";

export function kpis() {
  const lista = ["pop2026", "pib", "pib_pc", "empresas_mil", "ocupados_100", "salario_rs", "alfabetizacao", "esgoto_adequado"];
  document.getElementById("kpis").innerHTML = lista.map(k => {
    const i = IND[k];
    const p = percentil(k, i.mondai);
    return '<div class="card kpi"><div class="rotulo"><span>' + i.rotulo + '</span><span class="ano">' + i.ano + "</span></div>" +
      '<div class="valor">' + fmt(k, i.mondai) + "</div>" +
      '<div class="faixa" role="img" aria-label="' + posicao(i, "sc") + " de " + i.total_sc + ' cidades de SC">' +
      '<span class="mediana"></span><span class="ponto" style="left:' + (p === null ? 50 : p) + '%"></span></div>' +
      '<div class="faixa-legenda"><span>menor de SC</span><span>maior</span></div>' +
      '<div class="pos">' + posicao(i, "sc") + " de SC · " + posicao(i, "regiao") + " da região</div></div>";
  }).join("");
}

const TEMAS = [["pessoas", "Pessoas"], ["educacao", "Educação e renda"], ["economia", "Economia"], ["trabalho", "Trabalho"],
  ["campo", "Campo"], ["saneamento", "Saneamento"], ["prefeitura", "Prefeitura"], ["vizinhas", "Mondaí e as vizinhas"]];

export function montarAbas() {
  const abas = document.getElementById("abas"), paineis = document.getElementById("paineis");
  TEMAS.forEach(([id, nome], i) => {
    abas.insertAdjacentHTML("beforeend", '<button type="button" role="tab" id="aba-' + id + '" aria-controls="painel-' + id + '" aria-selected="' + (i === 0) + '"' + (i ? ' tabindex="-1"' : "") + ">" + nome + "</button>");
    paineis.insertAdjacentHTML("beforeend", '<div class="grade" role="tabpanel" id="painel-' + id + '" aria-labelledby="aba-' + id + '"' + (i ? " hidden" : "") + "></div>");
  });
  abas.addEventListener("click", e => { const b = e.target.closest("[role=tab]"); if (b) abrirAba(b.id.replace("aba-", "")); });
  abas.addEventListener("keydown", e => {
    if (!["ArrowRight", "ArrowLeft"].includes(e.key)) return;
    const ids = TEMAS.map(t => t[0]);
    const atual = ids.indexOf(document.activeElement.id.replace("aba-", ""));
    const prox = ids[(atual + (e.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length];
    abrirAba(prox); document.getElementById("aba-" + prox).focus();
  });
}

// Os gráficos de uma aba só são desenhados quando ela aparece (o Chart.js precisa do tamanho visível).
export function abrirAba(id) {
  TEMAS.forEach(([t]) => {
    const ativo = t === id;
    document.getElementById("aba-" + t).setAttribute("aria-selected", ativo);
    document.getElementById("aba-" + t).tabIndex = ativo ? 0 : -1;
    document.getElementById("painel-" + t).hidden = !ativo;
  });
  GRAFICOS.filter(g => g.painel === id && !g.chart).forEach(desenhar);
}

function cartao(painel, op, montar) {
  const card = document.createElement("div");
  card.className = "card " + (op.largura || "");
  let html = "<h3>" + op.titulo + '</h3><p class="nota">' + op.nota + "</p>";
  if (op.controle) html += '<div class="controle">' + op.controle + "</div>";
  html += '<div class="grafico ' + (op.altura || "") + '"><canvas role="img"></canvas></div>' +
    "<details><summary>" + (op.resumoTabela || "Ver em tabela") + '</summary><div class="tabela-rolagem"></div></details>';
  card.innerHTML = html;
  document.getElementById("painel-" + painel).appendChild(card);
  const g = { canvas: card.querySelector("canvas"), tabela: card.querySelector(".tabela-rolagem"), montar, painel };
  GRAFICOS.push(g);
  return g;
}

export function graficosExplorar() {
  // Pessoas
  cartao("pessoas", { titulo: "Pirâmide etária", nota: "Censo 2022 · % da população em cada faixa · contorno: Santa Catarina", altura: "alto" }, () => {
    const m = S.piramide["Mondaí"], e = S.piramide["Santa Catarina"];
    const soma = x => x.homens.concat(x.mulheres).reduce((a, b) => a + b, 0);
    const tm = soma(m), te = soma(e);
    const rot = m.faixas.slice().reverse().map(f => f.replace(" anos", "").replace(" ou mais", "+"));
    const inv = arr => arr.slice().reverse();
    const sc = { backgroundColor: "transparent", borderColor: cor("tinta"), borderWidth: 1.2, grouped: false };
    return {
      config: {
        type: "bar",
        data: { labels: rot, datasets: [
          { label: "Homens", data: inv(m.homens).map(v => -v / tm * 100), backgroundColor: cor("c3"), grouped: false },
          { label: "Mulheres", data: inv(m.mulheres).map(v => v / tm * 100), backgroundColor: cor("c2"), grouped: false },
          Object.assign({ label: "Santa Catarina", data: inv(e.homens).map(v => -v / te * 100) }, sc),
          Object.assign({ label: "_sc", data: inv(e.mulheres).map(v => v / te * 100) }, sc)] },
        options: opcoes({
          indexAxis: "y",
          plugins: { legend: { position: "bottom", labels: { boxWidth: 12, color: cor("tinta"), filter: it => it.text !== "_sc" } },
            tooltip: { callbacks: { label: c => (c.dataset.label === "_sc" ? "Santa Catarina" : c.dataset.label) + ": " + d1.format(Math.abs(c.parsed.x)) + "%" } } },
          scales: { x: { ticks: { callback: v => Math.abs(v) + "%" } }, y: { ticks: { autoSkip: false, font: { size: 10 } } } }
        })
      },
      descricao: "Pirâmide etária de Mondaí em 2022 comparada com Santa Catarina",
      tabela: [["Faixa", "Homens", "Mulheres"], m.faixas.map((f, i) => [f, int.format(m.homens[i]), int.format(m.mulheres[i])])]
    };
  });
  cartao("pessoas", { titulo: "População", nota: "Censos 2010 e 2022 · estimativas oficiais 2024 a 2026" }, () => {
    const d = S.populacao;
    return {
      config: {
        type: "bar",
        data: { labels: d.map(x => x.ano), datasets: [
          { label: "Censo", data: d.map(x => x.tipo === "Censo" ? x.valor : null), backgroundColor: cor("c1"), skipNull: true, borderRadius: 4 },
          { label: "Estimativa", data: d.map(x => x.tipo === "Estimativa" ? x.valor : null), backgroundColor: cor("c7"), skipNull: true, borderRadius: 4 }] },
        options: opcoes({ plugins: { legend: legendaBaixo(), rotulos: { formatar: v => int.format(v) }, tooltip: { callbacks: { label: c => int.format(c.parsed.y) + " pessoas" } } },
          scales: { x: { stacked: true, grid: { display: false } }, y: { beginAtZero: true, ticks: { callback: v => int.format(v) } } } })
      },
      descricao: d.map(x => x.ano + " (" + x.tipo + "): " + int.format(x.valor)).join("; "),
      tabela: [["Ano", "Pessoas", "Fonte"], d.map(x => [x.ano, int.format(x.valor), x.tipo])]
    };
  });
  cartao("pessoas", { titulo: "Onde as pessoas moram", nota: "Censo 2022 · situação do domicílio", largura: "l12" }, () => composicao(S.situacao, ["c1", "c6"]));

  // Educação e renda
  cartao("educacao", { titulo: "Escolaridade dos adultos", nota: "Censo 2022 · pessoas de 18 anos ou mais, nível de instrução" }, () => composicao(S.instrucao, ["c7", "c6", "c3", "c1"]));
  cartao("educacao", { titulo: "Rendimento do trabalho", nota: "Censo 2022 · por mês, pessoas de 14 anos ou mais ocupadas" }, () => {
    const r = S.rendimento, locais = Object.keys(r);
    return {
      config: {
        type: "bar",
        data: { labels: ["Médio", "Mediano"], datasets: locais.map((l, i) => ({ label: l, data: [r[l].medio, r[l].mediano], backgroundColor: cor(i ? "c2" : "c1"), borderRadius: 4 })) },
        options: opcoes({ plugins: { legend: legendaBaixo(), rotulos: { formatar: v => reais(v) }, tooltip: { callbacks: { label: c => c.dataset.label + ": " + reais(c.parsed.y) } } },
          scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { callback: v => reais(v) } } } })
      },
      descricao: locais.map(l => l + ": médio " + reais(r[l].medio) + ", mediano " + reais(r[l].mediano)).join(". "),
      tabela: [["Local", "Médio", "Mediano"], locais.map(l => [l, reais(r[l].medio), reais(r[l].mediano)])]
    };
  });
  cartao("educacao", { titulo: "Alfabetização e ensino superior", nota: "Censo 2022 · Mondaí e as medianas das cidades", largura: "l12" }, () => {
    const ks = ["alfabetizacao", "superior"];
    const series = [["Mondaí", "mondai", "c1"], ["Mediana da região", "mediana_regiao", "c6"], ["Mediana de SC", "mediana_sc", "c2"]];
    return {
      config: {
        type: "bar",
        data: { labels: ks.map(k => IND[k].rotulo), datasets: series.map(([n, campo, c]) => ({ label: n, data: ks.map(k => IND[k][campo]), backgroundColor: cor(c), borderRadius: 4 })) },
        options: opcoes({ indexAxis: "y", layout: { padding: { right: 48 } },
          plugins: { legend: legendaBaixo(), rotulos: { formatar: v => d1.format(v) + "%" }, tooltip: { callbacks: { label: c => c.dataset.label + ": " + d1.format(c.parsed.x) + "%" } } },
          scales: { x: { beginAtZero: true, max: 100, ticks: { callback: v => v + "%" } }, y: { grid: { display: false }, ticks: { color: cor("tinta") } } } })
      },
      descricao: ks.map(k => IND[k].rotulo + ": Mondaí " + fmt(k, IND[k].mondai) + ", mediana de SC " + fmt(k, IND[k].mediana_sc)).join(". "),
      tabela: [["Indicador", ...series.map(s => s[0])], ks.map(k => [IND[k].rotulo, ...series.map(s => fmt(k, IND[k][s[1]]))])]
    };
  });

  // Economia
  cartao("economia", { titulo: "PIB de Mondaí", nota: "2002 a 2023 · milhões de reais correntes, sem correção pela inflação" }, () => {
    const d = S.pib;
    return {
      config: {
        type: "line",
        data: { labels: d.map(x => x.ano), datasets: [{ data: d.map(x => x.valor / 1000), borderColor: cor("c1"), backgroundColor: cor("c1") + "22", fill: true, pointRadius: 0, borderWidth: 3, tension: 0.25 }] },
        options: opcoes({ plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => reais(c.parsed.y * 1e6) } } },
          scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } }, y: { ticks: { callback: v => "R$ " + int.format(v) + " mi" } } } })
      },
      descricao: "PIB de Mondaí de " + d[0].ano + " a " + d[d.length - 1].ano + ": de " + reais(d[0].valor * 1000) + " para " + reais(d[d.length - 1].valor * 1000),
      tabela: [["Ano", "PIB"], d.map(x => [x.ano, reais(x.valor * 1000)])]
    };
  });
  cartao("economia", { titulo: "PIB por habitante", nota: "IBGE, série oficial 2010 a 2023 · Mondaí e cidades vizinhas" }, () => {
    const nomes = Object.keys(S.pib_pc), anos = Object.keys(S.pib_pc[nomes[0]]).sort();
    const cores = ["c3", "c2", "c4", "c5", "c6"];
    return {
      config: {
        type: "line",
        data: { labels: anos, datasets: nomes.map((n, i) => ({
          label: n, data: anos.map(a => S.pib_pc[n][a]),
          borderColor: n === "Mondaí" ? cor("c1") : cor(cores[(i - 1) % cores.length]),
          backgroundColor: n === "Mondaí" ? cor("c1") : cor(cores[(i - 1) % cores.length]),
          borderWidth: n === "Mondaí" ? 3.5 : 1.5, pointRadius: 0, tension: 0.25 })) },
        options: opcoes({ interaction: { mode: "index", intersect: false }, plugins: { legend: legendaBaixo(), tooltip: { callbacks: { label: c => c.dataset.label + ": " + reais(c.parsed.y) } } },
          scales: { x: { grid: { display: false } }, y: { ticks: { callback: v => "R$ " + int.format(v / 1000) + " mil" } } } })
      },
      descricao: "PIB por habitante de 2010 a 2023 de " + nomes.join(", "),
      tabela: [["Ano", ...nomes], anos.map(a => [a, ...nomes.map(n => S.pib_pc[n][a] ? reais(S.pib_pc[n][a]) : "sem dado")])]
    };
  });
  cartao("economia", { titulo: "De onde vem a economia", nota: "2021, último ano com divisão por setor publicada pelo IBGE" }, () => {
    const ids = [P.mondai, ...VIZ];
    const set = [["pct_agro", "Agropecuária", "c6"], ["pct_ind", "Indústria", "c1"], ["pct_serv", "Serviços", "c3"], ["pct_adm", "Adm. pública", "c4"]];
    return {
      config: {
        type: "bar",
        data: { labels: ids.map(nomeDe), datasets: set.map(([k, n, c]) => ({ label: n, data: ids.map(id => MUN[id][k]), backgroundColor: cor(c) })) },
        options: opcoes({ indexAxis: "y",
          plugins: { legend: legendaBaixo(), tooltip: { callbacks: { label: c => c.dataset.label + ": " + d1.format(c.parsed.x) + "%" } } },
          scales: { x: { stacked: true, max: 100, ticks: { callback: v => v + "%" } }, y: { stacked: true, grid: { display: false }, ticks: { color: cor("tinta") } } } })
      },
      descricao: "Composição da economia por setor em 2021",
      tabela: [["Cidade", ...set.map(s => s[1])], ids.map(id => [nomeDe(id), ...set.map(([k]) => d1.format(MUN[id][k]) + "%")])]
    };
  });
  cartao("economia", { titulo: "Riqueza produzida e salário", nota: "As 295 cidades de SC · PIB por habitante 2023 (escala logarítmica) × salário médio 2024" }, () => {
    const pontos = id => ({ x: MUN[id].pib_pc, y: MUN[id].salario_rs, nome: nomeDe(id) });
    const validos = Object.keys(MUN).filter(id => MUN[id].pib_pc && MUN[id].salario_rs);
    const outros = validos.filter(id => id !== P.mondai && !VIZ.includes(id));
    return {
      config: {
        type: "scatter",
        data: { datasets: [
          { label: "Mondaí", data: [pontos(P.mondai)], backgroundColor: cor("c1"), pointRadius: 8, pointHoverRadius: 10, order: 0 },
          { label: "Vizinhas", data: VIZ.map(pontos), backgroundColor: cor("c2"), pointRadius: 5, order: 1 },
          { label: "Outras cidades de SC", data: outros.map(pontos), backgroundColor: cor("c7") + "99", pointRadius: 3, order: 2 }] },
        options: opcoes({
          plugins: { legend: legendaBaixo(), tooltip: { callbacks: { label: c => c.raw.nome + ": PIB/hab " + reais(c.raw.x) + ", salário " + reais(c.raw.y) } } },
          scales: {
            x: { type: "logarithmic", title: { display: true, text: "PIB por habitante" }, ticks: { callback: v => [20000, 50000, 100000, 200000, 500000].includes(v) ? "R$ " + int.format(v / 1000) + " mil" : "" } },
            y: { title: { display: true, text: "Salário médio mensal" }, ticks: { callback: v => reais(v) } }
          }
        })
      },
      descricao: "Dispersão entre PIB por habitante e salário médio nas cidades de SC, com Mondaí em destaque",
      tabela: [["Cidade", "PIB por habitante 2023", "Salário médio 2024"],
        validos.sort((a, b) => MUN[b].pib_pc - MUN[a].pib_pc).map(id => [nomeDe(id), reais(MUN[id].pib_pc), reais(MUN[id].salario_rs)]), l => l[0] === M.nome]
    };
  });

  // Trabalho
  cartao("trabalho", { titulo: "Onde estão os empregos", nota: "2024 · pessoal ocupado por setor (CNAE)", largura: "l8", altura: "alto" }, () => {
    const d = S.setores.filter(x => x.pessoas > 0);
    const top = d.slice(0, 10), resto = d.slice(10).reduce((s, x) => s + x.pessoas, 0);
    const rot = top.map(x => x.secao.length > 38 ? x.secao.slice(0, 36) + "…" : x.secao).concat(resto ? ["Outros setores"] : []);
    const val = top.map(x => x.pessoas).concat(resto ? [resto] : []);
    return {
      config: barrasH(rot, val, val.map((_, i) => i === 0 ? cor("c1") : cor("c3")), v => int.format(v)),
      descricao: top.map(x => x.secao + ": " + int.format(x.pessoas)).join("; "),
      tabela: [["Setor", "Pessoas"], d.map(x => [x.secao, int.format(x.pessoas)])]
    };
  });
  cartao("trabalho", { titulo: "Empresas e empregos", nota: "2022 a 2024 · nova série do Cadastro Central de Empresas", largura: "l4", altura: "alto" }, () => {
    const d = S.cempre;
    return {
      config: {
        type: "bar",
        data: { labels: d.map(x => x.ano), datasets: [
          { type: "bar", label: "Pessoal ocupado", data: d.map(x => x.ocupados), backgroundColor: cor("c3"), yAxisID: "y", borderRadius: 4, semRotulo: true },
          { type: "line", label: "Empresas", data: d.map(x => x.empresas), borderColor: cor("c1"), backgroundColor: cor("c1"), yAxisID: "y1", pointRadius: 4, semRotulo: true }] },
        options: opcoes({ plugins: { legend: legendaBaixo() },
          scales: { x: { grid: { display: false } }, y: { beginAtZero: true, position: "left", ticks: { callback: v => int.format(v) } },
            y1: { beginAtZero: true, position: "right", grid: { drawOnChartArea: false }, ticks: { callback: v => int.format(v) } } } })
      },
      descricao: d.map(x => x.ano + ": " + x.empresas + " empresas, " + x.ocupados + " pessoas ocupadas").join("; "),
      tabela: [["Ano", "Empresas", "Pessoal ocupado", "Salário médio"], d.map(x => [x.ano, int.format(x.empresas), int.format(x.ocupados), d1.format(x.salario_sm) + " sal. mín."])]
    };
  });

  // Campo
  const rebanho = (nome, corNome) => cartao("campo", { titulo: nome, nota: "Cabeças, 2000 a 2025", largura: "l4", altura: "baixo" }, () => {
    const d = S.rebanhos[nome], anos = Object.keys(d).sort();
    return {
      config: {
        type: "line",
        data: { labels: anos, datasets: [{ data: anos.map(a => d[a]), borderColor: cor(corNome), backgroundColor: cor(corNome) + "33", fill: true, pointRadius: 0, tension: 0.2 }] },
        options: opcoes({ plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => int.format(c.parsed.y) + " cabeças" } } },
          scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } }, y: { beginAtZero: true, ticks: { callback: v => int.format(v) } } } })
      },
      descricao: nome + " em Mondaí de 2000 a 2025; em 2025: " + int.format(d["2025"]),
      tabela: [["Ano", "Cabeças"], anos.map(a => [a, int.format(d[a])])]
    };
  });
  rebanho("Suínos", "c2");
  rebanho("Galináceos", "c6");
  rebanho("Bovinos", "c3");
  cartao("campo", { titulo: "Produção de leite", nota: "Milhões de litros por ano, 2000 a 2025" }, () => {
    const anos = Object.keys(S.leite).sort();
    return {
      config: {
        type: "line",
        data: { labels: anos, datasets: [{ data: anos.map(a => S.leite[a] / 1000), borderColor: cor("c3"), backgroundColor: cor("c3") + "33", fill: true, pointRadius: 0, tension: 0.2 }] },
        options: opcoes({ plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => d1.format(c.parsed.y) + " milhões de litros" } } },
          scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { callback: v => d1.format(v) + " mi" } } } })
      },
      descricao: "Produção de leite de 2000 a 2025",
      tabela: [["Ano", "Mil litros"], anos.map(a => [a, int.format(S.leite[a])])]
    };
  });
  cartao("campo", { titulo: "Lavouras: valor da produção", nota: "2025 · principais produtos" }, () => {
    const d = S.lavouras, top = d.slice(0, 6), resto = d.slice(6).reduce((s, x) => s + x.valor, 0);
    const rot = top.map(x => x.produto).concat(resto ? ["Outros"] : []);
    const val = top.map(x => x.valor * 1000).concat(resto ? [resto * 1000] : []);
    return {
      config: barrasH(rot, val, val.map((_, i) => i === 0 ? cor("c1") : cor("c6")), reais),
      descricao: top.map(x => x.produto + ": " + reais(x.valor * 1000)).join("; "),
      tabela: [["Produto", "Valor"], d.map(x => [x.produto, reais(x.valor * 1000)])]
    };
  });

  // Saneamento
  cartao("saneamento", { titulo: "Água", nota: "Censo 2022 · ligação à rede geral de distribuição", largura: "l4" }, () => composicao(S.agua, ["c3", "c5", "c7"]));
  cartao("saneamento", { titulo: "Esgoto", nota: "Censo 2022 · tipo de esgotamento sanitário, pelo critério do Plansab", largura: "l4" }, () =>
    composicao(esgotoRotulado(), ["c3", "c5", "c2", "c7"]));
  cartao("saneamento", { titulo: "Lixo", nota: "Censo 2022 · destino do lixo", largura: "l4" }, () =>
    composicao(S.lixo, ["c3", "c5", "c2", "c7"], { nome: "Outros destinos", itens: ["Enterrado na propriedade", "Terreno baldio ou área pública", "Outro destino"] }));

  // Prefeitura
  const pf = P.prefeitura;
  cartao("prefeitura", { titulo: "Para onde vai o dinheiro", nota: pf.ano + " · despesas liquidadas por área", largura: "l8", altura: "alto" }, () => {
    const d = Object.entries(pf.mondai).sort((a, b) => b[1] - a[1]);
    const top = d.slice(0, 10), resto = d.slice(10).reduce((s, x) => s + x[1], 0);
    const rot = top.map(x => x[0]).concat(resto ? ["Outras áreas"] : []);
    const val = top.map(x => x[1]).concat(resto ? [resto] : []);
    return {
      config: barrasH(rot, val, val.map((_, i) => i < 2 ? cor("c1") : cor("c3")), reais),
      descricao: top.map(x => x[0] + ": " + reais(x[1])).join("; "),
      tabela: [["Área", "Despesa liquidada"], d.map(x => [x[0], reais(x[1])])]
    };
  });
  cartao("prefeitura", { titulo: "Despesa por habitante", nota: pf.ano + " · Mondaí e mediana da região", largura: "l4", altura: "alto" }, () => {
    const ph = pf.por_habitante;
    const regiao = Object.keys(ph).filter(id => MUN[id].regiao_imediata === P.regiao);
    const campos = [["total", "Total"], ["saude", "Saúde"], ["educacao", "Educação"]];
    const mond = campos.map(([k]) => ph[P.mondai] ? ph[P.mondai][k] : null);
    const med = campos.map(([k]) => mediana(regiao.map(id => ph[id][k])));
    return {
      config: {
        type: "bar",
        data: { labels: campos.map(c => c[1]), datasets: [
          { label: "Mondaí", data: mond, backgroundColor: cor("c1"), borderRadius: 4 },
          { label: "Mediana da região", data: med, backgroundColor: cor("c2"), borderRadius: 4 }] },
        options: opcoes({ plugins: { legend: legendaBaixo(), tooltip: { callbacks: { label: c => c.dataset.label + ": " + reais(c.parsed.y) } } },
          scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { callback: v => reais(v) } } } })
      },
      descricao: campos.map(([, n], i) => n + ": Mondaí " + reais(mond[i]) + ", mediana da região " + reais(med[i])).join("; "),
      tabela: [["Cidade", "Total", "Saúde", "Educação"],
        Object.keys(ph).sort((a, b) => (ph[b].total || 0) - (ph[a].total || 0)).map(id => [nomeDe(id), ...campos.map(([k]) => ph[id][k] ? reais(ph[id][k]) : "sem dado")]),
        l => l[0] === M.nome]
    };
  });

  // Mondaí e as vizinhas
  const temas = ["Pessoas", "Educação e renda", "Economia", "Trabalho", "Saneamento", "Campo"];
  const opcoesInd = temas.map(t => '<optgroup label="' + t + '">' +
    Object.entries(IND).filter(([, i]) => i.tema === t)
      .map(([k, i]) => '<option value="' + k + '"' + (k === "pib_pc" ? " selected" : "") + ">" + i.rotulo + " (" + i.ano + ")</option>").join("") + "</optgroup>").join("");
  const gInd = cartao("vizinhas", {
    titulo: "Mondaí e as vizinhas", nota: "Indicador escolhido, com as medianas da região e de SC", largura: "l12", altura: "alto",
    controle: '<label for="sel-ind">Indicador</label><select id="sel-ind">' + opcoesInd + "</select>", resumoTabela: "Ver o ranking das 295 cidades"
  }, () => {
    const k = document.getElementById("sel-ind").value, i = IND[k];
    const itens = [P.mondai, ...VIZ].filter(id => MUN[id][k] !== null).map(id => ({ nome: nomeDe(id), v: MUN[id][k], c: id === P.mondai ? "c1" : "c7" }));
    itens.push({ nome: "Mediana da região", v: i.mediana_regiao, c: "c2" }, { nome: "Mediana de SC", v: i.mediana_sc, c: "c2" });
    itens.sort((a, b) => b.v - a.v);
    const ranking = Object.entries(MUN).filter(([, m]) => m[k] !== null).sort((a, b) => b[1][k] - a[1][k]);
    return {
      config: barrasH(itens.map(x => x.nome), itens.map(x => x.v), itens.map(x => cor(x.c)), v => fmt(k, v)),
      descricao: i.rotulo + ": " + itens.map(x => x.nome + " " + fmt(k, x.v)).join("; "),
      tabela: [["Posição · Cidade", i.rotulo + " (" + i.ano + ")"], ranking.map(([, m], n) => [(n + 1) + "º · " + m.nome, fmt(k, m[k])]), l => l[0].endsWith(" · " + M.nome)]
    };
  });
  document.getElementById("sel-ind").addEventListener("change", () => desenhar(gInd));
}
