// Ponto de entrada do painel.
import { abertura } from "./abertura.js";
import { preencherCidades, iniciarComparacao } from "./comparar.js";
import { historias } from "./historias.js";
import { kpis, montarAbas, graficosExplorar, abrirAba } from "./explorar.js";
import { GRAFICOS, desenhar } from "./graficos.js";
import { iniciarRegistro } from "./registro.js";
import { iniciarAcessibilidade } from "./acessibilidade.js";

const LINK_CODIGO = "https://github.com/hwluands/mondai-em-numeros";

abertura();
preencherCidades();
kpis();
iniciarRegistro();
iniciarComparacao();

if (window.Chart) {
  historias();
  montarAbas();
  graficosExplorar();
  GRAFICOS.filter(g => !g.painel).forEach(desenhar);
  abrirAba("pessoas");
} else {
  document.getElementById("capitulos").innerHTML = '<p class="card">Não foi possível carregar a biblioteca de gráficos. Recarregue a página.</p>';
}

iniciarAcessibilidade();
document.getElementById("linkCodigo").href = LINK_CODIGO;
