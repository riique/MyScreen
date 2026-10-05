# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Pessoa técnica usando o MyScreen para mostrar a própria tela a poucas pessoas — um colega em
call, um aluno, um cliente. A sessão é 1–few: pouca gente, uma tela compartilhada por vez, e o
peso real do produto está em como a captura sai nítida e com som, não no número de
participantes.

Estado de uso típico: a pessoa já sabe o que vai mostrar (uma tela de código, um vídeo, uma
apresentação, um jogo) e o atrito que a machuca é estar atrás de NAT, perder a sala, ou
descobrir que o texto ficou ilegível porque escolheu a opção de encode errada.

## Product Purpose

MyScreen é uma plataforma self-hosted de transmissão de tela em alta taxa de quadros com áudio
do sistema e câmera concomitante. Existe para rodar num Ubuntu próprio (Docker Compose: Caddy +
LiveKit SFU + Next.js) sem depender de um serviço de terceiros.

O que o produto faz possível: compartilhar tela, janela ou aba a 60/30/15 FPS em 720p/1080p/4K,
com o som do sistema viajando junto do microfone, sem conta nem cadastro, com chat,
lista de participantes e um painel de estatísticas honesto.

Sucesso, na leitura do usuário: a outra pessoa vê a mesma coisa que ele vê, com texto legível e
som sincronizado, na primeira tentativa, atrás de qualquer rede.

## Positioning

Diferencial real e verificável, não slogan: transmissão de tela com **áudio do sistema** e
**alta taxa de quadros** (60 FPS) é o que separa o MyScreen de uma videochamada comum, e o
produto assume isso na interface em vez de fingir ser um clone de Meet. Três concretudes que
nenhum concorrente copia colando: o seletor de **tipo de conteúdo da tela** (`detail` vs
`motion`) com o porquê explicado em linguagem leiga; o **TURN embutido no próprio SFU**, então
não existe container coturn para quebrar; e o painel de estatísticas que mostra `n/d` e `--` para
o que não mediu, em vez de inventar número de latência.

O produto é auto-hospedado por escolha, não por limitação: quem instala tem o servidor, a chave
do TLS e o banco. Isso é posicionamento, e a interface deve falar com quem controla a própria
máquina.

## Operating Context

- Servidor Ubuntu próprio, `sudo bash deploy.sh`, containers Caddy (TLS automático) + LiveKit
  SFU + Next.js, SQLite persistente em `/app/data`.
- O usuário do produto **é** o operador do servidor: ele roda o deploy, gira o par de chaves
  LiveKit entre `.env` e `livekit.yaml`. Não existem contas: quem tem o link entra.
- O app não sobe em modo degradado: `src/lib/env.ts` valida tudo no boot e o processo morre se
  faltar variável. Não existe fallback hardcoded de segredo.
- Reunião real, não demo: a pessoa entra, testa câmera e microfone no lobby, escolhe resolução,
  FPS, tipo de conteúdo e saída de áudio, e entra.
- Diagnóstico remoto: participante duplicado depois de reconectar, chamada caindo em 4G mas
  funcionando no Wi-Fi, candidato `relay` onde deveria ser `srflx`.

## Capabilities and Constraints

Capabilities confirmadas em código e README:

- Compartilhamento de tela + janela + aba, com câmera em Picture-in-Picture ou na grade.
- Captura de áudio do sistema/aba, estéreo, junto do microfone.
- Lobby pré-reunião: preview de vídeo, VU meter, seleção de microfone/câmera/saída.
- Qualidade: 60/30/15 FPS em 720p/1080p/4K. Tipo de conteúdo: `detail` (nitidez) ou `motion`
  (fluidez).
- Processamento de áudio: cancelamento de eco, supressão de ruído, AGC, aplicados na track viva.
- Salas sem conta, com link, opcionalmente protegidas por senha (bcrypt custo 12).
- Chat em tempo real, lista de participantes com estado de microfone/câmera e quem está falando.
- Painel de estatísticas: quadros descartados, PLI/NACK/FIR, decoder, candidato ICE.
- Sem contas nem sessão; rate limit por escopo + IP na criação de sala e na emissão de token.

Constraints que trabalho futuro precisa preservar:

- **Escopo do redesign confirmado pelo usuário:** front-end e hooks de mídia reescritos do zero
  (todo `.tsx` de interface, `globals.css`, tokens, fontes, e também `ConferenceRoom`,
  `GreenRoom`, `MediaControls`, `SettingsModal`, `LocalRecorder`, `TrackStatsDropdown`).
  Preservados e não reescritos: `src/app/api/`, `src/lib/` (`auth`, `env`, `rate-limit`,
  `validate`, `livekit`, `prisma`), `prisma/schema.prisma` e os testes de segurança que os
  cobrem. A integração com o SDK `livekit-client` é a única coisa que sobrevive da camada de
  mídia, porque é ela que faz a chamada funcionar.
- Tema padrão: **branco**, com tema escuro opcional pelo botão do topo (escolha salva no navegador).
- UI e copy em português (pt-BR). Sem i18n nesta rodada.
- Stack fixa: Next.js 15 App Router, React 19, TypeScript strict, Tailwind v4, lucide-react.
- O `html` é `lang="pt-BR"` e o app usa `min-h-dvh` + `viewportFit: "cover"`; rodapé de
  viewport móvel é território de iOS Safari e precisa de cuidado explícito.

Open decisions (registradas, não inventadas):

- Identidade de produto além do nome.
- Estratégia comercial: o produto é distribuído sob MIT e não tem preço, plano nem oferta.
  Nada na interface pode prometer capacidade de plano que não existe.

## Brand Commitments

Nome **MyScreen** mantido. Locked: pt-BR, sem i18n, sem claims comerciais inventados.

O tom de voz que o produto já demonstra e que a interface precisa carregar: engineer-honest.
O README e os textos do produto já explicam *por que* cada escolha existe ("escolher a opção
errada deixa o texto ilegível — o encoder gasta o orçamento de quadro a quadro pensando em
temporal de algo que não se mexe"). Copy que explica o mecanismo em vez de bater slogan.

Bindings do usuário: "visual simples mas premium". Simplicidade e premium não são o mesmo eixo:
simples é densidade (uma tela, uma ação primária, nada competindo); premium é acabamento
(grade, ritmo, peso de linha, resposta). Nada de efeito decorativo que não execute trabalho.

## Evidence on Hand

O que existe de fato e pode ser usado como verdade visual e factual:

- Copy e produto em `README.md` (documentação densa, em pt-BR) e nos textos das páginas e
  componentes atuais.
- `src/components/conference/TrackStatsDropdown.tsx` — o painel de estatísticas honestas, com
  o vocabulário real de WebRTC (PLI, NACK, FIR, decoder, relay) que a interface precisa recriar.
- `livekit.yaml`, `docker-compose.yml`, `deploy.sh` — a stack de hospedagem é real e verificável.
- `src/app/api/health` — devolve `{ok, db, dbLatencyMs, at}`; serve de verdade verificável para
  qualquer seção de status.

Ausências, que trabalho futuro **não pode fabricar**:

- Não existe logo, favicon, marca registrada ou identidade visual própria. `public/` contém
  apenas `robots.txt`.
- Não existem screenshots, estudos de caso, depoimentos, logos de clientes, números de usuários,
  benchmarks ou logos de sponsors. Nenhuma seção de prova social pode ser inventada.
- Não existe material de demonstração gravado. Qualquer imagem de produto que a interface precise
  é ilustrativa e precisa ser rotulada como tal, ou desenhada no próprio código.

## Product Principles

1. **A tela compartilhada é o produto.** Toda superfície de conferência põe o vídeo em evidência
   e trata tudo o mais como moldura. Nada de interface que dispute atenção com a coisa que
   está sendo mostrada.
2. **Explicar o mecanismo vale mais que declarar a feature.** Cada controle não óbvio (tipo de
   conteúdo, cancelamento de eco, TURN) diz o que faz e por que se importa, em uma linha.
3. **Honestidade instrumental.** O que não foi medido aparece como não medido. A interface
   herda esse princípio: sem badge decorativo, sem número inventado, sem estado que finja
   certeza.
4. **Interface de operador, não de consumo.** Quem usa controla a própria máquina; a interface
   fala com uma pessoa técnica, com densidade e sem copy publicitária.
5. **Simples é densidade, premium é acabamento.** Uma ação primária por tela, hierarquia feita
   por espaço e peso, e acabamento fino no detalhe — nunca mais um elemento na tela.

## Accessibility & Inclusion

Sem requisito específico confirmado pelo usuário nesta rodada. Expectations padrão de um produto
web: contraste suficiente, foco visível, navegação por teclado na sala e nos modais, e nenhuma
informação transmitida só por cor. O estado de microfone/câmera e o indicador de quem está
falando têm forma textual ou `aria`, não só cor.
