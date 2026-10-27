"""Coleta os dados do painel Mondaí em Números direto das fontes oficiais.

Fontes:
  IBGE, SIDRA (tabelas por município): https://apisidra.ibge.gov.br
  IBGE, Cidades (PIB per capita oficial): https://servicodados.ibge.gov.br/api/docs/pesquisas
  Tesouro Nacional, Siconfi (despesas da prefeitura): https://apidatalake.tesouro.gov.br/docs/siconfi/

Antes de baixar qualquer número, o script confere nos metadados oficiais se cada
tabela, variável, categoria e ano existe e tem o nome esperado. Se algo não bater,
ele para com erro em vez de gerar um painel com dado errado. O registro dessa
conferência fica em dados/validacao.txt.

Saídas (em public/dados/):
  municipios_sc.csv  indicadores dos 295 municípios de SC
  painel.js          tudo o que a página usa
  validacao.txt      o que foi conferido em cada fonte

Uso: python pipeline/coleta.py   (só biblioteca padrão do Python)
"""

import csv
import gzip
import json
import statistics
import subprocess
import time
import unicodedata
import urllib.request
from pathlib import Path

SIDRA = "https://apisidra.ibge.gov.br/values"
METADADOS = "https://servicodados.ibge.gov.br/api/v3/agregados/{}/metadados"
CIDADES = "https://servicodados.ibge.gov.br/api/v1/pesquisas/38/indicadores/{}"
LOCALIDADES = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/42/municipios?view=nivelado"
SICONFI = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt/dca?an_exercicio={}&no_anexo=DCA-Anexo%20I-E&id_ente={}"

SC = "n6/in%20n3%2042"  # os 295 municípios de Santa Catarina
UF = "n3/42"            # o estado de Santa Catarina
MONDAI = "4211009"
VIZINHOS = ["Caibi", "Iporã do Oeste", "Itapiranga", "Palmitos", "Riqueza"]

PASTA = Path(__file__).resolve().parent.parent / "public" / "dados"
registro = []


# ---------------------------------------------------------------- download

def baixar(url, tentativas=4):
    """Baixa um JSON. Se o Python recusar o certificado do servidor, usa o curl do sistema."""
    for i in range(tentativas):
        try:
            with urllib.request.urlopen(url, timeout=180) as r:
                corpo = r.read()
            if corpo[:2] == b"\x1f\x8b":
                corpo = gzip.decompress(corpo)
            return json.loads(corpo)
        except Exception:
            try:
                r = subprocess.run(["curl", "-s", "-L", "--compressed", "-m", "180", url],
                                   capture_output=True, check=True)
                return json.loads(r.stdout)
            except Exception as erro:
                if i == tentativas - 1:
                    raise RuntimeError(f"Não consegui baixar {url}: {erro}") from erro
                time.sleep(3 * (i + 1))


def numero(texto):
    """Símbolos do SIDRA: '-' é zero absoluto; '...', '..' e 'X' (sigilo) ficam sem valor."""
    if texto == "-":
        return 0.0
    try:
        return float(texto)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------- validação

class ErroValidacao(Exception):
    pass


def simples(texto):
    sem_acento = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return " ".join(sem_acento.lower().split())


_metadados = {}


def metadados(tabela):
    if tabela not in _metadados:
        _metadados[tabela] = baixar(METADADOS.format(tabela))
    return _metadados[tabela]


def consulta(tabela, variavel, nome_variavel, periodo, *filtros, somar=False):
    """Uma consulta ao SIDRA e o que ela deve encontrar nos metadados.

    filtros: (classificação, {categoria: trecho do nome esperado}, nome da classificação)
    somar: soma as categorias pedidas (ex.: duas formas de ligação à rede de água).
    """
    return {"tabela": tabela, "variavel": variavel, "nome_variavel": nome_variavel,
            "periodo": str(periodo), "filtros": filtros, "somar": somar}


