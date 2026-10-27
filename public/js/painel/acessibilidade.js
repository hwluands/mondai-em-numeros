// Letra ajustável (A−/A+), alto contraste e tema claro ou escuro (o escuro é o padrão).
import { GRAFICOS, desenhar } from "./graficos.js";
import { redesenharDuelo } from "./comparar.js";

const CHAVE_TEMA = "mondai-tema";

// Os gráficos do Chart.js leem as cores no momento em que são desenhados.
function redesenharTudo() {
  GRAFICOS.filter(g => g.chart).forEach(desenhar);
  redesenharDuelo();
}

function mostrarTema(botao) {
  const claro = document.documentElement.dataset.tema === "claro";
  botao.textContent = claro ? "Tema escuro" : "Tema claro";
  botao.setAttribute("aria-pressed", String(claro));
  document.querySelector('meta[name="theme-color"]').content = claro ? "#fbfbf9" : "#0e0f0e";
}

export function iniciarAcessibilidade() {
  let base = 16;
  const fonte = () => { document.documentElement.style.setProperty("--base", base + "px"); GRAFICOS.forEach(g => g.chart && g.chart.resize()); };
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
    const claro = document.documentElement.dataset.tema !== "claro";
    if (claro) document.documentElement.dataset.tema = "claro";
    else delete document.documentElement.dataset.tema;
    try { localStorage.setItem(CHAVE_TEMA, claro ? "claro" : "escuro"); } catch (e) {}
    mostrarTema(botaoTema);
    redesenharTudo();
  });
}
