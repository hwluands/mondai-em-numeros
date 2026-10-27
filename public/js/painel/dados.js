// Dados do painel. dados/painel.js, gerado por pipeline/coleta.py, define window.PAINEL antes dos módulos.

export const P = window.PAINEL;
export const IND = P.indicadores;
export const MUN = P.municipios;
export const S = P.series;
export const M = MUN[P.mondai];
export const VIZ = P.vizinhos;

export const nomeDe = id => MUN[id].nome;
export const idDe = nome => Object.keys(MUN).find(id => MUN[id].nome === nome);

// Esgoto de Mondaí e de SC. Pelo critério do Plansab, rede geral e fossa séptica (ligada ou não à rede)
// são adequadas; o resto é precário.
export const esgM = S.esgoto["Mondaí"], esgSC = S.esgoto["Santa Catarina"];
export const precario = e => 100 - e["Rede geral ou fossa ligada à rede"] - e["Fossa séptica não ligada à rede"];