def validar(c):
    m = metadados(c["tabela"])
    t = c["tabela"]
    if "N6" not in (m["nivelTerritorial"].get("Administrativo") or []):
        raise ErroValidacao(f"Tabela {t} não tem dados por município")

    variaveis = {v["id"]: v for v in m["variaveis"]}
    v = variaveis.get(c["variavel"])
    if not v or simples(c["nome_variavel"]) not in simples(v["nome"]):
        raise ErroValidacao(f"Tabela {t}: variável {c['variavel']} não é '{c['nome_variavel']}' "
                            f"(IBGE diz: {v['nome'] if v else 'não existe'})")

    if c["periodo"] != "all":
        inicio, fim = m["periodicidade"]["inicio"], m["periodicidade"]["fim"]
        for ano in c["periodo"].split(","):
            if not inicio <= int(ano) <= fim:
                raise ErroValidacao(f"Tabela {t}: ano {ano} fora do período publicado ({inicio}-{fim})")

    classes = {cl["id"]: cl for cl in m["classificacoes"]}
    linhas = [f"Tabela {t} ({m['pesquisa']}): {m['nome']}",
              f"  variável {v['id']}: {v['nome']} [{v['unidade']}]",
              f"  período: {c['periodo']} (publicado {m['periodicidade']['inicio']}-{m['periodicidade']['fim']})"]
    for cid, categorias, nome_classe in c["filtros"]:
        cl = classes.get(cid)
        if not cl or simples(nome_classe) not in simples(cl["nome"]):
            raise ErroValidacao(f"Tabela {t}: classificação {cid} não é '{nome_classe}'")
        nomes = {k["id"]: k["nome"] for k in cl["categorias"]}
        for cat, trecho in categorias.items():
            if cat not in nomes or simples(trecho) not in simples(nomes[cat]):
                raise ErroValidacao(f"Tabela {t}, {cl['nome']}: categoria {cat} não é '{trecho}' "
                                    f"(IBGE diz: {nomes.get(cat, 'não existe')})")
            linhas.append(f"  {cl['nome']} {cat}: {nomes[cat]}")
    registro.append("\n".join(linhas))
    return m


def url(c, local):
    caminho = f"/t/{c['tabela']}/{local}/v/{c['variavel']}/p/{c['periodo']}"
    for cid, categorias, _ in c["filtros"]:
        caminho += f"/c{cid}/" + ",".join(str(k) for k in categorias)
    return SIDRA + caminho


def ler(c, local):
    """Linhas da consulta já validada: [{codigo, periodo, cats: {classificação: categoria}, valor}].

    Cada coluna é identificada pelo nome da classificação no cabeçalho da resposta,
    para não depender da posição das colunas.
    """
    m = validar(c)
    nome_para_id = {cl["nome"]: cl["id"] for cl in m["classificacoes"]}
    dados = baixar(url(c, local))
    cabecalho = dados[0]
    colunas = {}
    for i in range(4, 4 + len(c["filtros"])):
        nome = cabecalho.get(f"D{i}N")
        if nome not in nome_para_id:
            raise ErroValidacao(f"Tabela {c['tabela']}: coluna '{nome}' não corresponde a nenhuma classificação")
        colunas[f"D{i}C"] = nome_para_id[nome]
    saida = []
    for linha in dados[1:]:
        cats = {cid: int(linha[col]) for col, cid in colunas.items()}
        saida.append({"codigo": linha["D1C"], "periodo": linha["D3N"], "cats": cats, "valor": numero(linha["V"])})
    return saida


def por_local(c, local=SC):
    """Um valor por localidade (soma as categorias se a consulta pedir)."""
    valores = {}
    for l in ler(c, local):
        if l["codigo"] in valores:
            if not c["somar"]:
                raise ErroValidacao(f"Tabela {c['tabela']}: mais de um valor por local; use somar=True")
            if valores[l["codigo"]] is not None and l["valor"] is not None:
                valores[l["codigo"]] = round(valores[l["codigo"]] + l["valor"], 2)
            else:
                valores[l["codigo"]] = None
        else:
            valores[l["codigo"]] = l["valor"]
    return valores


# ---------------------------------------------------------------- o que coletar

TOTAL_SEXO = (2, {6794: "Total"}, "Sexo")
TOTAL_COR = (86, {95251: "Total"}, "Cor ou raça")
TOTAL_IDADE_58 = (58, {95253: "Total"}, "Grupo de idade")

