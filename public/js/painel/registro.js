// Registro de acesso e opinião, enviado para a API do próprio site (functions/api/registro.js),
// que grava com data e hora do servidor.
import { MUN } from "./dados.js";
import { int } from "./formato.js";
import { personalizar } from "./comparar.js";

// O navegador guarda um código aleatório, o nome e a cidade, para não pedir de novo.
// O código permite contar pessoas sem depender do nome digitado.
const CHAVE = "mondai-visitante";
const novoId = () => crypto.randomUUID ? crypto.randomUUID()
  : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
let idSessao = null;
const visitante = {
  ler() { try { return JSON.parse(localStorage.getItem(CHAVE)); } catch (e) { return null; } },
  id() {
    const salvo = visitante.ler();
    return (salvo && salvo.id) || idSessao || (idSessao = novoId());
  },
  salvar(dados) {
    const v = Object.assign({ id: visitante.id() }, dados);
    try { localStorage.setItem(CHAVE, JSON.stringify(v)); } catch (e) {}
    return v;
  }
};

// Devolve true se a API gravou o registro.
function registrar(dados) {
  return fetch("/api/registro", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({ visitante: visitante.id() }, dados)),
    keepalive: true
  }).then(r => r.ok).catch(() => false);
}

// "mondai", "MONDAI" e "Mondaí" viram o nome oficial, para a contagem por cidade não se dividir.
const semAcento = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const NOMES_OFICIAIS = Object.fromEntries(Object.values(MUN).map(m => [semAcento(m.nome), m.nome]));
const cidadeOficial = texto => NOMES_OFICIAIS[semAcento(texto)] || texto.replace(/\s+/g, " ").trim();

const portao = document.getElementById("portao");
function abrirPortao() {
  portao.hidden = false;
  document.body.classList.add("travado");
  document.getElementById("p-nome").focus();
}
function fecharPortao() {
  portao.hidden = true;
  document.body.classList.remove("travado");
  document.getElementById("manchete").setAttribute("tabindex", "-1");
  document.getElementById("manchete").focus({ preventScroll: true });
}

function mostrarContador() {
  fetch("/api/resumo").then(r => r.ok ? r.json() : null).then(r => {
    if (!r || !r.pessoas) return;
    const el = document.getElementById("contador");
    el.textContent = int.format(r.pessoas) + (r.pessoas === 1 ? " pessoa já viu" : " pessoas já viram") + " estes números" +
      (r.cidades ? ", de " + int.format(r.cidades) + (r.cidades === 1 ? " cidade" : " cidades") : "");
    el.hidden = false;
  }).catch(() => {});
}

export function iniciarRegistro() {
  document.getElementById("portaoForm").addEventListener("submit", e => {
    e.preventDefault();
    const nome = document.getElementById("p-nome").value.replace(/\s+/g, " ").trim();
    const cidade = cidadeOficial(document.getElementById("p-cidade").value);
    if (!nome || !cidade) return;
    visitante.salvar({ nome, cidade });
    registrar({ tipo: "acesso", nome, cidade });
    personalizar(cidade);
    fecharPortao();
  });

  document.getElementById("opForm").addEventListener("submit", async e => {
    e.preventDefault();
    const v = visitante.ler() || {};
    const nota = (document.querySelector("input[name=nota]:checked") || {}).value;
    const botao = e.target.querySelector("button[type=submit]");
    botao.disabled = true;
    document.getElementById("op-erro").hidden = true;
    const ok = await registrar({ tipo: "opiniao", nome: v.nome, cidade: v.cidade, nota: Number(nota), comentario: document.getElementById("op-com").value.trim() });
    document.getElementById(ok ? "op-ok" : "op-erro").hidden = false;
    if (!ok) botao.disabled = false;
  });

  let conhecido = visitante.ler();
  if (conhecido && !conhecido.id) conhecido = visitante.salvar(conhecido);
  if (conhecido && conhecido.nome && conhecido.cidade) {
    registrar({ tipo: "retorno", nome: conhecido.nome, cidade: conhecido.cidade });
    personalizar(conhecido.cidade);
  } else {
    personalizar(null);
    abrirPortao();
  }
  mostrarContador();
}
