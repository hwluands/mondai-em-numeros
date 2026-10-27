"""Auditoria dos números do painel Mondaí em Números.

Refaz, por um caminho independente, os números que aparecem no site:
  1. porcentagens recalculadas a partir das contagens absolutas do IBGE;
  2. somas que precisam fechar (pirâmide = população, setores = ocupados, áreas = despesa total);
  3. indicadores por habitante recalculados;
  4. posições no ranking recalculadas a partir dos 295 municípios;
  5. comparação com os valores e posições publicados no IBGE Cidades.

Uso: python auditoria.py   (depois do coleta.py)
Saída: public/dados/auditoria.txt. Termina com erro se algum item não conferir.
"""

import json
import sys
import time
from pathlib import Path

from coleta import MONDAI, SICONFI, TOTAL_COR, TOTAL_IDADE_58, TOTAL_SEXO, UF, baixar, consulta, ler

PASTA = Path(__file__).parent / "public" / "dados"
texto = (PASTA / "painel.js").read_text(encoding="utf-8")
DADOS = json.loads(texto[texto.index("=") + 1:].strip().rstrip(";"))
I, MUN, S = DADOS["indicadores"], DADOS["municipios"], DADOS["series"]
LOCAIS = {"Mondaí": f"n6/{MONDAI}", "Santa Catarina": UF}

saida, falhas = [], 0


def populacao(ano):
    linhas = ler(consulta(6579, 9324, "População residente estimada", ano), f"n6/{MONDAI}")
    return linhas[0]["valor"]


POP = {2024: populacao(2024), 2025: populacao(2025)}


def titulo(t):
    saida.append(f"\n## {t}")


def confere(descricao, painel, independente, tolerancia=0.01):
    global falhas
    ok = painel is not None and independente is not None and abs(painel - independente) <= tolerancia
    falhas += not ok
    saida.append(f"[{'ok' if ok else 'FALHA'}] {descricao}: painel {painel} | conferência {round(independente, 4) if independente is not None else None}")


def contagens(c, local, classe):
    return {l["cats"][classe]: l["valor"] for l in ler(c, local)}


def porcentagens(c, local, classe, total, rotulos):
    v = contagens(c, local, classe)
    return {rotulo: (v.get(cat) or 0) / v[total] * 100 for cat, rotulo in rotulos.items()}


# ---------------------------------------------------------------- 1. porcentagens a partir das contagens

titulo("1. Porcentagens refeitas a partir das contagens absolutas do Censo 2022")

esgoto = {46290: "Rede geral ou fossa ligada à rede", 72112: "Fossa séptica não ligada à rede",
          72113: "Fossa rudimentar ou buraco", 92858: "Vala", 72114: "Rio, lago ou córrego",
          72115: "Outra forma", 92861: "Sem banheiro nem sanitário"}
c = consulta(9397, 382, "Moradores em domicílios particulares permanentes ocupados", 2022,
             (11558, {46292: "Total", 46290: "Rede geral, rede pluvial ou fossa ligada", 72112: "Fossa séptica ou fossa filtro não ligada",
                      72113: "Fossa rudimentar", 92858: "Vala", 72114: "Rio, lago", 72115: "Outra forma",
                      92861: "Não tinham banheiro"}, "esgotamento sanitário"),
             (458, {72117: "Total"}, "banheiro"), TOTAL_IDADE_58, TOTAL_COR)
for nome, local in LOCAIS.items():
    p = porcentagens(c, local, 11558, 46292, esgoto)
    for rotulo, valor in p.items():
        confere(f"Esgoto, {nome}, {rotulo}", S["esgoto"][nome][rotulo], valor)
    if nome == "Mondaí":
        confere("Indicador 'moradores ligados à rede de esgoto'", I["esgoto_rede"]["mondai"], p["Rede geral ou fossa ligada à rede"])
        confere("Indicador 'esgoto adequado (Plansab)' = rede + fossa séptica", I["esgoto_adequado"]["mondai"],
                p["Rede geral ou fossa ligada à rede"] + p["Fossa séptica não ligada à rede"], 0.02)