# Indicadores com valor para os 295 municípios: entram no ranking e no comparador.
# (id, tema, rótulo, unidade, ano, fonte, consulta)
INDICADORES = [
    ("pop2026", "Pessoas", "População estimada", "pessoas", 2026, "IBGE, Estimativas de População",
     consulta(6579, 9324, "População residente estimada", 2026)),
    ("pop2022", "Pessoas", "População no Censo", "pessoas", 2022, "IBGE, Censo Demográfico",
     consulta(4714, 93, "População residente", 2022)),
    ("area", "Pessoas", "Área do município", "km²", 2022, "IBGE, Censo Demográfico",
     consulta(4714, 6318, "Área da unidade territorial", 2022)),
    ("densidade", "Pessoas", "Densidade demográfica", "hab/km²", 2022, "IBGE, Censo Demográfico",
     consulta(4714, 614, "Densidade demográfica", 2022)),
    ("crescimento", "Pessoas", "Crescimento da população por ano, 2010 a 2022", "% ao ano", 2022, "IBGE, Censo Demográfico",
     consulta(4709, 10605, "Taxa de crescimento geométrico", 2022)),
    ("urbana", "Pessoas", "População urbana", "%", 2022, "IBGE, Censo Demográfico",
     consulta(9923, 1000093, "População residente - percentual", 2022, (1, {1: "Urbana"}, "Situação do domicílio"))),
    ("idade_mediana", "Pessoas", "Idade mediana", "anos", 2022, "IBGE, Censo Demográfico",
     consulta(9756, 10613, "Idade mediana", 2022, TOTAL_COR)),
    ("envelhecimento", "Pessoas", "Índice de envelhecimento", "índice", 2022, "IBGE, Censo Demográfico",
     consulta(9756, 9175, "Índice de envelhecimento", 2022, TOTAL_COR)),
    ("alfabetizacao", "Educação e renda", "Alfabetização (15 anos ou mais)", "%", 2022, "IBGE, Censo Demográfico",
     consulta(9543, 2513, "Taxa de alfabetização", 2022, TOTAL_SEXO, TOTAL_COR, (287, {100362: "Total"}, "Idade"))),
    ("superior", "Educação e renda", "Adultos com ensino superior completo", "%", 2022, "IBGE, Censo Demográfico",
     consulta(10061, 1002667, "Pessoas de 18 anos ou mais de idade - percentual", 2022,
              (1568, {99713: "Superior completo"}, "Nível de instrução"), TOTAL_IDADE_58, TOTAL_SEXO, TOTAL_COR)),
    ("rend_medio", "Educação e renda", "Rendimento médio do trabalho", "R$", 2022, "IBGE, Censo Demográfico",
     consulta(10289, 13536, "rendimento nominal médio mensal de todos os trabalhos", 2022, TOTAL_SEXO, TOTAL_COR)),
    ("rend_mediano", "Educação e renda", "Rendimento mediano do trabalho", "R$", 2022, "IBGE, Censo Demográfico",
     consulta(10289, 13537, "rendimento nominal mediano mensal de todos os trabalhos", 2022, TOTAL_SEXO, TOTAL_COR)),
    ("empresas", "Trabalho", "Empresas e organizações ativas", "unidades", 2024, "IBGE, Cadastro Central de Empresas",
     consulta(9509, 367, "Número de empresas e outras organizações atuantes", 2024)),
    ("ocupados", "Trabalho", "Pessoal ocupado em empresas", "pessoas", 2024, "IBGE, Cadastro Central de Empresas",
     consulta(9509, 707, "Pessoal ocupado total", 2024)),
    ("salario_sm", "Trabalho", "Salário médio mensal", "salários mínimos", 2024, "IBGE, Cadastro Central de Empresas",
     consulta(9509, 1606, "Salário médio mensal", 2024)),
    ("salario_rs", "Trabalho", "Salário médio mensal", "R$", 2024, "IBGE, Cadastro Central de Empresas",
     consulta(9509, 10143, "Salário médio mensal em reais", 2024)),
    ("pib", "Economia", "PIB", "mil R$", 2023, "IBGE, PIB dos Municípios",
     consulta(5938, 37, "Produto Interno Bruto a preços correntes", 2023)),
    ("agua_rede", "Saneamento", "Moradores ligados à rede de água", "%", 2022, "IBGE, Censo Demográfico",
     consulta(9850, 1000382, "Moradores em domicílios particulares permanentes ocupados - percentual", 2022,
              (125, {2932: "Total"}, "Tipo de domicílio"),
              (1821, {72144: "Possui ligação à rede geral e a utiliza como forma principal",
                      72145: "Possui ligação à rede geral, mas utiliza principalmente outra forma"},
               "ligação à rede geral de distribuição de água"),
              (1817, {72125: "Total"}, "canalização de água"), (458, {72117: "Total"}, "banheiro"),
              TOTAL_IDADE_58, (2661, {32776: "Total"}, "Localização do domicílio"), somar=True)),
    ("esgoto_rede", "Saneamento", "Moradores ligados à rede de esgoto", "%", 2022, "IBGE, Censo Demográfico",
     consulta(9397, 1000382, "Moradores em domicílios particulares permanentes ocupados - percentual", 2022,
              (11558, {46290: "Rede geral, rede pluvial ou fossa ligada à rede"}, "esgotamento sanitário"),
              (458, {72117: "Total"}, "banheiro"), TOTAL_IDADE_58, TOTAL_COR)),
    # Critério do Plano Nacional de Saneamento Básico: rede geral, fossa séptica ligada ou não ligada à rede.
    ("esgoto_adequado", "Saneamento", "Moradores com esgoto adequado (Plansab)", "%", 2022, "IBGE, Censo Demográfico",
     consulta(9397, 1000382, "Moradores em domicílios particulares permanentes ocupados - percentual", 2022,
              (11558, {46290: "Rede geral, rede pluvial ou fossa ligada à rede",
                       72112: "Fossa séptica ou fossa filtro não ligada à rede"}, "esgotamento sanitário"),
              (458, {72117: "Total"}, "banheiro"), TOTAL_IDADE_58, TOTAL_COR, somar=True)),
    ("lixo_coletado", "Saneamento", "Moradores com lixo coletado", "%", 2022, "IBGE, Censo Demográfico",
     consulta(9541, 1000382, "Moradores em domicílios particulares permanentes ocupados - percentual", 2022,
              (67, {2520: "Coletado"}, "Destino do lixo"), TOTAL_IDADE_58, TOTAL_COR)),
    ("suinos", "Campo", "Rebanho de suínos", "cabeças", 2025, "IBGE, Pesquisa da Pecuária Municipal",
     consulta(3939, 105, "Efetivo dos rebanhos", 2025, (79, {32794: "Suíno - total"}, "Tipo de rebanho"))),
    ("bovinos", "Campo", "Rebanho de bovinos", "cabeças", 2025, "IBGE, Pesquisa da Pecuária Municipal",
     consulta(3939, 105, "Efetivo dos rebanhos", 2025, (79, {2670: "Bovino"}, "Tipo de rebanho"))),
    ("galinaceos", "Campo", "Rebanho de galináceos", "cabeças", 2025, "IBGE, Pesquisa da Pecuária Municipal",
     consulta(3939, 105, "Efetivo dos rebanhos", 2025, (79, {32796: "Galináceos - total"}, "Tipo de rebanho"))),
    ("leite", "Campo", "Produção de leite", "mil litros", 2025, "IBGE, Pesquisa da Pecuária Municipal",
     consulta(74, 106, "Produção de origem animal", 2025, (80, {2682: "Leite"}, "Tipo de produto de origem animal"))),
    ("lavouras", "Campo", "Valor da produção das lavouras", "mil R$", 2025, "IBGE, Produção Agrícola Municipal",
     consulta(5457, 215, "Valor da produção", 2025, (782, {0: "Total"}, "Produto das lavouras"))),
]

