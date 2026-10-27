// GET /api/registros: lista todos os registros para a página admin.
// Exige o cabeçalho "Authorization: Bearer <senha>", com a senha guardada no segredo ADMIN_TOKEN.
// Com ?formato=csv, devolve uma planilha pronta para abrir no Excel.
import { bloqueado, contar, muitasTentativas } from "../../lib/limite.js";

async function senhaConfere(recebida, correta) {
  const cod = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", cod.encode(recebida)),
    crypto.subtle.digest("SHA-256", cod.encode(correta)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

const brasilia = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
});

// Texto digitado por visitantes que começa com =, +, - ou @ viraria fórmula ao abrir no Excel.
// O apóstrofo na frente faz a planilha mostrar o texto como texto.
const neutralizarFormula = t => /^[=+\-@\t\r]/.test(t) ? "'" + t : t;

export function csv(linhas) {
  const colunas = ["id", "data_hora_brasilia", "tipo", "nome", "cidade", "nota", "comentario", "visitante"];
  const livres = new Set(["nome", "cidade", "comentario"]);
  const celula = (v, coluna) => {
    let t = v === null || v === undefined ? "" : String(v);
    if (livres.has(coluna)) t = neutralizarFormula(t);
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const corpo = linhas.map(l => colunas.map(c =>
    celula(c === "data_hora_brasilia" ? brasilia.format(new Date(l.criado_em)).replace(", ", " ") : l[c], c)).join(";"));
  return "﻿" + [colunas.join(";"), ...corpo].join("\n") + "\n";
}

// Cinco senhas erradas pelo mesmo IP bloqueiam a entrada por 15 minutos.
export const LIMITE = { maximo: 5, janela: 15 * 60 };

export async function onRequestGet({ request, env }) {
  const espera = await bloqueado(request, env, "admin", LIMITE);
  if (espera) return muitasTentativas(espera);

  const senha = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!env.ADMIN_TOKEN || !senha || !(await senhaConfere(senha, env.ADMIN_TOKEN))) {
    await contar(request, env, "admin");
    return new Response(JSON.stringify({ erro: "senha inválida" }), {
      status: 401, headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const { results } = await env.DB.prepare(
    "SELECT id, criado_em, tipo, nome, cidade, nota, comentario, visitante FROM registros ORDER BY id DESC"
  ).all();

  if (new URL(request.url).searchParams.get("formato") === "csv") {
    return new Response(csv(results), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="registros_mondai_em_numeros.csv"',
        "Cache-Control": "no-store",
      },
    });
  }
  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
