// Limite de tentativas por IP, guardado no próprio D1 (tabela "tentativas").
// O IP nunca é gravado: vira um HMAC com o segredo ADMIN_TOKEN, impossível de reverter sem ele.
// As linhas somem depois de uma hora.

const GUARDA = 3600;

async function chaveDe(request, env, rota) {
  const ip = request.headers.get("CF-Connecting-IP") || "sem-ip";
  const cod = new TextEncoder();
  const chave = await crypto.subtle.importKey("raw", cod.encode(env.ADMIN_TOKEN || "sem-segredo"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const assinatura = new Uint8Array(await crypto.subtle.sign("HMAC", chave, cod.encode(ip)));
  return rota + ":" + [...assinatura.slice(0, 12)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// Devolve quantos segundos faltam para liberar (0 quando ainda pode tentar).
// Se o banco falhar, libera: o limite protege o site, não pode derrubá-lo.
export async function bloqueado(request, env, rota, { maximo, janela }, agora = Date.now()) {
  try {
    const s = Math.floor(agora / 1000);
    const r = await env.DB.prepare("SELECT COUNT(*) AS n, MIN(criado_em) AS primeira FROM tentativas WHERE chave = ? AND criado_em > ?")
      .bind(await chaveDe(request, env, rota), s - janela).first();
    return r && r.n >= maximo ? Math.max(1, r.primeira + janela - s) : 0;
  } catch (erro) {
    console.error("limite: leitura falhou", erro);
    return 0;
  }
}

export async function contar(request, env, rota, agora = Date.now()) {
  try {
    const s = Math.floor(agora / 1000);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO tentativas (chave, criado_em) VALUES (?, ?)").bind(await chaveDe(request, env, rota), s),
      env.DB.prepare("DELETE FROM tentativas WHERE criado_em < ?").bind(s - GUARDA),
    ]);
  } catch (erro) {
    console.error("limite: gravação falhou", erro);
  }
}

export function muitasTentativas(segundos) {
  return new Response(JSON.stringify({ erro: "muitas tentativas", tente_em_segundos: segundos }), {
    status: 429,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Retry-After": String(segundos) },
  });
}