# Usados só para calcular outros indicadores.
AUXILIARES = {
    "pop2024": consulta(6579, 9324, "População residente estimada", 2024),
    "pop2025": consulta(6579, 9324, "População residente estimada", 2025),
    "nascidos": consulta(2612, 218, "Nascidos vivos ocorridos no ano", 2024,
                         (235, {0: "Total"}, "Mês do nascimento"), (2, {0: "Total"}, "Sexo"),
                         (237, {0: "Total"}, "Local do nascimento"), (238, {0: "Total"}, "Número de nascidos por parto"),
                         (240, {0: "Total"}, "Idade da mãe")),
    "obitos": consulta(2654, 343, "Número de óbitos ocorridos no ano", 2024,
                       (244, {0: "Total"}, "Mês de ocorrência"), (1836, {0: "Total"}, "Natureza do óbito"),
                       (2, {0: "Total"}, "Sexo"), (260, {0: "Total"}, "Idade"), (257, {0: "Total"}, "Local de ocorrência")),
    "va_total": consulta(5938, 498, "Valor adicionado bruto a preços correntes total", 2021),
    "va_agro": consulta(5938, 513, "Valor adicionado bruto a preços correntes da agropecuária", 2021),
    "va_ind": consulta(5938, 517, "Valor adicionado bruto a preços correntes da indústria", 2021),
    "va_serv": consulta(5938, 6575, "Valor adicionado bruto a preços correntes dos serviços", 2021),
    "va_adm": consulta(5938, 525, "Valor adicionado bruto a preços correntes da administração", 2021),
}

# Calculados a partir dos coletados: (id, tema, rótulo, unidade, ano, fonte, fórmula)
DERIVADOS = [
    ("nasc_mil", "Pessoas", "Nascimentos por mil habitantes", "por mil", 2024, "IBGE, Registro Civil e Estimativas",
     lambda m: m["nascidos"] / m["pop2024"] * 1000),
    ("obit_mil", "Pessoas", "Óbitos por mil habitantes", "por mil", 2024, "IBGE, Registro Civil e Estimativas",
     lambda m: m["obitos"] / m["pop2024"] * 1000),
    ("ocupados_100", "Trabalho", "Pessoal ocupado em empresas por 100 habitantes", "por 100", 2024,
     "IBGE, Cadastro Central de Empresas e Estimativas", lambda m: m["ocupados"] / m["pop2024"] * 100),
    ("empresas_mil", "Trabalho", "Empresas e organizações por mil habitantes", "por mil", 2024,
     "IBGE, Cadastro Central de Empresas e Estimativas", lambda m: m["empresas"] / m["pop2024"] * 1000),
    ("pct_ind", "Economia", "Peso da indústria na economia", "%", 2021, "IBGE, PIB dos Municípios",
     lambda m: m["va_ind"] / m["va_total"] * 100),
    ("pct_agro", "Economia", "Peso da agropecuária na economia", "%", 2021, "IBGE, PIB dos Municípios",
     lambda m: m["va_agro"] / m["va_total"] * 100),
    ("pct_serv", "Economia", "Peso dos serviços na economia", "%", 2021, "IBGE, PIB dos Municípios",
     lambda m: m["va_serv"] / m["va_total"] * 100),
    ("pct_adm", "Economia", "Peso da administração pública na economia", "%", 2021, "IBGE, PIB dos Municípios",
     lambda m: m["va_adm"] / m["va_total"] * 100),
    ("leite_hab", "Campo", "Leite produzido por habitante", "litros", 2025, "IBGE, Pecuária Municipal e Estimativas",
     lambda m: m["leite"] * 1000 / m["pop2025"]),
    ("suinos_hab", "Campo", "Suínos por habitante", "cabeças", 2025, "IBGE, Pecuária Municipal e Estimativas",
     lambda m: m["suinos"] / m["pop2025"]),
]


