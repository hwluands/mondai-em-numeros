// Página de registros (admin.html): entra com a senha do ADMIN_TOKEN e lê a API /api/registros.
const CHAVE = "mondai-admin";
const guardar = {
  ler() { try { return sessionStorage.getItem(CHAVE); } catch (e) { return null; } },
  salvar(s) { try { sessionStorage.setItem(CHAVE, s); } catch (e) {} },
  apagar() { try { sessionStorage.removeItem(CHAVE); } catch (e) {} }
};
let senha = guardar.ler();
let registros = [];
let grafico = null;

const dataHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const dia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
const diaChave = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
const NOMES_TIPO = { acesso: "Acesso", retorno: "Retorno", opiniao: "Opinião" };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function api(caminho) {
  const r = await fetch(caminho, { headers: { Authorization: "Bearer " + senha } });
  if (r.status === 401) throw new Error("Senha incorreta.");
  if (!r.ok) throw new Error("A API respondeu com erro " + r.status + ".");
  return r;
}

async function carregar() {
  const erro = document.getElementById("erro");
  erro.hidden = true;
  try {
    registros = await (await api("/api/registros")).json();
  } catch (e) {
    guardar.apagar();
    senha = null;
    erro.textContent = e.message;
    erro.hidden = false;
    document.getElementById("formEntrar").hidden = false;
    document.getElementById("area").hidden = true;
    return;
  }
  document.getElementById("formEntrar").hidden = true;
  document.getElementById("area").hidden = false;
  mostrar();
}

function mostrar() {
  const identificados = new Map();
  registros.filter(r => r.nome).forEach(r => identificados.set(r.visitante, r));
  const pessoas = new Set(registros.map(r => r.visitante)).size;
  const deMondai = [...identificados.values()].filter(r => r.cidade === "Mondaí").length;
  const cidades = new Map();
  identificados.forEach(r => cidades.set(r.cidade, (cidades.get(r.cidade) || 0) + 1));
  const opinioes = registros.filter(r => r.tipo === "opiniao");
  const media = opinioes.length ? opinioes.reduce((s, r) => s + r.nota, 0) / opinioes.length : null;

  const numeros = [
    ["Pessoas (navegadores)", pessoas], ["Identificadas", identificados.size], ["De Mondaí", deMondai],
    ["Cidades", cidades.size], ["Opiniões", opinioes.length],
    ["Nota média", media === null ? "–" : media.toLocaleString("pt-BR", { maximumFractionDigits: 1 })]
  ];
  document.getElementById("numeros").innerHTML = numeros.map(([r, v]) => '<div class="num"><span>' + r + "</span><strong>" + v + "</strong></div>").join("");

  document.getElementById("cidades").innerHTML = cidades.size
    ? "<table><thead><tr><th>Cidade</th><th>Pessoas</th></tr></thead><tbody>" +
      [...cidades.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => "<tr><td>" + esc(c) + "</td><td>" + n + "</td></tr>").join("") + "</tbody></table>"
    : '<p class="vazio">Ninguém se identificou ainda.</p>';

  const porDia = new Map();
  registros.filter(r => r.tipo !== "opiniao").forEach(r => {
    const k = diaChave.format(new Date(r.criado_em));
    porDia.set(k, (porDia.get(k) || 0) + 1);
  });
  const dias = [...porDia.keys()].sort();
  if (grafico) grafico.destroy();
  if (window.Chart) {
    grafico = new Chart(document.getElementById("porDia"), {
      type: "bar",
      data: { labels: dias.map(d => dia.format(new Date(d + "T12:00:00Z"))), datasets: [{ data: dias.map(d => porDia.get(d)), backgroundColor: getComputedStyle(document.body).getPropertyValue("--c1").trim() }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
  }

  const filtro = document.getElementById("filtro").value;
  const linhas = registros.filter(r => !filtro || r.tipo === filtro);
  document.getElementById("tituloTabela").textContent = "Registros (" + linhas.length + ")";
  document.getElementById("tabela").innerHTML = linhas.length
    ? "<table><thead><tr><th>Data e hora</th><th>Tipo</th><th>Nome</th><th>Cidade</th><th>Nota</th><th>Comentário</th></tr></thead><tbody>" +
      linhas.map(r => "<tr><td>" + dataHora.format(new Date(r.criado_em)) + '</td><td><span class="tag ' + r.tipo + '">' + NOMES_TIPO[r.tipo] + "</span></td><td>" +
        (r.nome ? esc(r.nome) : '<span class="vazio">sem identificação</span>') + "</td><td>" + esc(r.cidade) + "</td><td>" + (r.nota ?? "") + "</td><td>" + esc(r.comentario) + "</td></tr>").join("") +
      "</tbody></table>"
    : '<p class="vazio">Nenhum registro ainda.</p>';
}

document.getElementById("formEntrar").addEventListener("submit", e => {
  e.preventDefault();
  senha = document.getElementById("senha").value;
  guardar.salvar(senha);
  carregar();
});
document.getElementById("atualizar").addEventListener("click", carregar);
document.getElementById("filtro").addEventListener("change", mostrar);
document.getElementById("sair").addEventListener("click", () => { guardar.apagar(); location.reload(); });
document.getElementById("baixar").addEventListener("click", async () => {
  try {
    const blob = await (await api("/api/registros?formato=csv")).blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "registros_mondai_em_numeros.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (e) { alert(e.message); }
});

if (senha) carregar();
