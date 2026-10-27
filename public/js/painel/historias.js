// As 6 histórias: título, texto e gráfico anotado. Os números dos textos vêm dos dados.
import { P, IND as I, S, M, MUN, VIZ, nomeDe, esgM, esgSC, precario } from "./dados.js";
import { ranking } from "./ranking.js";
import { int, d1, reais } from "./formato.js";
import { cor, opcoes, barrasH, composicao, esgotoRotulado, GRAFICOS } from "./graficos.js";

function compartilhar(texto, ancora) {
  const url = location.origin + location.pathname + "#" + ancora;
  if (navigator.share) navigator.share({ title: "Mondaí em Números", text: texto, url }).catch(() => {});
  else window.open("https://wa.me/?text=" + encodeURIComponent(texto + " " + url), "_blank", "noopener");
}

// Texto à esquerda, figura numerada à direita, com a fonte embaixo da figura.
function capitulo(n, op, montar) {
  const id = "historia-" + n;
  const art = document.createElement("article");
  art.className = "capitulo";
  art.id = id;
  art.setAttribute("aria-labelledby", id + "-t");
  art.innerHTML =
    '<div class="texto"><span class="num">' + op.tema + "</span>" +
    '<h3 id="' + id + '-t">' + op.titulo + "</h3><p>" + op.texto + "</p>" +
    '<button type="button" class="botao leve compartilhar">Compartilhar</button></div>' +
    '<figure class="figura card"><figcaption class="figura-titulo"><b>Figura ' + n + ".</b> " + op.figura + "</figcaption>" +
    '<div class="grafico"><canvas role="img"></canvas></div>' +
    '<p class="fonte">Fonte: ' + op.fonte + "</p>" +
    "<details><summary>Ver em tabela</summary><div class=\"tabela-rolagem\"></div></details></figure>";
  document.getElementById("capitulos").appendChild(art);
  art.querySelector(".compartilhar").addEventListener("click", () => compartilhar(op.titulo.replace(/<[^>]+>/g, ""), id));
  GRAFICOS.push({ canvas: art.querySelector("canvas"), tabela: art.querySelector(".tabela-rolagem"), montar, painel: null });
}