# ---------------------------------------------------------------- coleta

def coletar_municipios():
    municipios = {}
    for m in baixar(LOCALIDADES):
        municipios[str(m["municipio-id"])] = {"nome": m["municipio-nome"], "regiao_imediata": m["regiao-imediata-nome"]}
    if len(municipios) != 295 or MONDAI not in municipios:
        raise ErroValidacao(f"Esperava 295 municípios em SC com Mondaí; vieram {len(municipios)}")

    for chave, c in [(i[0], i[6]) for i in INDICADORES] + list(AUXILIARES.items()):
        print(f"  {chave} (tabela {c['tabela']})")
        valores = por_local(c)
        for cod, m in municipios.items():
            m[chave] = valores.get(cod)

    print("  pib_pc (IBGE Cidades, indicador 47001)")
    municipios_pib_pc(municipios)

    for d in DERIVADOS:
        for m in municipios.values():
            try:
                m[d[0]] = round(d[6](m), 2)
            except (TypeError, ZeroDivisionError):
                m[d[0]] = None
    return municipios


def municipios_pib_pc(municipios, ano="2023"):
    """PIB per capita oficial, publicado pelo IBGE no Cidades (série revisada)."""
    info = baixar(CIDADES.format(47001))[0]
    if info["id"] != 47001 or "revisada" not in simples(info["indicador"]):
        raise ErroValidacao(f"Indicador 47001 do IBGE Cidades não é o PIB per capita revisado: {info['indicador']}")
    registro.append("IBGE Cidades, pesquisa 38 (PIB dos Municípios), indicador 47001: "
                    f"PIB per capita, {info['indicador']} [{info['unidade']['id']}]")
    codigos = list(municipios)
    for i in range(0, len(codigos), 60):
        bloco = "|".join(c[:6] for c in codigos[i:i + 60])  # o Cidades usa o código de 6 dígitos
        for r in baixar(CIDADES.format(47001) + "/resultados/" + bloco)[0]["res"]:
            cod = next(c for c in codigos if c.startswith(r["localidade"]))
            municipios[cod]["pib_pc"] = numero(r["res"].get(ano))
            municipios[cod]["_pib_pc_serie"] = {a: numero(v) for a, v in r["res"].items() if numero(v)}


def faixas_5_anos():
    m = metadados(9514)
    idade = next(c for c in m["classificacoes"] if c["id"] == 287)["categorias"]
    faixas = {}
    for k in idade:
        partes = k["nome"].split()
        if (len(partes) == 4 and partes[1] == "a" and int(partes[2]) - int(partes[0]) == 4) or k["nome"] == "100 anos ou mais":
            faixas[k["id"]] = k["nome"]
    if len(faixas) != 21:
        raise ErroValidacao(f"Esperava 21 faixas de 5 anos na tabela 9514; achei {len(faixas)}")
    return faixas


def serie(c, local=f"n6/{MONDAI}"):
    return {l["periodo"]: l["valor"] for l in ler(c, local)}


def distribuicao(c, rotulos, locais):
    """{local: {rótulo: valor}} para gráficos de composição; a 1ª classificação da consulta é a que varia."""
    classe = c["filtros"][0][0]
    saida = {}
    for nome, local in locais.items():
        saida[nome] = {rotulos[l["cats"][classe]]: l["valor"] for l in ler(c, local)}
    return saida


