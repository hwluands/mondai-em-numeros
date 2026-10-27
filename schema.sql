-- Registros do painel Mondaí em Números: acessos, retornos e opiniões.
-- O servidor grava a data e a hora (UTC); a página admin mostra no horário de Brasília.
CREATE TABLE IF NOT EXISTS registros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  tipo TEXT NOT NULL CHECK (tipo IN ('acesso', 'retorno', 'opiniao')),
  visitante TEXT NOT NULL,          -- código aleatório do navegador, para contar pessoas sem depender do nome
  nome TEXT,                        -- vazio quando a pessoa entra sem se identificar
  cidade TEXT,
  nota INTEGER CHECK (nota BETWEEN 1 AND 5),
  comentario TEXT
);

CREATE INDEX IF NOT EXISTS idx_registros_criado_em ON registros (criado_em);
CREATE INDEX IF NOT EXISTS idx_registros_visitante ON registros (visitante);
