# Mondaí em Números

[![CI](https://github.com/hwluands/mondai-em-numeros/actions/workflows/ci.yml/badge.svg)](https://github.com/hwluands/mondai-em-numeros/actions/workflows/ci.yml)

O que os dados oficiais contam sobre **Mondaí (SC)**, e como a sua cidade se compara. Dados do IBGE e do Tesouro Nacional, comparados com as 295 cidades de Santa Catarina e com a região imediata de Chapecó.

**Acessar:** https://mondai-em-numeros.pages.dev

Projeto de Luan Henrique Weber.

## Estrutura

```
pipeline/            dados (Python, só biblioteca padrão)
  coleta.py          coleta, conferência e análise dos dados oficiais
  auditoria.py       refaz os números por outro caminho e compara com o IBGE Cidades
public/              site publicado
  index.html         painel
  admin.html         registros de acesso, protegidos por senha
  css/               base.css (tokens, temas e comuns), painel.css, admin.css
  js/painel/         módulos do painel: dados, formato, graficos, abertura, comparar,
                     historias, explorar, ranking, registro, acessibilidade, main
  js/admin.js        página de registros
  vendor/            Chart.js 4.4.1, servido pelo próprio site
  fontes/            Archivo (licença OFL), servida pelo próprio site
  dados/             saída do pipeline
functions/api/       API (Cloudflare Pages Functions)
  registro.js        POST: grava acesso, retorno ou opinião
  registros.js       GET com senha: lista os registros (JSON ou CSV)
  resumo.js          GET público: contador de pessoas e cidades, sem nomes
tests/               testes da API e do painel (node --test)
schema.sql           tabela do banco D1
wrangler.toml        configuração do Cloudflare Pages e do banco
```

O site não tem etapa de build: o navegador carrega os módulos ES direto de `public/js/`.

## Problema

Os dados públicos sobre o município existem, mas estão espalhados em dezenas de tabelas do IBGE e nos balanços do Tesouro Nacional, difíceis de achar e de ler para quem não é da área. O painel reúne esses números em gráficos que qualquer pessoa abre pelo celular, com a posição de Mondaí no estado e na região.

## O que o site mostra

1. **Abertura:** a manchete e os números que mais chamam atenção, calculados a partir dos dados.
2. **Sua cidade:** na entrada, a pessoa informa nome e cidade. O site compara Mondaí com a cidade dela em 8 indicadores, e ela pode trocar por qualquer outra cidade de SC. Fora a população, os indicadores são por habitante ou em porcentagem (porcentagens comparadas em pontos percentuais), para a comparação ser justa entre cidades de tamanhos diferentes.
3. **6 histórias:** riqueza e salário, trabalho, campo, população, esgoto e prefeitura. Cada uma tem título, contexto, gráfico anotado e botão de compartilhar. Os números dos textos são calculados dos dados, nunca escritos à mão.
4. **Explorar:** 8 indicadores com a posição de Mondaí entre as 295 cidades e 25 gráficos em abas:

| Aba | Gráficos | Ano mais recente publicado |
|---|---|---|
| Pessoas | Pirâmide etária, população, urbana e rural | Censo 2022, estimativa 2026 |
| Educação e renda | Escolaridade, rendimento do trabalho, alfabetização | Censo 2022 |
| Economia | PIB, PIB por habitante, composição por setor, riqueza × salário | PIB 2023; setores 2021 |
| Trabalho | Empregos por setor, empresas e pessoal ocupado | Cadastro Central de Empresas 2024 |
| Campo | Suínos, galináceos, bovinos, leite, lavouras | Pecuária e Agrícola Municipal 2025 |
| Saneamento | Água, esgoto, lixo | Censo 2022 |
| Prefeitura | Despesa por área e por habitante | Siconfi 2025 |
| Mondaí e as vizinhas | Qualquer indicador contra as vizinhas, com ranking de SC | — |

Cada gráfico tem uma tabela equivalente ("Ver em tabela"). O link tem prévia própria (Open Graph) para WhatsApp, Instagram e LinkedIn.

## Como os dados são tratados

O script [`pipeline/coleta.py`](pipeline/coleta.py) faz todo o processo, só com a biblioteca padrão do Python:

1. **Conferência:** antes de baixar, consulta os metadados oficiais do IBGE e confirma se a tabela tem dado por município, se o ano foi publicado e se a variável e cada categoria têm o nome esperado. Se algo não bater, para com erro. O registro fica em [`public/dados/validacao.txt`](public/dados/validacao.txt).
2. **Coleta:** baixa 35 séries dos 295 municípios pela API do SIDRA, o PIB per capita oficial do IBGE Cidades e as despesas das prefeituras da região no Siconfi.
3. **Limpeza:** trata os símbolos do IBGE (`-` é zero; `...` e `X` ficam sem valor).
4. **Indicadores derivados:** nascimentos, óbitos, pessoal ocupado e produção por habitante, usando a estimativa de população do mesmo ano; peso de cada setor na economia.
5. **Análise:** posição de Mondaí em SC e na região, contando empates a favor, e mediana de cada indicador.
6. **Saída:** [`public/dados/municipios_sc.csv`](public/dados/municipios_sc.csv) (tabela aberta) e `public/dados/painel.js` (dados do painel).

Para atualizar e auditar:

```
python pipeline/coleta.py
python pipeline/auditoria.py
```

A [`auditoria.py`](pipeline/auditoria.py) refaz cada porcentagem a partir das contagens absolutas do IBGE, confere se pirâmide, setores e despesas fecham com os totais, recalcula os indicadores por habitante e as posições no ranking e compara com os valores e posições publicados no IBGE Cidades. O resultado fica em [`public/dados/auditoria.txt`](public/dados/auditoria.txt), e o script termina com erro se algum item não conferir. Ela também roda sozinha uma vez por mês no GitHub Actions ([`auditoria.yml`](.github/workflows/auditoria.yml)).

Esgoto adequado segue o critério do Plano Nacional de Saneamento Básico (Plansab), adotado pelo IBGE na divulgação do Censo 2022: rede geral e fossa séptica, ligada ou não à rede.

## Como os textos são escritos

- Todo número de título ou texto é calculado dos dados na hora, nunca escrito à mão; se os dados forem atualizados, os textos acompanham.
- Cada fato vem com os dois lados quando os dados mostram os dois: por exemplo, o esgoto adequado fica abaixo de Santa Catarina, mas é o 2º melhor da região.
- O texto só afirma o que os dados mostram. Interpretações sem base nos números (causas, intenções, quem ganha ou perde) ficam de fora.
- Posições no ranking vêm acompanhadas do valor quando a diferença real é pequena: no meio da fila, cem posições podem separar poucas centenas de reais.

## Fontes

| Tema | Fonte | Tabela ou serviço |
|---|---|---|
| População, área, densidade, crescimento | IBGE, Censo Demográfico 2022 | SIDRA 4714, 4709 |
| População nos censos | IBGE, Censo Demográfico | SIDRA 9605 |
| Pirâmide etária | IBGE, Censo Demográfico 2022 | SIDRA 9514 |
| Situação urbana e rural | IBGE, Censo Demográfico 2022 | SIDRA 9923 |
| Idade mediana, envelhecimento | IBGE, Censo Demográfico 2022 | SIDRA 9756 |
| Alfabetização, instrução | IBGE, Censo Demográfico 2022 | SIDRA 9543, 10061 |
| Rendimento do trabalho | IBGE, Censo Demográfico 2022 | SIDRA 10289 |
| Água, esgoto, lixo | IBGE, Censo Demográfico 2022 | SIDRA 9850, 9397, 9541 |
| Estimativas de população | IBGE, Estimativas de População 2024–2026 | SIDRA 6579 |
| Nascimentos e óbitos | IBGE, Registro Civil 2003–2024 | SIDRA 2612, 2654 |
| PIB e setores | IBGE, PIB dos Municípios 2002–2023 | SIDRA 5938 |
| PIB per capita | IBGE, PIB dos Municípios (série revisada) | IBGE Cidades, indicador 47001 |
| Empresas, emprego, salário | IBGE, Cadastro Central de Empresas 2022–2024 | SIDRA 9509, 9528 |
| Rebanhos, leite | IBGE, Pesquisa da Pecuária Municipal 2025 | SIDRA 3939, 74 |
| Lavouras | IBGE, Produção Agrícola Municipal 2025 | SIDRA 5457 |
| Despesas da prefeitura | Tesouro Nacional, Siconfi | DCA 2025, Anexo I-E |

**Ficaram de fora** fontes sem acesso automatizado estável: o Comex Stat (exportações) respondeu com bloqueio anti-robô, e o Novo Caged só tem microdados em arquivos compactados.

## ODS

- **ODS 4, Educação de qualidade:** letramento em dados para a comunidade.
- **ODS 9, Indústria, inovação e infraestrutura:** solução tecnológica de coleta e visualização de dados.
- **ODS 16, Paz, justiça e instituições eficazes:** acesso a informação pública confiável.

## Requisitos funcionais

1. Mostrar os principais indicadores de Mondaí com a posição no estado e na região.
2. Mostrar a estrutura da população (pirâmide etária, urbana e rural) e sua evolução.
3. Mostrar escolaridade, rendimento e saneamento comparados com Santa Catarina.
4. Mostrar a evolução do PIB, do PIB por habitante e a composição da economia.
5. Mostrar os empregos por setor e a evolução de empresas e pessoal ocupado.
6. Mostrar a evolução dos rebanhos, do leite e o valor das lavouras.
7. Mostrar as despesas da prefeitura por área e por habitante.
8. Comparar qualquer indicador com as cidades vizinhas e exibir o ranking de SC.
9. Comparar Mondaí com qualquer outra cidade de SC.
10. Atualizar todos os dados executando um único script.
11. Registrar nome, cidade, data e hora de cada acesso, e a opinião de quem usa (nota e comentário), numa API própria.
12. Mostrar ao autor os registros, com resumo, gráfico de acessos por dia e download em CSV, numa página protegida por senha.
13. Mostrar no painel um contador público de pessoas e cidades, sem nomes.

## Requisitos não funcionais

1. Funcionar no celular e no computador, sem instalação. Na entrada, pedir só nome e cidade, explicando para que servem.
2. Usar apenas dados oficiais, com fonte e ano indicados em cada gráfico.
3. Conferir automaticamente os códigos das fontes antes de cada atualização.
4. Site estático e API sem servidor próprio, publicados no Cloudflare Pages a partir deste repositório.
5. Acessibilidade: letra ajustável, alto contraste, tabela alternativa e descrição para leitores de tela em cada gráfico.
6. A API recusa envios de outros sites, campos inválidos ou longos demais, e só mostra os registros com senha.

## Desenho universal

| Princípio | Como foi atendido |
|---|---|
| Igualitário | Gratuito e funciona em qualquer navegador; a entrada pede só nome e cidade |
| Adaptável | Letra A−/A+, tema escuro (padrão) ou claro e modo de alto contraste |
| Intuitivo | Posições escritas como "8º maior de SC"; cada indicador mostra as 295 cidades em traços, com Mondaí em destaque |
| Informação perceptível | Cada gráfico tem tabela equivalente e descrição para leitores de tela |
| Tolerância ao erro | Indicadores sem dado aparecem como "sem dado"; o script para em vez de publicar dado errado |
| Baixo esforço físico | Leitura, menu de seções, abas e listas de escolha; nada precisa ser digitado além da entrada |
| Dimensão e espaço | Botões e listas com no mínimo 40 px para toque |

## Registro de acessos e privacidade

Na primeira visita, o painel pede nome e cidade e envia para a rota `/api/registro`, que valida os campos e grava no banco D1 com a data e a hora do servidor. A cidade digitada é padronizada para o nome oficial (por exemplo, "mondai" vira "Mondaí") e passa a personalizar a comparação do site. O navegador guarda um código aleatório, o nome e a cidade, para não pedir de novo e para contar pessoas sem depender do nome digitado. Nenhum outro dado é coletado, e os registros servem apenas para medir o alcance do projeto, como a tela de entrada informa.

## Rodar localmente

```
npm install
npm run banco:local
```

Crie um arquivo `.dev.vars` (fora do Git) com uma senha para a página admin:

```
ADMIN_TOKEN=uma-senha-longa
```

E rode `npm run dev`. O painel fica em `http://localhost:8788` e a página de registros em `http://localhost:8788/admin`.

## Testes

```
npm test                   # API (validação, origem, senha, CSV) e painel (formatação, integridade dos dados)
pipx run ruff check pipeline/
```

Os dois rodam a cada push no GitHub Actions ([`ci.yml`](.github/workflows/ci.yml)).

## Tecnologias

Python (coleta, validação e análise), HTML, CSS, JavaScript (módulos ES, sem build) e Chart.js (visualização), Cloudflare Pages Functions e D1/SQLite (API e banco de registros), Cloudflare Pages (publicação).

## Autor

Luan Henrique Weber, RU 4288658.