def coletar_series(municipios):
    mondai_uf = {"Mondaí": f"n6/{MONDAI}", "Santa Catarina": UF}
    s = {}

    print("  pirâmide etária")
    faixas = faixas_5_anos()
    c = consulta(9514, 93, "População residente", 2022, (2, {4: "Homens", 5: "Mulheres"}, "Sexo"),
                 (287, {k: v for k, v in faixas.items()}, "Idade"), (286, {113635: "Total"}, "Forma de declaração da idade"))
    s["piramide"] = {}
    for nome, local in mondai_uf.items():
        linhas = ler(c, local)
        s["piramide"][nome] = {
            "faixas": list(faixas.values()),
            "homens": [next(l["valor"] for l in linhas if l["cats"][2] == 4 and l["cats"][287] == k) for k in faixas],
            "mulheres": [next(l["valor"] for l in linhas if l["cats"][2] == 5 and l["cats"][287] == k) for k in faixas],
        }

    print("  população nos censos e estimativas")
    censos = serie(consulta(9605, 93, "População residente", "all", (86, {95251: "Total"}, "Cor ou raça")))
    estimativas = serie(consulta(6579, 9324, "População residente estimada", "2024,2025,2026"))
    s["populacao"] = [{"ano": int(a), "valor": v, "tipo": "Censo"} for a, v in sorted(censos.items())] + \
                     [{"ano": int(a), "valor": v, "tipo": "Estimativa"} for a, v in sorted(estimativas.items())]

    print("  nascimentos e óbitos")
    nasc = {**AUXILIARES["nascidos"], "periodo": "all"}
    obit = {**AUXILIARES["obitos"], "periodo": "all"}
    n, o = serie(nasc), serie(obit)
    s["vitais"] = [{"ano": int(a), "nascimentos": n[a], "obitos": o.get(a)} for a in sorted(n)]

    print("  urbana e rural")
    s["situacao"] = distribuicao(consulta(9923, 93, "População residente", 2022,
                                          (1, {1: "Urbana", 2: "Rural"}, "Situação do domicílio")),
                                 {1: "Urbana", 2: "Rural"}, mondai_uf)

    print("  nível de instrução")
    niveis = {9493: "Sem instrução ou fundamental incompleto", 9494: "Fundamental completo",
              9495: "Médio completo", 99713: "Superior completo"}
    s["instrucao"] = distribuicao(consulta(10061, 1002667, "Pessoas de 18 anos ou mais de idade - percentual", 2022,
                                           (1568, {9493: "Sem instrução e fundamental incompleto",
                                                   9494: "Fundamental completo e médio incompleto",
                                                   9495: "Médio completo e superior incompleto",
                                                   99713: "Superior completo"}, "Nível de instrução"),
                                           TOTAL_IDADE_58, TOTAL_SEXO, TOTAL_COR), niveis, mondai_uf)

    print("  rendimento do trabalho")
    s["rendimento"] = {}
    for nome, local in mondai_uf.items():
        s["rendimento"][nome] = {
            "medio": por_local(INDICADORES_POR_ID["rend_medio"], local).popitem()[1],
            "mediano": por_local(INDICADORES_POR_ID["rend_mediano"], local).popitem()[1],
        }

    print("  saneamento")
    agua = {72144: "Rede geral", 72145: "Rede geral, mas usa outra fonte", 72153: "Sem ligação à rede"}
    s["agua"] = distribuicao(consulta(9850, 1000382, "Moradores em domicílios particulares permanentes ocupados - percentual", 2022,
                                      (1821, {72144: "Possui ligação à rede geral e a utiliza",
                                              72145: "Possui ligação à rede geral, mas utiliza principalmente outra forma",
                                              72153: "Não possui ligação com a rede geral"},
                                       "ligação à rede geral de distribuição de água"),
                                      (125, {2932: "Total"}, "Tipo de domicílio"), (1817, {72125: "Total"}, "canalização de água"),
                                      (458, {72117: "Total"}, "banheiro"), TOTAL_IDADE_58,
                                      (2661, {32776: "Total"}, "Localização do domicílio")), agua, mondai_uf)
    esgoto = {46290: "Rede geral ou fossa ligada à rede", 72112: "Fossa séptica não ligada à rede",
              72113: "Fossa rudimentar ou buraco", 92858: "Vala", 72114: "Rio, lago ou córrego",
              72115: "Outra forma", 92861: "Sem banheiro nem sanitário"}
    s["esgoto"] = distribuicao(consulta(9397, 1000382, "Moradores em domicílios particulares permanentes ocupados - percentual", 2022,
                                        (11558, {46290: "Rede geral, rede pluvial ou fossa ligada",
                                                 72112: "Fossa séptica ou fossa filtro não ligada",
                                                 72113: "Fossa rudimentar ou buraco", 92858: "Vala",
                                                 72114: "Rio, lago, córrego ou mar", 72115: "Outra forma",
                                                 92861: "Não tinham banheiro nem sanitário"}, "esgotamento sanitário"),
                                        (458, {72117: "Total"}, "banheiro"), TOTAL_IDADE_58, TOTAL_COR), esgoto, mondai_uf)
    lixo = {72120: "Coletado na porta", 72121: "Caçamba de coleta", 72122: "Queimado na propriedade",
            72123: "Enterrado na propriedade", 72124: "Terreno baldio ou área pública", 1091: "Outro destino"}
    s["lixo"] = distribuicao(consulta(9541, 1000382, "Moradores em domicílios particulares permanentes ocupados - percentual", 2022,
                                      (67, {72120: "Coletado no domicílio", 72121: "Depositado em caçamba",
                                            72122: "Queimado na propriedade", 72123: "Enterrado na propriedade",
                                            72124: "Jogado em terreno baldio", 1091: "Outro destino"}, "Destino do lixo"),
                                      TOTAL_IDADE_58, TOTAL_COR), lixo, mondai_uf)

    print("  PIB")
    pib = serie(consulta(5938, 37, "Produto Interno Bruto a preços correntes", "all"))
    s["pib"] = [{"ano": int(a), "valor": v} for a, v in sorted(pib.items()) if v]
    ids_comp = [MONDAI] + [c for c, m in municipios.items() if m["nome"] in VIZINHOS]
    s["pib_pc"] = {municipios[c]["nome"]: municipios[c].pop("_pib_pc_serie") for c in ids_comp}
    for m in municipios.values():
        m.pop("_pib_pc_serie", None)

    print("  empresas e emprego 2022 a 2024")
    cempre = {}
    for chave, var, nome in (("empresas", 367, "Número de empresas"), ("ocupados", 707, "Pessoal ocupado total"),
                             ("salario_sm", 1606, "Salário médio mensal")):
        cempre[chave] = serie(consulta(9509, var, nome, "all"))
    s["cempre"] = [{"ano": int(a), **{k: v[a] for k, v in cempre.items()}} for a in sorted(cempre["empresas"])]

    print("  empregos por setor")
    meta = metadados(9528)
    cnae = next(c for c in meta["classificacoes"] if c["id"] == 12762)["categorias"]
    secoes = {k["id"]: k["nome"] for k in cnae if len(k["nome"]) > 2 and k["nome"][0].isalpha()
              and k["nome"][1] == " " and k["nome"][0].isupper()}
    if len(secoes) != 21:
        raise ErroValidacao(f"Esperava as 21 seções da CNAE na tabela 9528; achei {len(secoes)}")
    linhas = ler(consulta(9528, 707, "Pessoal ocupado total", 2024, (12762, secoes, "CNAE 2.0")), f"n6/{MONDAI}")
    s["setores"] = sorted(({"secao": secoes[l["cats"][12762]][2:], "pessoas": l["valor"]} for l in linhas),
                          key=lambda x: -(x["pessoas"] or 0))

    print("  rebanhos e leite")
    rebanhos = {2670: "Bovinos", 32794: "Suínos", 32796: "Galináceos"}
    linhas = ler(consulta(3939, 105, "Efetivo dos rebanhos", "all",
                          (79, {2670: "Bovino", 32794: "Suíno - total", 32796: "Galináceos - total"}, "Tipo de rebanho")),
                 f"n6/{MONDAI}")
    s["rebanhos"] = {}
    for l in linhas:
        if int(l["periodo"]) >= 2000:
            s["rebanhos"].setdefault(rebanhos[l["cats"][79]], {})[l["periodo"]] = l["valor"]
    leite = serie(consulta(74, 106, "Produção de origem animal", "all", (80, {2682: "Leite"}, "Tipo de produto")))
    s["leite"] = {a: v for a, v in leite.items() if int(a) >= 2000}

    print("  lavouras 2025")
    meta = metadados(5457)
    produtos = {k["id"]: k["nome"] for k in next(c for c in meta["classificacoes"] if c["id"] == 782)["categorias"] if k["id"] != 0}
    linhas = ler(consulta(5457, 215, "Valor da produção", 2025, (782, produtos, "Produto das lavouras")), f"n6/{MONDAI}")
    s["lavouras"] = sorted(({"produto": produtos[l["cats"][782]].replace("*", "").strip(), "valor": l["valor"]}
                            for l in linhas if l["valor"]), key=lambda x: -x["valor"])
    return s