agua = {72144: "Rede geral", 72145: "Rede geral, mas usa outra fonte", 72153: "Sem ligação à rede"}
c = consulta(9850, 382, "Moradores em domicílios particulares permanentes ocupados", 2022,
             (1821, {72129: "Total", 72144: "Possui ligação à rede geral e a utiliza", 72145: "Possui ligação à rede geral, mas",
                     72153: "Não possui ligação"}, "ligação à rede geral"),
             (125, {2932: "Total"}, "Tipo de domicílio"), (1817, {72125: "Total"}, "canalização"), (458, {72117: "Total"}, "banheiro"),
             TOTAL_IDADE_58, (2661, {32776: "Total"}, "Localização do domicílio"))
for nome, local in LOCAIS.items():
    p = porcentagens(c, local, 1821, 72129, agua)
    for rotulo, valor in p.items():
        confere(f"Água, {nome}, {rotulo}", S["agua"][nome][rotulo], valor)
    if nome == "Mondaí":
        confere("Indicador 'moradores ligados à rede de água'", I["agua_rede"]["mondai"], p["Rede geral"] + p["Rede geral, mas usa outra fonte"], 0.02)

lixo = {72120: "Coletado na porta", 72121: "Caçamba de coleta", 72122: "Queimado na propriedade",
        72123: "Enterrado na propriedade", 72124: "Terreno baldio ou área pública", 1091: "Outro destino"}
c = consulta(9541, 382, "Moradores em domicílios particulares permanentes ocupados", 2022,
             (67, {10972: "Total", 72120: "Coletado no domicílio", 72121: "Depositado em caçamba", 72122: "Queimado",
                   72123: "Enterrado", 72124: "Jogado em terreno baldio", 1091: "Outro destino"}, "Destino do lixo"),
             TOTAL_IDADE_58, TOTAL_COR)
for nome, local in LOCAIS.items():
    p = porcentagens(c, local, 67, 10972, lixo)
    for rotulo, valor in p.items():
        confere(f"Lixo, {nome}, {rotulo}", S["lixo"][nome][rotulo], valor)
    if nome == "Mondaí":
        confere("Indicador 'moradores com lixo coletado'", I["lixo_coletado"]["mondai"], p["Coletado na porta"] + p["Caçamba de coleta"], 0.02)

niveis = {9493: "Sem instrução ou fundamental incompleto", 9494: "Fundamental completo",
          9495: "Médio completo", 99713: "Superior completo"}
c = consulta(10061, 2667, "Pessoas de 18 anos ou mais de idade", 2022,
             (1568, {120704: "Total", 9493: "Sem instrução", 9494: "Fundamental completo", 9495: "Médio completo",
                     99713: "Superior completo"}, "Nível de instrução"), TOTAL_IDADE_58, TOTAL_SEXO, TOTAL_COR)
for nome, local in LOCAIS.items():
    p = porcentagens(c, local, 1568, 120704, niveis)
    for rotulo, valor in p.items():
        confere(f"Instrução, {nome}, {rotulo}", S["instrucao"][nome][rotulo], valor)
    if nome == "Mondaí":
        confere("Indicador 'adultos com ensino superior completo'", I["superior"]["mondai"], p["Superior completo"])

c = consulta(9542, 950, "Pessoas de 15 anos ou mais de idade", 2022,
             (59, {93024: "Total", 1023: "Alfabetizadas"}, "Alfabetização"), TOTAL_SEXO, TOTAL_COR, (287, {100362: "Total"}, "Idade"))
v = contagens(c, LOCAIS["Mondaí"], 59)
confere("Alfabetização de Mondaí (alfabetizadas ÷ total)", I["alfabetizacao"]["mondai"], v[1023] / v[93024] * 100)

sit = S["situacao"]["Mondaí"]
confere("População urbana de Mondaí (urbana ÷ total)", I["urbana"]["mondai"], sit["Urbana"] / (sit["Urbana"] + sit["Rural"]) * 100)

# ---------------------------------------------------------------- 2. somas

