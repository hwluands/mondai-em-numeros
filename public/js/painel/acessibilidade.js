// Letra ajustável (A−/A+), alto contraste e tema claro ou escuro (o claro é o padrão).
import { GRAFICOS, desenhar } from "./graficos.js";
import { redesenharDuelo } from "./comparar.js";

const CHAVE_TEMA = "mondai-tema";

// Os gráficos do Chart.js leem as cores no momento em que são desenhados.
function redesenharTudo() {
  GRAFICOS.filter(g => g.chart).forEach(desenhar);
  redesenharDuelo();
}

function mostrarTema(botao) {
  const escuro = document.documentElement.dataset.tema === "escuro";
  // O botão mostra o tema para o qual vai mudar.
  const acao = escuro ? "Mudar para o tema claro" : "Mudar para o tema escuro";
  botao.querySelector(".rotulo").textContent = escuro ? "Claro" : "Escuro";
  botao.setAttribute("aria-label", acao);
  botao.title = acao;
  document.querySelector('meta[name="theme-color"]').content = escuro ? "#0e0f0e" : "#fbfbf9";
}

export function iniciarAcessibilidade() {
  let base = 16;
  const menos = document.getElementById("fonteMenos"), mais = document.getElementById("fonteMais");
  const fonte = () => {
    document.documentElement.style.setProperty("--base", base + "px");
    // Nos limites, o botão fica desativado para mostrar que não dá para ir além.
    menos.disabled = base <= 12;
    mais.disabled = base >= 24;
    GRAFICOS.forEach(g => g.chart && g.chart.resize());
  };
  document.getElementById("fonteMais").addEventListener("click", () => { base = Math.min(24, base + 2); fonte(); });
  document.getElementById("fonteMenos").addEventListener("click", () => { base = Math.max(12, base - 2); fonte(); });
  document.getElementById("contraste").addEventListener("click", e => {
    const ativo = document.body.classList.toggle("contraste");
    e.currentTarget.setAttribute("aria-pressed", String(ativo));
    redesenharTudo();
  });

  const botaoTema = document.getElementById("tema");
  mostrarTema(botaoTema);
  botaoTema.addEventListener("click", () => {
    const escuro = document.documentElement.dataset.tema !== "escuro";
    if (escuro) document.documentElement.dataset.tema = "escuro";
    else delete document.documentElement.dataset.tema;
    try { localStorage.setItem(CHAVE_TEMA, escuro ? "escuro" : "claro"); } catch (e) {}
    mostrarTema(botaoTema);
    redesenharTudo();
  });
}
