// Aplica o tema salvo antes de desenhar a página, para não piscar. O padrão é claro.
// Fica num arquivo próprio (e não dentro do HTML) para a política de segurança (_headers) não precisar liberar scripts embutidos.
try { if (localStorage.getItem("mondai-tema") === "escuro") document.documentElement.dataset.tema = "escuro"; } catch (e) {}