titulo("2. Somas que precisam fechar")
pir = S["piramide"]["Mondaí"]
confere("Pirâmide etária somada = população do Censo 2022", I["pop2022"]["mondai"], sum(pir["homens"]) + sum(pir["mulheres"]), 0)
confere("Empregos por setor somados = pessoal ocupado 2024", I["ocupados"]["mondai"], sum(x["pessoas"] or 0 for x in S["setores"]), 0)
pf = DADOS["prefeitura"]
liquidadas = {d["conta"]: d["valor"] for d in baixar(SICONFI.format(pf["ano"], MONDAI))["items"] if d["coluna"] == "Despesas Liquidadas"}
total = liquidadas["Despesas Exceto Intraorçamentárias"]
confere(f"Despesas por área somadas = total liquidado {pf['ano']} (Siconfi)", round(sum(pf["mondai"].values()), 2), total, 1)
confere("Despesa total por habitante", pf["por_habitante"][MONDAI]["total"], total / POP[2025])
ult = S["cempre"][-1]
confere("Série de empresas 2024 = indicador de empresas", I["empresas"]["mondai"], ult["empresas"], 0)

# ---------------------------------------------------------------- 3. por habitante

titulo("3. Indicadores por habitante recalculados")
m = MUN[MONDAI]
for chave, formula, desc in (
    ("suinos_hab", m["suinos"] / POP[2025], "suínos ÷ população 2025"),
    ("leite_hab", m["leite"] * 1000 / POP[2025], "leite (mil litros × 1000) ÷ população 2025"),
    ("ocupados_100", m["ocupados"] / POP[2024] * 100, "pessoal ocupado ÷ população 2024 × 100"),
    ("empresas_mil", m["empresas"] / POP[2024] * 1000, "empresas ÷ população 2024 × 1000"),
):
    confere(f"{I[chave]['rotulo']} ({desc})", I[chave]["mondai"], formula)
confere("Peso da indústria + agro + serviços + adm. pública = 100%",
        100, m["pct_ind"] + m["pct_agro"] + m["pct_serv"] + m["pct_adm"], 0.05)

# ---------------------------------------------------------------- 4. rankings

titulo("4. Posições no ranking recalculadas a partir dos 295 municípios")
for chave, i in I.items():
    vals = [x[chave] for x in MUN.values() if x.get(chave) is not None]
    v = i["mondai"]
    if v is None:
        continue
    confere(f"{i['rotulo']} ({i['ano']}): posição do maior para o menor", i["maior_sc"], 1 + sum(x > v for x in vals), 0)

# ---------------------------------------------------------------- 5. IBGE Cidades

titulo("5. Comparação com o IBGE Cidades (cidades.ibge.gov.br/brasil/sc/mondai/panorama, consultado em 26/10/2026)")
# Valores e posições copiados do panorama oficial; a conferência é com o que o painel calculou por conta própria.
cidades = [
    ("População no Censo 2022", I["pop2022"]["mondai"], 10066, 0),
    ("População: posição em SC", I["pop2022"]["maior_sc"], 133, 0),
    ("Densidade demográfica 2022", I["densidade"]["mondai"], 50.26, 0.01),
    ("Densidade: posição em SC", I["densidade"]["maior_sc"], 99, 0),
    ("PIB per capita 2023", I["pib_pc"]["mondai"], 124112.53, 0.01),
    ("PIB per capita: posição em SC", I["pib_pc"]["maior_sc"], 8, 0),
    ("Esgoto por rede geral ou fossa ligada à rede 2022 (%)", I["esgoto_rede"]["mondai"], 2.06, 0.01),
    ("Esgoto: posição em SC", I["esgoto_rede"]["maior_sc"], 234, 0),
    ("Esgoto: posição na região", I["esgoto_rede"]["maior_regiao"], 18, 0),
    ("Pessoal ocupado 2023", next(x["ocupados"] for x in S["cempre"] if x["ano"] == 2023), 3634, 0),
    ("Salário médio 2023 (salários mínimos)", next(x["salario_sm"] for x in S["cempre"] if x["ano"] == 2023), 2.1, 0),
]
for desc, painel, oficial, tol in cidades:
    confere(desc, painel, oficial, tol)

# ---------------------------------------------------------------- saída

resumo = f"Auditoria de {time.strftime('%d/%m/%Y')}: {sum(l.startswith('[ok]') for l in saida)} itens conferidos, {falhas} falha(s)."
(PASTA / "auditoria.txt").write_text(resumo + "\n" + "\n".join(saida) + "\n", encoding="utf-8")
print(resumo)
if falhas:
    print("\n".join(l for l in saida if l.startswith("[FALHA]")))
    sys.exit(1)
