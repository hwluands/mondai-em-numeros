// As histórias: título, texto e figura numerada. Os números dos textos vêm dos dados.
import { P, IND as I, S, MUN, esgM, esgSC, precario } from "./dados.js";
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

  // 3. Campo: rebanhos entre os maiores de SC, mas pouco peso na economia, onde a indústria domina
  const su = I.suinos, le = I.leite, agro = I.pct_agro;
  capitulo(3, {
    tema: "Campo",
    titulo: "Rebanhos e leite entre os maiores de SC, mas a economia gira na indústria",
    texto: "Em " + su.ano + ", Mondaí tinha o " + su.maior_sc + "º maior rebanho de suínos de Santa Catarina (" + int.format(Math.round(su.mondai / 1000)) +
      " mil cabeças) e a " + le.maior_sc + "ª maior produção de leite (" + d1.format(le.mondai / 1000) + " milhões de litros). Mesmo assim, a agropecuária respondia por " +
      Math.round(agro.mondai) + "% do valor produzido em " + agro.ano + ", contra " + Math.round(agro.mediana_sc) + "% na mediana das cidades catarinenses e " +
      Math.round(agro.mediana_regiao) + "% na da região. Na conta da economia, a indústria pesa mais.",
    figura: "Mondaí entre as cidades de SC em três rankings, da maior para a menor.",
    fonte: "IBGE, Pesquisa da Pecuária Municipal " + su.ano + " e PIB dos Municípios " + agro.ano
  }, () => ({
    html: '<p class="ranking-titulo"><b>Rebanho de suínos, ' + su.ano + "</b></p>" +
      ranking("suinos", { altura: 70, rotulo: "Rebanho de suínos: Mondaí é a " + su.maior_sc + "ª de " + su.total_sc }) +
      '<p class="ranking-titulo"><b>Produção de leite, ' + le.ano + "</b></p>" +
      ranking("leite", { altura: 70, rotulo: "Produção de leite: Mondaí é a " + le.maior_sc + "ª de " + le.total_sc }) +
      '<p class="ranking-titulo"><b>Peso da agropecuária na economia, ' + agro.ano + "</b></p>" +
      ranking("pct_agro", { altura: 70, rotulo: "Peso da agropecuária: Mondaí é a " + agro.maior_sc + "ª de " + agro.total_sc }),
    tabela: [["Indicador", "Mondaí", "Posição em SC", "Mediana de SC"], [
      ["Rebanho de suínos (" + su.ano + ")", int.format(su.mondai) + " cabeças", su.maior_sc + "º", int.format(su.mediana_sc) + " cabeças"],
      ["Produção de leite (" + le.ano + ")", d1.format(le.mondai / 1000) + " mi de litros", le.maior_sc + "º", d1.format(le.mediana_sc / 1000) + " mi de litros"],
      ["Peso da agropecuária (" + agro.ano + ")", d1.format(agro.mondai) + "%", agro.maior_sc + "º", d1.format(agro.mediana_sc) + "%"]]]
  }));

  // 4. População. Médias de 3 anos, porque um ano isolado com ~100 nascimentos oscila muito.
  const ini = S.vitais.slice(0, 3), fim = S.vitais.slice(-3);
  const media = (a, k) => a.reduce((s, x) => s + x[k], 0) / a.length;
  const per = a => a[0].ano + " a " + a[a.length - 1].ano;
  const v0 = S.vitais[0], v1 = S.vitais[S.vitais.length - 1];
  const estimativas = S.populacao.filter(x => x.tipo === "Estimativa");
  const env = I.envelhecimento;
  const nascemMais = media(fim, "nascimentos") > media(fim, "obitos");
  capitulo(4, {
    tema: "População",
    titulo: nascemMais ? "Ainda nascem mais pessoas do que morrem, mas a diferença diminuiu" : "Hoje morrem mais pessoas do que nascem",
    texto: "De " + per(fim) + ", foram em média " + int.format(media(fim, "nascimentos")) + " nascimentos e " + int.format(media(fim, "obitos")) +
      " óbitos por ano. De " + per(ini) + ", eram " + int.format(media(ini, "nascimentos")) + " e " + int.format(media(ini, "obitos")) +
      ": os nascimentos se mantiveram e os óbitos aumentaram. A cidade envelhece, mas menos que a região: no Censo de " + env.ano + ", havia " +
      int.format(env.mondai) + " pessoas de 60 anos ou mais para cada 100 de até 14 anos, contra " + int.format(env.mediana_regiao) +
      " na mediana da região e " + int.format(env.mediana_sc) + " na de SC. Depois do Censo, as estimativas do IBGE ficam estáveis, entre " +
      int.format(Math.min(...estimativas.map(x => x.valor))) + " e " + int.format(Math.max(...estimativas.map(x => x.valor))) + " moradores.",
    figura: "Nascimentos e óbitos de moradores de Mondaí, por ano.",
    fonte: "IBGE, Registro Civil, Censo Demográfico 2022 e Estimativas de População"
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