def coletar_prefeitura(municipios, ano=2025):
    """Despesas liquidadas por função (DCA, Anexo I-E), Mondaí, vizinhas e região."""
    regiao = municipios[MONDAI]["regiao_imediata"]
    codigos = [c for c, m in municipios.items() if m["regiao_imediata"] == regiao or m["nome"] in VIZINHOS]
    funcoes_resumo = {"Despesas Exceto Intraorçamentárias": "total", "10 - Saúde": "saude", "12 - Educação": "educacao"}
    resumo, mondai = {}, {}
    for cod in codigos:
        dados = baixar(SICONFI.format(ano, cod)).get("items", [])
        liquidadas = {d["conta"]: d["valor"] for d in dados if d["coluna"] == "Despesas Liquidadas"}
        pop = municipios[cod]["pop2025"]
        if liquidadas and pop:
            resumo[cod] = {k: round(liquidadas[conta] / pop, 2) if conta in liquidadas else None
                           for conta, k in funcoes_resumo.items()}
        if cod == MONDAI:
            if "Despesas Exceto Intraorçamentárias" not in liquidadas:
                raise ErroValidacao(f"Siconfi sem DCA {ano} de Mondaí")
            mondai = {conta.split(" - ", 1)[1]: valor for conta, valor in liquidadas.items()
                      if " - " in conta and conta.split(" - ")[0].isdigit()}
        time.sleep(0.4)  # o Siconfi limita o número de pedidos por segundo
    registro.append(f"Tesouro Nacional, Siconfi: DCA {ano}, Anexo I-E (despesa por função), coluna Despesas Liquidadas; "
                    f"{len(resumo)} de {len(codigos)} municípios com dados")
    return {"ano": ano, "mondai": mondai, "por_habitante": resumo}


