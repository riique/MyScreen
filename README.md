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
  - Grave a tela e o áudio da reunião diretamente no navegador via `MediaRecorder` em formato WebM HD sem consumir processamento do servidor VPS.
- **Controles Avançados de Mídia**:
  - Seletor de qualidade de tela: 60 FPS (Ultra Fluído para jogos/vídeos), 30 FPS ou 15 FPS; Resoluções 720p, 1080p Full HD e 4K.
  - Alternadores de áudio: Cancelamento de eco, Supressão de ruído de fundo e Ganho automático (AGC).
- **Salas Flexíveis & Segurança Híbrida**:
  - Salas instantâneas com link compartilhável (estilo Google Meet).
  - Salas protegidas por senha com hashing bcrypt.
  - Painel de usuário com histórico de salas criadas.
- **Bate-papo em Tempo Real**:
  - Chat de texto integrado à chamada via canal de dados WebRTC do LiveKit.
- **Lista de Participantes**:
  - Visualização em tempo real de quem está na sala, status de microfone/câmera e indicador de quem está falando.

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
| :--- | :--- |
| **Frontend & Backend** | Next.js 15 (App Router, React 19, TypeScript, Tailwind CSS, Lucide Icons) |
| **Media Server (SFU)** | LiveKit SFU (Go) via Docker Compose |
| **WebRTC SDK** | `@livekit/components-react`, `livekit-client`, `livekit-server-sdk` |
| **Banco de Dados** | SQLite + Prisma ORM (Volume persistente em `/app/data`) |
| **Autenticação** | JWT sem estado assinado via `jose` + Senhas com `bcryptjs` |
| **Reverse Proxy & SSL** | Caddy Server com Let's Encrypt automático (HTTP/2, HTTP/3, WSS) |
| **Orquestração** | Docker Compose + Script de Deploy automatizado para Ubuntu |

---

## 🖥️ Como Hospedar no seu Servidor Ubuntu (SSH)

### 1. Clonar ou Transferir o Projeto para o VPS
Acesse seu servidor Ubuntu via SSH e clone o repositório ou envie os arquivos para uma pasta:

```bash
git clone <seu-repositorio> myscreen
cd myscreen
```

### 2. Executar o Script de Deploy Automatizado
Dê permissão de execução ao script `deploy.sh` e rode como `sudo`:

```bash
chmod +x deploy.sh
sudo bash deploy.sh
```

O script realizará automaticamente:
1. Verificação e instalação do **Docker** e **Docker Compose** (caso ainda não estejam instalados).
2. Liberação automática das portas no firewall **UFW**:
   - `80/tcp` (HTTP Let's Encrypt)
   - `443/tcp` e `443/udp` (HTTPS seguro e HTTP/3 QUIC)
   - `7880/tcp` (Sinalização LiveKit)
   - `7881/tcp` (Fallback WebRTC TCP)
   - `3478/udp` (STUN/TURN do LiveKit)
   - `50000-60000/udp` (Tráfego de mídia WebRTC de alta performance)
3. Geração de chaves criptográficas aleatórias e seguras no `.env` e `livekit.yaml`.
4. Configuração do domínio apontado para o VPS (com geração e renovação automática de certificado SSL gratuito via Let's Encrypt pelo Caddy).
5. Build e inicialização de todos os containers via `docker compose`.
6. Migração inicial do banco de dados SQLite via Prisma.

---

## 🔧 Comandos de Gerenciamento no Servidor

Após a instalação, você pode gerenciar o MyScreen com comandos simples do Docker Compose:

```bash
# Ver status dos containers
docker compose ps

# Acompanhar logs em tempo real
docker compose logs -f

# Acompanhar logs específicos da aplicação Next.js
docker compose logs -f app

# Acompanhar logs do servidor de mídia LiveKit
docker compose logs -f livekit

# Acompanhar logs do Caddy SSL
docker compose logs -f caddy

# Reiniciar todos os serviços
docker compose restart

# Parar todos os serviços
docker compose down
```

---

## 💻 Como Rodar Localmente (Desenvolvimento)

Caso queira testar ou desenvolver na sua máquina local:

### 1. Instalar Dependências
```bash
npm install
```

### 2. Gerar Prisma Client e Banco de Dados Local
```bash
npx prisma generate
npx prisma db push
```

### 3. Iniciar o Servidor de Mídia LiveKit (Localmente via Docker)
```bash
docker run --rm -p 7880:7880 -p 7881:7881 -p 3478:3478/udp -p 50000-60000:50000-60000/udp livekit/livekit-server --dev
```

### 4. Iniciar o Next.js
```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000) no seu navegador.

---

## 🛡️ Portas e Requisitos de Rede

| Porta | Protocolo | Utilidade |
| :--- | :--- | :--- |
| **80** | TCP | Desafio ACME e redirecionamento HTTPS |
| **443** | TCP / UDP | Acesso Web seguro (HTTPS/WSS) e HTTP/3 |
| **7880** | TCP | WebSocket e API do LiveKit |
| **7881** | TCP | Fallback de WebRTC via TCP |
| **3478** | UDP | Servidor STUN/TURN integrado |
| **50000-60000** | UDP | Tráfego de áudio, vídeo e tela WebRTC |

---

## 📝 Licença
Desenvolvido com foco em alta performance e código limpo. Distribuído sob licença MIT.
