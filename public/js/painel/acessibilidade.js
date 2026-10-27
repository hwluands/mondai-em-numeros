// Letra ajustável (A−/A+) e modo de alto contraste.
import { GRAFICOS, desenhar } from "./graficos.js";
import { redesenharDuelo } from "./comparar.js";

export function iniciarAcessibilidade() {
  let base = 16;
  const fonte = () => { document.documentElement.style.setProperty("--base", base + "px"); GRAFICOS.forEach(g => g.chart && g.chart.resize()); };
  document.getElementById("fonteMais").addEventListener("click", () => { base = Math.min(24, base + 2); fonte(); });
  document.getElementById("fonteMenos").addEventListener("click", () => { base = Math.max(12, base - 2); fonte(); });
  document.getElementById("contraste").addEventListener("click", e => {
    const ativo = document.body.classList.toggle("contraste");
    e.currentTarget.setAttribute("aria-pressed", String(ativo));
    GRAFICOS.filter(g => g.chart).forEach(desenhar);
    redesenharDuelo();
  });
}