# ---------------------------------------------------------------- resumo e saída

INDICADORES_POR_ID = {i[0]: i[6] for i in INDICADORES}


def resumir(municipios):
    regiao = municipios[MONDAI]["regiao_imediata"]
    definicoes = [i[:6] for i in INDICADORES] + [d[:6] for d in DERIVADOS] + \
                 [("pib_pc", "Economia", "PIB por habitante", "R$", 2023, "IBGE, PIB dos Municípios")]
    resumo = {}
    for chave, tema, rotulo, unidade, ano, fonte in definicoes:
        sc = [m[chave] for m in municipios.values() if m.get(chave) is not None]
        rg = [m[chave] for m in municipios.values() if m["regiao_imediata"] == regiao and m.get(chave) is not None]
        v = municipios[MONDAI].get(chave)
        resumo[chave] = {
            "tema": tema, "rotulo": rotulo, "unidade": unidade, "ano": ano, "fonte": fonte,
            "mondai": v,
            "total_sc": len(sc), "total_regiao": len(rg),
            # Empates contam a favor: "6º maior" = só 5 cidades têm valor mais alto.
            "maior_sc": None if v is None else 1 + sum(x > v for x in sc),
            "menor_sc": None if v is None else 1 + sum(x < v for x in sc),
            "maior_regiao": None if v is None else 1 + sum(x > v for x in rg),
            "menor_regiao": None if v is None else 1 + sum(x < v for x in rg),
            "mediana_sc": statistics.median(sc) if sc else None,
            "mediana_regiao": statistics.median(rg) if rg else None,
        }
    return resumo


def salvar(municipios, resumo, series, prefeitura):
    PASTA.mkdir(exist_ok=True)
    colunas = ["nome", "regiao_imediata", *resumo]
    with open(PASTA / "municipios_sc.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["codigo_ibge", *colunas])
        for cod, m in sorted(municipios.items(), key=lambda x: x[1]["nome"]):
            w.writerow([cod, *[m.get(c) for c in colunas]])

    dados = {
        "gerado_em": time.strftime("%d/%m/%Y"),
        "mondai": MONDAI,
        "regiao": municipios[MONDAI]["regiao_imediata"],
        "vizinhos": [c for c, m in municipios.items() if m["nome"] in VIZINHOS],
        "indicadores": resumo,
        "municipios": {c: {k: m.get(k) for k in colunas} for c, m in municipios.items()},
        "series": series,
        "prefeitura": prefeitura,
    }
    with open(PASTA / "painel.js", "w", encoding="utf-8") as f:
        f.write("// Gerado por coleta.py. Não edite à mão.\nwindow.PAINEL = ")
        json.dump(dados, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    unicos = list(dict.fromkeys(registro))
    with open(PASTA / "validacao.txt", "w", encoding="utf-8") as f:
        f.write(f"Conferência das fontes, {dados['gerado_em']}\n")
        f.write("Cada item abaixo foi verificado nos metadados oficiais antes do download.\n\n")
        f.write("\n\n".join(unicos) + "\n")
    print(f"Pronto: {len(municipios)} municípios, {len(resumo)} indicadores, {len(unicos)} fontes conferidas.")


if __name__ == "__main__":
    print("Indicadores dos municípios de SC:")
    municipios = coletar_municipios()
    print("Séries de Mondaí:")
    series = coletar_series(municipios)
    print("Despesas da prefeitura (Siconfi):")
    prefeitura = coletar_prefeitura(municipios)
    salvar(municipios, resumir(municipios), series, prefeitura)
