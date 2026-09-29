#!/usr/bin/env bash

# ==============================================================================
# MyScreen — Script de Deploy Automatizado para Ubuntu VPS
# Transmissão de Tela, Câmera e Áudio em Tempo Real via LiveKit SFU + Next.js
# ==============================================================================

set -e

# Cores para feedback visual
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================================================${NC}"
echo -e "${BLUE}           MyScreen — Assistente de Deploy para Ubuntu            ${NC}"
echo -e "${BLUE}==================================================================${NC}"

# 1. Verificar privilégios sudo/root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Por favor, execute este script com permissões sudo ou como root:${NC}"
  echo -e "  sudo bash deploy.sh"
  exit 1
fi

echo -e "\n${YELLOW}[1/6] Verificando Docker e Docker Compose...${NC}"

if ! command -v docker &> /dev/null; then
  echo -e "${YELLOW}Docker não encontrado. Instalando Docker oficial automaticamente...${NC}"
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo -e "${GREEN}✓ Docker instalado com sucesso.${NC}"
else
  echo -e "${GREEN}✓ Docker já está instalado.${NC}"
fi

# Verificar plugin docker compose
if ! docker compose version &> /dev/null; then
  echo -e "${YELLOW}Docker Compose plugin não encontrado. Instalando...${NC}"
  apt-get install -y docker-compose-plugin
  echo -e "${GREEN}✓ Docker Compose instalado com sucesso.${NC}"
else
  echo -e "${GREEN}✓ Docker Compose já está instalado.${NC}"
fi

# 2. Configurar Firewall (UFW)
echo -e "\n${YELLOW}[2/6] Configurando regras de Firewall (UFW) para WebRTC e HTTPS...${NC}"
if command -v ufw &> /dev/null; then
  echo "Liberando portas necessárias:"
  echo " - 80/tcp (HTTP Let's Encrypt)"
  echo " - 443/tcp, 443/udp (HTTPS & HTTP/3)"
  echo " - 7880/tcp (LiveKit Signaling)"
  echo " - 7881/tcp (LiveKit WebRTC TCP)"
  echo " - 3478/udp (LiveKit STUN/TURN)"
  echo " - 50000:60000/udp (LiveKit Media Traffic)"

  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
  ufw allow 443/udp || true
  ufw allow 7880/tcp || true
  ufw allow 7881/tcp || true
  ufw allow 3478/udp || true
  ufw allow 50000:60000/udp || true
  echo -e "${GREEN}✓ Regras de firewall configuradas.${NC}"
else
  echo -e "${YELLOW}UFW não detectado. Certifique-se de liberar as portas 80, 443, 7880, 7881, 3478/udp e 50000-60000/udp no seu provedor VPS.${NC}"
fi

# 3. Configurar Variáveis de Ambiente (.env)
echo -e "\n${YELLOW}[3/6] Configurando variáveis de ambiente...${NC}"

if [ ! -f .env ]; then
  echo -e "${BLUE}Configuração inicial detectada.${NC}"
  
  # Solicitar domínio
  read -p "Digite o seu domínio ou subdomínio (ex: live.meudominio.com ou IP do VPS): " USER_DOMAIN
  if [ -z "$USER_DOMAIN" ]; then
    USER_DOMAIN="localhost"
  fi

  # Gerar chaves aleatórias seguras
  RAND_JWT=$(openssl rand -hex 32)
  RAND_KEY="myscreen_$(openssl rand -hex 6)"
  RAND_SECRET=$(openssl rand -hex 24)

  cat > .env <<EOF
DATABASE_URL="file:/app/data/database.sqlite"
JWT_SECRET="${RAND_JWT}"
LIVEKIT_API_KEY="${RAND_KEY}"
LIVEKIT_API_SECRET="${RAND_SECRET}"
LIVEKIT_URL="http://livekit:7880"
NEXT_PUBLIC_LIVEKIT_URL="wss://${USER_DOMAIN}"
DOMAIN="${USER_DOMAIN}"
EOF

  # Atualizar livekit.yaml com as mesmas credenciais
  cat > livekit.yaml <<EOF
port: 7880
bind_addresses:
  - ""

rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
  stun_servers:
    - stun.l.google.com:19302
    - stun1.l.google.com:19302

keys:
  ${RAND_KEY}: ${RAND_SECRET}

room:
  empty_timeout: 300
  max_participants: 100

logging:
  level: info
EOF

  echo -e "${GREEN}✓ Arquivo .env e livekit.yaml gerados com chaves seguras.${NC}"
else
  echo -e "${GREEN}✓ Arquivo .env existente encontrado. Mantendo configurações atuais.${NC}"
fi

# 4. Criar diretório de dados persistentes para o SQLite
echo -e "\n${YELLOW}[4/6] Preparando volume persistente de dados...${NC}"
mkdir -p data
echo -e "${GREEN}✓ Diretório de dados pronto.${NC}"

# 5. Construir e iniciar os containers Docker
echo -e "\n${YELLOW}[5/6] Construindo imagens e subindo containers (Caddy + LiveKit + Next.js)...${NC}"
docker compose down || true
docker compose up -d --build

# 6. Sincronizar banco de dados SQLite dentro do container
echo -e "\n${YELLOW}[6/6] Sincronizando tabelas do banco de dados (Prisma)...${NC}"
sleep 5
docker compose exec -T app npx prisma db push || true

# Conclusão
DOMAIN_VAL=$(grep DOMAIN .env | cut -d '=' -f2 | tr -d '"')
echo -e "\n${GREEN}==================================================================${NC}"
echo -e "${GREEN}           ✓ MyScreen foi implantado com sucesso!                 ${NC}"
echo -e "${GREEN}==================================================================${NC}"
echo -e "Acesse a aplicação em:"
if [ "$DOMAIN_VAL" = "localhost" ]; then
  echo -e "  ${BLUE}http://localhost:3000${NC} ou ${BLUE}http://localhost${NC}"
else
  echo -e "  ${BLUE}https://${DOMAIN_VAL}${NC}"
fi
echo -e "\nComandos úteis:"
echo -e " - Ver logs da aplicação:  ${YELLOW}docker compose logs -f app${NC}"
echo -e " - Ver logs do LiveKit:    ${YELLOW}docker compose logs -f livekit${NC}"
echo -e " - Ver logs do Caddy SSL:  ${YELLOW}docker compose logs -f caddy${NC}"
echo -e " - Reiniciar serviços:     ${YELLOW}docker compose restart${NC}"
echo -e " - Parar serviços:         ${YELLOW}docker compose down${NC}"
echo -e "${GREEN}==================================================================${NC}\n"
