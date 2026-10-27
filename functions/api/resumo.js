// GET /api/resumo: números públicos para o contador do painel, sem nenhum nome.

export async function onRequestGet({ env }) {
  const r = await env.DB.prepare(`
    SELECT
      COUNT(DISTINCT visitante) AS pessoas,
      COUNT(DISTINCT CASE WHEN nome IS NOT NULL THEN visitante END) AS identificadas,
      COUNT(DISTINCT CASE WHEN cidade = 'Mondaí' THEN visitante END) AS de_mondai,
      COUNT(DISTINCT CASE WHEN cidade IS NOT NULL THEN cidade END) AS cidades,
      COUNT(CASE WHEN tipo = 'opiniao' THEN 1 END) AS opinioes
    FROM registros
  `).first();

  return new Response(JSON.stringify(r), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=60" },
  });
}
