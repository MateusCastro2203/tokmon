# Landing page do tokmon — design

Data: 2026-07-23

## Objetivo

Página única de divulgação (não documentação completa) pro `tokmon-app`, hospedada via GitHub Pages a partir do próprio repo `MateusCastro2203/tokmon`. Estética pixel art com um mascote dragão original (inspirado na vibe de dragões de bolso tipo Charizard, mas forma/paleta/nome inteiramente originais — sem usar personagens, sprites ou marcas registradas de terceiros).

Aprovado interativamente via superpowers:brainstorming visual companion (mockups em `.superpowers/brainstorm/`, não versionados).

## Identidade visual

- **Fundo:** cinza acizentado claro — página `#f5f3ef`, cards/seções `#eae7e1`.
- **Fonte de destaque:** "Press Start 2P" (Google Fonts) pra títulos/pixel font; corpo de texto em monospace comum.
- **Paleta do mascote — "Coral Drake":**
  - corpo: `#e63946` (vermelho-coral)
  - barriga: `#f1faee` (quase-branco)
  - asas: `#1d3557` (azul-marinho)
  - contorno/chifre: `#641220`
  - fogo: `#ffb703` (miolo) / `#fb8500` (ponta da cauda e respiro)
  - olhos: `#1a1a1a`
- **Mascote:** dragãozinho chibi frontal e simétrico, 16×16 pixel art (grid de `<rect>` em SVG, `shape-rendering: crispEdges`) — chifres pequenos, cabeça arredondada, asas abertas nos dois lados, barriga clara, pernas curtas, rabinho com ponta em chama espiando pelo lado direito, e um sopro de fogo pelos pés (entre as pernas).

## Estrutura da página (uma página só, seções em ordem)

1. **Nav:** `🐉 tokmon` (pixel font) à esquerda, links GitHub/npm à direita.
2. **Hero (layout centralizado — Opção A aprovada):**
   - Mascote grande centralizado.
   - Título `TOKMON` em pixel font.
   - Tagline (tom bem-humorado, "dragãozinho que cospe fogo a cada token gasto").
   - Comando de instalação em destaque: `$ npm install -g tokmon-app`.
   - 3 badges de feature: `📊 snapshot`, `🔥 watch`, `🧠 statusline`.
3. **Seção "Como funciona":** 3 cards lado a lado, um por comando (`tokmon snapshot`, `tokmon watch`, `tokmon setup`), cada um com o comando em destaque + 1-2 frases de descrição.
4. **Seção "Veja rodando" — easter egg Game Boy:**
   - Ilustração de um console portátil fictício rotulado **"TOKMON POCKET"** (nome inventado — nunca usar "Game Boy"/"Nintendo" como texto/marca na página).
   - Tela verde (paleta DMG clássica: `#0f380f`/`#306230`/`#8bac0f`/`#9bbc0f`) mostrando o MESMO mascote recolorido em monocromático + uma "tela de status" estilo RPG: nome, "Lv.", tokens totais, e uma barra estilo HP que representa o **context window real** — cor da barra usa a mesma paleta de severidade que `buildViewModel`/`watch.mjs` já usam (`ok`=verde, `warn`=amarelo `#eab308`, `danger`=vermelho).
   - D-pad e botões A/B decorativos (rotulados com os comandos: D-pad="SNAPSHOT", A="WATCH", B="SETUP") — só estética, não são funcionais (página estática).
   - Abaixo do console: bloco de terminal real (fundo escuro `#161616`) mostrando um trecho de saída de texto verdadeira do `tokmon watch`, pra quem quiser ver o output real sem o filtro do easter egg.
5. **Footer:** `MIT License · feito com 🔥 por Mateus Castro` à esquerda, link do GitHub à direita.

## Implementação

- Arquivo único: `docs/index.html` no repo `tokmon` (raiz do conteúdo servido pelo GitHub Pages a partir da pasta `/docs` da branch `master`).
- Sem framework, sem build step — HTML+CSS+SVG inline, mesma filosofia "sem dependência" do resto do projeto.
- Hospedagem: GitHub Pages configurado para servir `/docs` da branch `master` (decisão já tomada no brainstorm).
- Fora de escopo agora: GIF/vídeo de demo real (adiado — sem `vhs`/`asciinema` disponíveis no momento); suporte a Windows nativo na CLI (adiado, tema separado).

## Teste

Página estática sem lógica — validação é visual: abrir o HTML localmente no browser e no preview do Artifact tool antes de publicar; conferir que os valores mostrados na tela Game Boy (7.7M tok, 70%) batem com o mesmo tom dos exemplos já usados no README (não precisam ser dados reais, é ilustrativo).