export function historias() {
  // 1. Riqueza e salário: as duas posições no ranking das 295 cidades
  const pc = I.pib_pc, sal = I.salario_rs;
  const posicoes = chave => {
    const ids = Object.keys(MUN).filter(id => MUN[id].pib_pc && MUN[id].salario_rs).sort((a, b) => MUN[b][chave] - MUN[a][chave]);
    return Object.fromEntries(ids.map((id, i) => [id, i + 1]));
  };
  const rPib = posicoes("pib_pc"), rSal = posicoes("salario_rs");
  const salarios = Object.values(MUN).map(m => m.salario_rs).filter(v => v).sort((a, b) => b - a);
  const distancias = Object.keys(rPib).map(id => rSal[id] - rPib[id]).sort((a, b) => b - a);
  const posDistancia = distancias.indexOf(rSal[P.mondai] - rPib[P.mondai]) + 1;
  capitulo(1, {
    tema: "Riqueza e salário",
    titulo: "Muita riqueza produzida por habitante. O salário, perto da mediana do estado.",
    texto: "O PIB por habitante divide pela população tudo o que é produzido na cidade; em Mondaí, " +
      Math.round(I.pct_ind.mondai) + "% do valor produzido em " + I.pct_ind.ano + " veio da indústria. É o " + pc.maior_sc + "º maior de SC e o " +
      pc.maior_regiao + "º da região. O salário médio mostra quanto recebe, em média, quem trabalha em empresas e organizações: " + reais(sal.mondai) +
      " em " + sal.ano + ", " + reais(Math.abs(sal.mediana_sc - sal.mondai)) + (sal.mondai < sal.mediana_sc ? " abaixo" : " acima") +
      " da mediana do estado. No ranking, isso vira a " + sal.maior_sc + "ª posição porque, no meio da fila, as cidades ficam muito próximas: da 100ª à 200ª, a diferença é de " +
      reais(salarios[99] - salarios[199]) + ".",
    figura: "As " + pc.total_sc + " cidades de SC em dois rankings. Cada traço é uma cidade, da maior para a menor.",
    fonte: "IBGE, PIB dos Municípios " + pc.ano + " e Cadastro Central de Empresas " + sal.ano
  }, () => ({
    html: '<p class="ranking-titulo"><b>PIB por habitante, ' + pc.ano + "</b></p>" +
      ranking("pib_pc", { altura: 80, rotulo: "PIB por habitante: Mondaí é a " + pc.maior_sc + "ª de " + pc.total_sc }) +
      '<p class="ranking-titulo"><b>Salário médio mensal, ' + sal.ano + "</b></p>" +
      ranking("salario_rs", { altura: 80, rotulo: "Salário médio: Mondaí é a " + sal.maior_sc + "ª de " + sal.total_sc }),
    tabela: [["Indicador", "Mondaí", "Posição em SC", "Mediana de SC"], [
      ["PIB por habitante (" + pc.ano + ")", reais(pc.mondai), pc.maior_sc + "º", reais(pc.mediana_sc)],
      ["Salário médio (" + sal.ano + ")", reais(sal.mondai), sal.maior_sc + "º", reais(sal.mediana_sc)]]]
  }));

  // 2. Trabalho
  const setores = S.setores.filter(x => x.pessoas > 0);
  const totalOc = setores.reduce((s, x) => s + x.pessoas, 0);
  const ind = setores.find(x => x.secao === "Indústrias de transformação");
  capitulo(2, {
    tema: "Trabalho",
    titulo: Math.round(ind.pessoas / totalOc * 100) + " em cada 100 pessoas que trabalham em empresas estão na indústria",
    texto: "Em " + I.ocupados.ano + ", " + int.format(ind.pessoas) + " das " + int.format(totalOc) + " pessoas ocupadas em empresas e organizações de Mondaí estavam na indústria de transformação: " +
      Math.round(ind.pessoas / totalOc * 100) + " em cada 100. Na economia, a indústria respondia por " + Math.round(I.pct_ind.mondai) + "% do valor produzido em " +
      I.pct_ind.ano + ", o " + I.pct_ind.maior_sc + "º maior peso de Santa Catarina.",
    figura: "Pessoas ocupadas em empresas e organizações de Mondaí, por setor, " + I.ocupados.ano + ".",
    fonte: "IBGE, Cadastro Central de Empresas e PIB dos Municípios"
  }, () => {
    const top = setores.slice(0, 5), resto = setores.slice(5).reduce((s, x) => s + x.pessoas, 0);
    const curto = s => s.replace("; reparação de veículos automotores e motocicletas", "").replace(", defesa e seguridade social", "").replace(", armazenagem e correio", " e armazenagem").replace("Saúde humana e serviços sociais", "Saúde e assistência social");
    const rot = top.map(x => curto(x.secao)).concat(["Outros setores"]);
    const val = top.map(x => x.pessoas).concat([resto]);
    return {
      config: barrasH(rot, val, val.map((_, i) => i === 0 ? cor("c1") : cor("c6")), v => int.format(v) + " (" + Math.round(v / totalOc * 100) + "%)"),
      descricao: rot.map((r, i) => r + ": " + val[i]).join("; "),
      tabela: [["Setor", "Pessoas"], setores.map(x => [x.secao, int.format(x.pessoas)])]
    };
  });

  // 3. Campo
  const vizMais = VIZ.filter(id => MUN[id].suinos_hab > M.suinos_hab).length;
  const fraseViz = vizMais === VIZ.length ? "E as " + VIZ.length + " cidades vizinhas têm proporção ainda maior."
    : vizMais ? vizMais + " das " + VIZ.length + " cidades vizinhas têm proporção ainda maior." : "Nenhuma das cidades vizinhas chega a essa proporção.";
  capitulo(3, {
    tema: "Campo",
    titulo: "São " + d1.format(I.suinos_hab.mondai) + " porcos para cada morador",
    texto: "O rebanho de suínos de Mondaí chegou a " + int.format(Math.round(I.suinos.mondai / 1000)) + " mil cabeças em " + I.suinos.ano + ", o " + I.suinos.maior_sc +
      "º maior de Santa Catarina. Na mediana das cidades catarinenses, há " + (I.suinos_hab.mediana_sc < 1 ? "menos de um porco" : d1.format(I.suinos_hab.mediana_sc) + " porcos") +
      " por morador. " + fraseViz,
    figura: "Suínos por habitante em " + I.suinos_hab.ano + ": Mondaí, as cidades vizinhas e a mediana de SC.",
    fonte: "IBGE, Pesquisa da Pecuária Municipal e Estimativas de População"
  }, () => {
    const itens = [P.mondai, ...VIZ].map(id => ({ nome: nomeDe(id), v: MUN[id].suinos_hab, c: id === P.mondai ? "c1" : "c6" }));
    itens.push({ nome: "Mediana de SC", v: I.suinos_hab.mediana_sc, c: "c2" });
    itens.sort((a, b) => b.v - a.v);
    return {
      config: barrasH(itens.map(x => x.nome), itens.map(x => x.v), itens.map(x => cor(x.c)), v => d1.format(v)),
      descricao: "Suínos por habitante: " + itens.map(x => x.nome + " " + d1.format(x.v)).join("; "),
      tabela: [["Cidade", "Suínos por habitante"], itens.map(x => [x.nome, d1.format(x.v)])]
    };
  });

  // 4. População. Médias de 3 anos, porque um ano isolado com ~100 nascimentos oscila muito.
  const ini = S.vitais.slice(0, 3), fim = S.vitais.slice(-3);
  const somaV = (a, k) => a.reduce((s, x) => s + x[k], 0);
  const per = a => a[0].ano + " a " + a[a.length - 1].ano;
  const razao = a => somaV(a, "nascimentos") / somaV(a, "obitos");
  const v0 = S.vitais[0], v1 = S.vitais[S.vitais.length - 1];
  const censos = S.populacao.filter(x => x.tipo === "Censo");
  const estimativas = S.populacao.filter(x => x.tipo === "Estimativa");
  capitulo(4, {
    tema: "População",
    titulo: "De " + per(ini) + ", nasciam " + d1.format(razao(ini)) + " bebês para cada morte. De " + per(fim) + ", " + d1.format(razao(fim)) + ".",
    texto: "Os nascimentos ficaram estáveis, com média de " + int.format(somaV(ini, "nascimentos") / 3) + " e " + int.format(somaV(fim, "nascimentos") / 3) +
      " por ano nos dois períodos. O que mudou foram os óbitos, que passaram de " + int.format(somaV(ini, "obitos") / 3) + " para " + int.format(somaV(fim, "obitos") / 3) +
      " por ano. Entre os Censos de " + censos[0].ano + " e " + censos[censos.length - 1].ano + ", a população foi de " + int.format(censos[0].valor) + " para " +
      int.format(censos[censos.length - 1].valor) + " pessoas. Depois do Censo, as estimativas do IBGE de " + estimativas[0].ano + " a " +
      estimativas[estimativas.length - 1].ano + " ficam estáveis, entre " + int.format(Math.min(...estimativas.map(x => x.valor))) + " e " +
      int.format(Math.max(...estimativas.map(x => x.valor))) + " moradores.",
    figura: "Nascimentos e óbitos de moradores de Mondaí, por ano.",
    fonte: "IBGE, Registro Civil e Censos Demográficos"
  }, () => ({
    config: {
      type: "line",
      data: {
        labels: S.vitais.map(x => x.ano),
        datasets: [
          { label: "Nascimentos", data: S.vitais.map(x => x.nascimentos), borderColor: cor("c1"), backgroundColor: cor("c1"), pointRadius: 0, borderWidth: 3, tension: 0.25 },
          { label: "Óbitos", data: S.vitais.map(x => x.obitos), borderColor: cor("c2"), backgroundColor: cor("c2"), pointRadius: 0, borderWidth: 3, tension: 0.25 }
        ]
      },
      options: opcoes({
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { position: "top", align: "start", labels: { boxWidth: 12, color: cor("tinta") } } },
        scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } }, y: { beginAtZero: true } }
      })
    },
    descricao: "Nascimentos e óbitos por ano de " + v0.ano + " a " + v1.ano,
    tabela: [["Ano", "Nascimentos", "Óbitos"], S.vitais.map(x => [x.ano, x.nascimentos, x.obitos])]
  }));

  // 5. Esgoto, pelo critério do Plansab: abaixo de SC, à frente da região
  const ea = I.esgoto_adequado;
  const aFrente = ea.maior_regiao - 1;
  capitulo(5, {
    tema: "Esgoto",
    titulo: "O esgoto adequado chega a " + Math.round(ea.mondai) + "% dos moradores: abaixo de SC, mas o " + ea.maior_regiao + "º melhor da região",
    texto: "Pelo Plano Nacional de Saneamento Básico, rede geral e fossa séptica são soluções adequadas. Em Mondaí, " + Math.round(ea.mondai) +
      "% dos moradores estão nesse grupo, contra " + Math.round(100 - precario(esgSC)) + "% em Santa Catarina. Na região de " + P.regiao +
      ", onde a mediana das cidades é de " + Math.round(ea.mediana_regiao) + "%, " + (aFrente === 0 ? "nenhuma cidade fica à frente" : aFrente === 1 ? "só uma cidade fica à frente" : "só " + aFrente + " cidades ficam à frente") +
      ". O que puxa para baixo é a rede: só " + Math.round(I.esgoto_rede.mondai) + "% estão ligados à rede geral, contra " +
      Math.round(esgSC["Rede geral ou fossa ligada à rede"]) + "% no estado, e " + Math.round(esgM["Fossa rudimentar ou buraco"]) + " em cada 100 ainda usam fossa rudimentar ou buraco.",
    figura: "Tipo de esgoto, em % dos moradores, em Mondaí e em Santa Catarina. Tons de verde: soluções adequadas; cinza: precárias.",
    fonte: "IBGE, Censo Demográfico 2022; critério do Plansab"
  }, () => composicao(esgotoRotulado(), ["c3", "c5", "c2", "c4"]));

  // 6. Água: acima de SC e da região, com a ressalva de quem tem rede e usa outra fonte
  const ag = I.agua_rede, agM = S.agua["Mondaí"], agSC = S.agua["Santa Catarina"];
  capitulo(6, {
    tema: "Água",
    titulo: Math.round(ag.mondai) + " em cada 100 moradores estão ligados à rede de água, o " + ag.maior_regiao + "º melhor índice da região",
    texto: "Na mediana das cidades catarinenses, são " + Math.round(ag.mediana_sc) + " em cada 100, e o estado como um todo chega a " +
      Math.round(agSC["Rede geral"] + agSC["Rede geral, mas usa outra fonte"]) + ". Mondaí é a " + ag.maior_sc + "ª de SC. Mas ter a ligação não quer dizer usá-la: " +
      Math.round(agM["Rede geral, mas usa outra fonte"]) + " em cada 100 moradores têm rede e usam principalmente outra fonte, contra " +
      Math.round(agSC["Rede geral, mas usa outra fonte"]) + " no estado. Outros " + Math.round(agM["Sem ligação à rede"]) + " não têm ligação.",
    figura: "Abastecimento de água, em % dos moradores, em Mondaí e em Santa Catarina.",
    fonte: "IBGE, Censo Demográfico 2022"
  }, () => composicao(S.agua, ["c3", "c5", "c4"]));

  // 7. Prefeitura
  const pf = P.prefeitura;
  const desp = Object.entries(pf.mondai).sort((a, b) => b[1] - a[1]);
  const totalDesp = desp.reduce((s, x) => s + x[1], 0);
  const edu = pf.mondai["Educação"], sau = pf.mondai["Saúde"];
  capitulo(7, {
    tema: "Prefeitura",
    titulo: "De cada R$ 10 que a prefeitura gasta, quase R$ 5 vão para educação e saúde",
    texto: "Em " + pf.ano + ", a prefeitura de Mondaí liquidou " + reais(totalDesp) + " em despesas, " + reais(pf.por_habitante[P.mondai].total) +
      " por habitante. Educação (" + reais(edu) + ") e saúde (" + reais(sau) + ") somam " + Math.round((edu + sau) / totalDesp * 100) + "% do total.",
    figura: "Despesas liquidadas da prefeitura de Mondaí por área, " + pf.ano + ".",
    fonte: "Tesouro Nacional, Siconfi"
  }, () => {
    const top = desp.slice(0, 6), resto = desp.slice(6).reduce((s, x) => s + x[1], 0);
    const rot = top.map(x => x[0]).concat(["Outras áreas"]);
    const val = top.map(x => x[1]).concat([resto]);
    return {
      config: barrasH(rot, val, val.map((_, i) => i < 2 ? cor("c1") : cor("c6")), reais),
      descricao: rot.map((r, i) => r + ": " + reais(val[i])).join("; "),
      tabela: [["Área", "Despesa liquidada"], desp.map(x => [x[0], reais(x[1])])]
    };
  });
}
