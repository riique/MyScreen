# MyScreen 🎥

> Plataforma completa e profissional de transmissão de tela de alta taxa de quadros (30/60 FPS) e áudio do sistema com câmera concomitante e baixa latência, hospedada em servidor próprio Ubuntu com LiveKit SFU, Next.js 15 e Caddy SSL automático.

---

## 🚀 Principais Funcionalidades

- **Transmissão Concomitante de Tela e Câmera**:
  - Transmita sua tela inteira, janela ou aba do navegador ao mesmo tempo em que sua webcam permanece ativa em Picture-in-Picture (PiP) ou na grade de vídeo.
- **Áudio do Sistema / Aba em Alta Fidelidade**:
  - Captura direta do som do sistema ou da aba (vídeos do YouTube, jogos, músicas, apresentações) transmitido em estéreo junto com o microfone.
- **Lobby Pré-Reunião (Green Room)**:
  - Teste de vídeo da câmera antes de entrar na sala.
  - Indicador de volume do microfone em tempo real (VU Meter via Web Audio API).
  - Seleção de dispositivos de entrada (microfone, câmera) e saída (alto-falantes).
- **Gravação Local de Tela com Áudio (1 Clique)**:
  - Grave a tela e o áudio da reunião diretamente no navegador via `MediaRecorder`, sem consumir processamento do servidor VPS.
  - O contêiner negotiated é **WebM (VP9/VP8) no Chrome/Firefox** e **MP4 (H.264) no Safari** — a extensão do arquivo acompanha o `mimeType` real.
- **Controles Avançados de Mídia**:
  - Seletor de qualidade de tela: 60 FPS (Ultra Fluído para jogos/vídeos), 30 FPS ou 15 FPS; Resoluções 720p, 1080p Full HD e 4K.
  - **Tipo de conteúdo da tela**: "Telas e texto" (`contentHint: detail`, nitidez) ou "Vídeo e jogos" (`motion`, fluidez). Escolher a opção errada deixa o texto ilegível — o encoder gasta o orçamento de quadro a quadro pensando em temporal de algo que não se mexe.
  - Alternadores de áudio: Cancelamento de eco, Supressão de ruído de fundo e Ganho automático (AGC). Aplicados **imediatamente** na track viva, sem precisar mutar o microfone.
- **Conexão remota confiável**:
  - **TURN embutido** (o próprio SFU, sem container coturn): quem está atrás de NAT simétrico, CGNAT (4G/5G) ou firewall corporativo tem caminho de relay.
  - Banner de reconexão cobre a queda do WebSocket de **sinalização** — o caso remoto mais comum.
  - Seletor de tipo de conteúdo, `pixelDensity: 1` e `webAudioMix` para "vejo todos mas não ouço" no iOS.
- **Salas Flexíveis & Segurança Híbrida**:
  - Salas instantâneas com link compartilhável (estilo Google Meet).
  - Salas protegidas por senha com hashing bcrypt (custo 12).
  - Painel de usuário com histórico de salas criadas.
- **Bate-papo em Tempo Real**:
  - Chat de texto integrado à chamada via canal de dados WebRTC do LiveKit.
- **Lista de Participantes**:
  - Visualização em tempo real de quem está na sala, status de microfone/câmera e indicador de quem está falando.
- **Diagnóstico honesto**:
  - O painel de estatísticas mostra quadros descartados, PLI/NACK/FIR e o decoder. Valores não medidos aparecem como `n/d` ou `--` — o app não inventa número de latência.

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
| :--- | :--- |
| **Frontend & Backend** | Next.js 15 (App Router, React 19, TypeScript strict, Tailwind CSS v4, Lucide Icons) |
| **Media Server (SFU)** | LiveKit SFU (Go) via Docker Compose, com TURN embutido |
| **WebRTC SDK** | `@livekit/components-react`, `livekit-client`, `livekit-server-sdk` |
| **Banco de Dados** | SQLite + Prisma ORM (Volume persistente em `/app/data`) |
| **Autenticação** | JWT sem estado assinado via `jose` + Senhas com `bcryptjs` (custo 12) |
| **Reverse Proxy & SSL** | Caddy Server com Let's Encrypt automático (HTTP/2, HTTP/3, WSS) |
| **Orquestração** | Docker Compose + Script de Deploy automatizado para Ubuntu |

