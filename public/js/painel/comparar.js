// "Sua cidade": Mondaí lado a lado com a cidade de quem visita, ou qualquer outra de SC.
import { P, IND as I, MUN, M, idDe } from "./dados.js";
import { d1, fmt } from "./formato.js";
import { cor } from "./graficos.js";

// Fora a população, tudo é por habitante ou porcentagem, para comparar cidades de tamanhos diferentes.
const DUELO = ["pop2026", "pib_pc", "salario_rs", "empresas_mil", "ocupados_100", "superior", "esgoto_adequado", "suinos_hab"];

export function preencherCidades() {
  const opcoes = Object.entries(MUN).filter(([id]) => id !== P.mondai).sort((a, b) => a[1].nome.localeCompare(b[1].nome, "pt-BR"));
  document.getElementById("selCidade").innerHTML = opcoes.map(([id, m]) => '<option value="' + id + '">' + m.nome + "</option>").join("");
  document.getElementById("lista-cidades").innerHTML = Object.values(MUN).map(m => m.nome)
    .sort((a, b) => a.localeCompare(b, "pt-BR")).map(n => '<option value="' + n + '">').join("");
}

let introAtual = "";
export function duelo(outra, intro) {
  introAtual = intro;
  const O = MUN[outra];
  document.getElementById("selCidade").value = outra;
  document.getElementById("nomeOutra").textContent = O.nome;
  document.getElementById("introDuelo").textContent = intro + " Fora a população, os indicadores são por habitante ou em porcentagem, para comparar cidades de tamanhos diferentes.";
  document.getElementById("duelo").innerHTML = DUELO.map(k => {
    const a = M[k], b = O[k];
    const max = Math.max(a || 0, b || 0) || 1;
    const linha = (nome, v, c) => '<div class="par"><span class="nome">' + nome + '</span><span class="barra"><i style="width:' +
      ((v || 0) / max * 100) + "%;background:" + cor(c) + '"></i></span><b>' + fmt(k, v) + "</b></div>";
    let veredito = "";
    if (I[k].unidade === "%" && a !== null && b !== null) {
      // Porcentagens se comparam pela diferença em pontos, não pela razão.
      const dif = a - b;
      veredito = Math.abs(dif) < 0.5 ? "Praticamente iguais." : (dif > 0 ? "Mondaí" : O.nome) + " tem " + d1.format(Math.abs(dif)) + " pontos percentuais a mais.";
    } else if (a && b) {
      const r = a / b;
      veredito = Math.abs(r - 1) < 0.05 ? "Praticamente iguais." : r > 1 ? "Mondaí tem " + d1.format(r) + "× o valor de " + O.nome + "."
        : O.nome + " tem " + d1.format(1 / r) + "× o valor de Mondaí.";
    }
    return '<div class="card linha-duelo"><h3>' + I[k].rotulo + ' <span class="ano">· ' + I[k].ano + "</span></h3>" +
      linha("Mondaí", a, "c1") + linha(O.nome, b, "c4") + '<p class="veredito">' + veredito + "</p></div>";
  }).join("");
}

// Redesenha com as cores atuais (ao trocar o contraste).
export const redesenharDuelo = () => duelo(document.getElementById("selCidade").value, introAtual);

export function personalizar(cidade) {
  const chapeco = idDe("Chapecó");
  const id = cidade ? idDe(cidade) : null;
  if (id && id !== P.mondai) duelo(id, "Você mora em " + cidade + ". Veja como a sua cidade e Mondaí se comparam, ou escolha outra cidade.");
  else if (id === P.mondai) duelo(chapeco, "Você mora em Mondaí. Veja como a cidade se compara com Chapecó, o centro da região, ou escolha outra.");
  else if (cidade) duelo(chapeco, "Não encontramos " + cidade + " entre as cidades de Santa Catarina. Escolha uma cidade catarinense para comparar.");
  else duelo(chapeco, "Escolha uma cidade de Santa Catarina para comparar com Mondaí.");
}

export function iniciarComparacao() {
  document.getElementById("selCidade").addEventListener("change", e => duelo(e.target.value, "Comparação escolhida por você."));
}