---

## 🔐 Configuração — leia antes do primeiro deploy

### Variáveis obrigatórias

O app **não sobe em modo degradado**: `src/lib/env.ts` valida tudo no boot e o processo morre se
faltar qualquer uma. Não existe valor padrão para segredo em lugar nenhum do código — um
fallback hardcoded é o que transforma erro de configuração em falha silenciosa de segurança.

| Variável | Onde | Observação |
| :--- | :--- | :--- |
| `DATABASE_URL` | `.env` | Dentro do Docker: `file:/app/data/database.sqlite` |
| `JWT_SECRET` | `.env` | Mínimo 32 caracteres. `openssl rand -hex 32` |
| `LIVEKIT_API_KEY` | `.env` | **Tem que ser idêntica** ao par em `livekit.yaml` |
| `LIVEKIT_API_SECRET` | `.env` | **Tem que ser idêntica** ao par em `livekit.yaml` |
| `LIVEKIT_URL` | `.env` | URL do SFU vista pelo servidor |
| `NEXT_PUBLIC_LIVEKIT_URL` | `.env` | URL do SFU vista pelo navegador. Só o `next dev` local a usa: no Docker o compose a sobrescreve com `wss://${DOMAIN}` |
| `DOMAIN` | `.env` | Hostname do Caddy, do certificado e do TURN |

> **A chave e o segredo do LiveKit precisam bater exatamente com o par em `livekit.yaml`.**
> Se divergirem, o token é assinado com uma chave que o SFU não conhece e **todo join falha**
> com erro de assinatura. O `deploy.sh` sincroniza os dois a cada execução justamente para
> essa mina não voltar a existir.

### O que entra no git e o que não entra

| Arquivo | Versionado | Por quê |
| :--- | :--- | :--- |
| `.env.example` | sim |só o formato, sem valores |
| `.env` | **não** | segredo de sessão + credenciais do SFU |
| `livekit.yaml.example` | sim | configuração do SFU sem o par de chaves |
| `livekit.yaml` | **não** | contém o par de chaves — o `deploy.sh` o gera |

O `.gitignore` cobre `.env*` e `livekit.yaml`; o `.dockerignore` impede que ambos entrem na
camada de build da imagem (`COPY . .` sem isso embaria o `.env` no registry).

Num clone novo, o `livekit.yaml` não existe — `sudo bash deploy.sh` o cria a partir do
template e preenche o par com o do `.env`. Para desenvolvimento local, copie na mão:

```bash
cp livekit.yaml.example livekit.yaml
```

**Para rotacionar segredos em um servidor já implantado:** edite o `.env` e rode
`sudo bash deploy.sh` de novo. Ele reescreve o par em `livekit.yaml` e recria os containers.
Rotacionar `JWT_SECRET` invalida as sessões abertas (todo mundo precisa logar de novo) — o que
é o comportamento correto depois de um comprometimento.

---

## 🖥️ Como Hospedar no seu Servidor Ubuntu (SSH)

### 1. Clonar ou Transferir o Projeto para o VPS

```bash
git clone <seu-repositorio> myscreen
cd myscreen
```

### 2. Executar o Script de Deploy Automatizado

```bash
chmod +x deploy.sh
sudo bash deploy.sh
```

O script realiza automaticamente:

1. Verificação do **Docker** e **Docker Compose**.
2. Liberação das portas no **UFW** (sem `|| true` — um erro de firewall interrompe o deploy
   em vez de deixar a máquina exposta e o script reportar "sucesso"):
   - `80/tcp` (HTTP → redirect HTTPS)
   - `443/tcp` e `443/udp` (HTTPS e HTTP/3)
   - `3478/tcp` e `3478/udp` (TURN/STUN)
   - `5349/tcp` (TURN sobre TLS, porta dedicada)
   - `50000:60000/udp` (mídia WebRTC)
   - `61000:62000/udp` (relay do TURN embutido)
3. Geração de `.env` com segredos aleatórios (modo `600`) ou manutenção do existente.
4. **Sincronização** do par de chaves do `.env` para dentro do `livekit.yaml`.
5. Build e subida de Caddy + LiveKit + Next.js via `docker compose`.
6. Migração do banco SQLite via Prisma.

> **Por que `7880` e `7881` não aparecem na lista de portas:** o Docker insere DNAT e a chain
> `DOCKER` **antes** das regras do UFW, então qualquer porta em `ports:` fica alcançável da
> internet mesmo com o firewall "fechado". O `docker-compose.yml` deixou de publicar
> `7880`/`7881` — o Caddy já faz o front da sinalização em `/rtc`, e o `7880` responde token
> com `roomAdmin`. Remover a exposição é melhor do que remendar com regras `DOCKER-USER`.

### 3. Verificar que está saudável

```bash
curl -s https://SEU_DOMINIO/api/health
# {"ok":true,"db":"up","dbLatencyMs":1,"at":"..."}

# Métricas do SFU (prometheus)
docker compose exec livekit wget -qO- http://localhost:9090/metrics
```

---

## 🔧 Comandos de Gerenciamento no Servidor

```bash
docker compose ps                    # status dos containers
docker compose logs -f app           # logs da aplicação Next.js
docker compose logs -f livekit       # logs do servidor de mídia
docker compose logs -f caddy         # logs do Caddy/SSL
docker compose restart               # reiniciar todos os serviços
docker compose down                  # parar todos os serviços
```

Os logs têm rotação configurada (`max-size: 10m`, `max-file: 3`). Sem isso o driver
`json-file` cresce até encher o disco — e quando o disco enche, o SQLite vai junto.

---

## 💻 Como Rodar Localmente (Desenvolvimento)

### 1. Dependências e banco

```bash
npm install
npx prisma generate
npx prisma db push
cp .env.example .env   # e preencha os segredos (openssl rand -hex 32)
```

### 2. Servidor de mídia LiveKit

```bash
docker run --rm -p 7880:7880 -p 7881:7881 -p 3478:3478/udp -p 50000-60000:50000-60000/udp \
  livekit/livekit-server --dev
```

### 3. Next.js

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

### 4. Verificação

```bash
npm run check      # typecheck (tsc --noEmit) + lint (eslint) + testes (vitest)
```

### 5. Testes

```bash
npm test           # uma passada
npm run test:watch
```

Os testes cobrem as invariantes de segurança, nao o wiring: a claim `userId`
obrigatória no token de sessão (sem ela o Prisma devolve **todas** as salas), o
teto de **72 bytes** do bcrypt antes de qualquer chamada à KDF, o rate limit por
escopo + IP, a estabilidade da identidade do participante e a rejeição de
identidade pertencente a outro apelido.

O `vitest.config.mts` injeta o `JWT_SECRET` de teste por `test.env` — os
handlers leem `process.env` no import, e o `.env` local pode não existir em CI.
Nenhum teste toca o banco real: o Prisma é a fronteira mockada, e o `bcrypt` é
observado por spy justamente para afirmar o que **não** deve chegar à KDF.

---

## 🛡️ Portas e Requisitos de Rede

| Porta | Protocolo | Utilidade |
| :--- | :--- | :--- |
| **80** | TCP | Desafio ACME e redirecionamento HTTPS |
| **443** | TCP / UDP | Acesso Web seguro (HTTPS/WSS) e HTTP/3 |
| **3478** | TCP / UDP | STUN e TURN (padrão) |
| **5349** | TCP | TURN sobre TLS — **não** coloque atrás do Caddy |
| **50000-60000** | UDP | Áudio, vídeo e tela WebRTC |
| **61000-62000** | UDP | Relay do TURN embutido |

Sinais de que o TURN está mal configurado, em ordem de frequência: participante aparece
duplicado após reconectar, a chamada cai em 4G mas funciona no Wi-Fi do escritório, ou o
`getStats` do cliente mostra candidato `relay` onde deveria mostrar `srflx`.

O TURN **não** fica atrás do Caddy: TURN/TLS é stream STUN cru, não HTTP, e roteamento por
path é impossível. Se um dia for preciso TURN na 443, o Caddy stock não faz L4/SNI — exige
build custom com `caddy-l4`. Por enquanto, `5349` dedicado resolve.

---

## 📝 Licença

Desenvolvido com foco em alta performance e código limpo. Distribuído sob licença MIT.
