#!/usr/bin/env bash

# ==============================================================================
# MyScreen — Script de Deploy Automatizado para Ubuntu VPS
# Transmissão de Tela, Câmera e Áudio em Tempo Real via LiveKit SFU + Next.js
# ==============================================================================

set -euo pipefail

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
    echo -e "${RED}Execute como root ou com sudo.${NC}"
    exit 1
fi

echo -e "\n${YELLOW}[1/7] Verificando Docker e Docker Compose...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker não encontrado. Instale com: sudo apt install docker.io docker-compose-v2${NC}"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo -e "${RED}Docker Compose v2 não encontrado.${NC}"
    exit 1
fi

# 2. Configurar Firewall (UFW)
#
#    ATENÇÃO: o UFW NÃO protege o que o Docker publica. O Docker insere DNAT +
#    a chain DOCKER antes das regras de input-filter, então qualquer porta em
#    `ports:` do compose fica alcançável da internet mesmo com o firewall
#    "fechado". A exposição real é controlada pelo docker-compose.yml — que
#    parou de publicar 7880/7881. Estas regras são a segunda camada, não a
#    primeira.
echo -e "\n${YELLOW}[2/7] Configurando regras de Firewall (UFW) para WebRTC e HTTPS...${NC}"
if command -v ufw &> /dev/null; then
    echo "Liberando portas necessárias:"
    echo " - 80/tcp (HTTP -> redirect HTTPS)"
    echo " - 443/tcp, 443/udp (HTTPS & HTTP/3)"
    echo " - 3478/tcp+udp (TURN/STUN)"
    echo " - 5349/tcp (TURN sobre TLS, porta dedicada)"
    echo " - 50000:60000/udp (mídia WebRTC)"
    echo " - 61000:62000/udp (relay do TURN embutido)"

    # Sem `|| true`: um erro de firewall tem que interromper o deploy, não ser
    # engolido e deixar a máquina exposta com o script reportando "sucesso".
    # `ufw allow` é idempotente — rodar de novo não cria duplicata.
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 443/udp
    ufw allow 3478/udp
    ufw allow 3478/tcp
    ufw allow 5349/tcp
    ufw allow 50000:60000/udp
    ufw allow 61000:62000/udp
    ufw --force enable
    echo -e "${GREEN}✓ Regras de firewall configuradas.${NC}"
else
    echo -e "${YELLOW}UFW não detectado. Libere no provedor: 80, 443, 3478/tcp+udp, 5349/tcp e 50000-62000/udp.${NC}"
fi

# 3. Configurar Variáveis de Ambiente (.env)
echo -e "\n${YELLOW}[3/7] Configurando variáveis de ambiente...${NC}"

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
    RAND_SECRET=$(openssl rand -hex 32)

    cat > .env <<EOF
DATABASE_URL="file:/app/data/database.sqlite"
JWT_SECRET="${RAND_JWT}"
LIVEKIT_API_KEY="${RAND_KEY}"
LIVEKIT_API_SECRET="${RAND_SECRET}"
LIVEKIT_URL="http://livekit:7880"
NEXT_PUBLIC_LIVEKIT_URL="wss://${USER_DOMAIN}"
DOMAIN="${USER_DOMAIN}"
EOF

    echo -e "${GREEN}✓ Arquivo .env gerado com chaves seguras.${NC}"
else
    echo -e "${GREEN}✓ Arquivo .env existente encontrado. Mantendo configurações atuais.${NC}"
fi

chmod 600 .env

# 4. Sincronizar as chaves do LiveKit com o .env
#
#    Este passo elimina a mina latente: o par em `livekit.yaml` precisa ser
#    IDÊNTICO a LIVEKIT_API_KEY/LIVEKIT_API_SECRET. Se divergir, o token é
#    assinado com uma chave que o SFU não conhece e TODO JOIN FALHA. Rodar em
#    todo deploy evita ter que lembrar de sincronizar à mão.
#
#    O `livekit.yaml` real NÃO é versionado (contém o par de chaves); o
#    template versionado é `livekit.yaml.example`. Num clone novo o arquivo
#    simplesmente não existe e é criado a partir do template.
echo -e "\n${YELLOW}[4/7] Sincronizando chaves do LiveKit com o .env...${NC}"

# shellcheck disable=SC1091
set -a; source .env; set +a

: "${LIVEKIT_API_KEY:?LIVEKIT_API_KEY ausente no .env}"
: "${LIVEKIT_API_SECRET:?LIVEKIT_API_SECRET ausente no .env}"
: "${JWT_SECRET:?JWT_SECRET ausente no .env}"

if [ "${#JWT_SECRET}" -lt 32 ]; then
    echo -e "${RED}JWT_SECRET tem menos de 32 caracteres. Gere um novo com: openssl rand -hex 32${NC}"
    exit 1
fi

# O SQLite precisa cair no volume `app-data`. Um path relativo no `.env` e
# resolvido contra /app/prisma/ e o banco desaparece a cada `up --build`.
# O compose ja declara o path correto; aqui nao ha nada a normalizar, mas o
# aviso evita que alguem reintroduza o caminho relativo sem perceber.
if grep -q '^DATABASE_URL="file:\./' .env; then
    echo -e "${YELLOW}! DATABASE_URL no .env e relativo. O compose sobrescreve com o path do volume (file:/app/data/database.sqlite).${NC}"
fi

if [ ! -f livekit.yaml ]; then
    echo -e "${BLUE}livekit.yaml não encontrado (clone novo). Criando a partir do template.${NC}"
    cp livekit.yaml.example livekit.yaml
fi

# Reescreve o bloco `keys:` (chave + segredo) com o par do .env. Idempotente:
# rodar o deploy N vezes deixa sempre exatamente um par, igual ao do .env.
awk -v pair="  ${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}" '
  /^keys:[[:space:]]*$/ && !replaced { print; print pair; print ""; replaced=1; skip=1; next }
  skip && /^[^[:space:]#]/ { skip=0; print; next }
  skip { next }
  { print }
  END { if (!replaced) { print "keys:"; print pair } }
' livekit.yaml > livekit.yaml.tmp
mv livekit.yaml.tmp livekit.yaml

# O domínio do TURN embutido precisa ser o mesmo hostname do certificado TLS.
sed -i -E "s|^  domain: .*|  domain: ${DOMAIN}|" livekit.yaml

echo -e "${GREEN}✓ livekit.yaml sincronizado com o .env.${NC}"

# 5. Criar diretório de dados persistentes para o SQLite
echo -e "\n${YELLOW}[5/7] Preparando volume persistente de dados...${NC}"
mkdir -p data
echo -e "${GREEN}✓ Diretório de dados pronto.${NC}"

# 6. Construir e iniciar os containers Docker
echo -e "\n${YELLOW}[6/7] Construindo imagens e subindo containers (Caddy + LiveKit + Next.js)...${NC}"
# NOTA: este é o `docker-compose.yml` (que tem o Caddy). Não existe um compose
# de produção separado — o antigo era código morto, e o `.env.prod` que o
# alimentava tinha um par de chaves diferente do `livekit.yaml`.
docker compose down || true
docker compose up -d --build

# 7. Sincronizar banco de dados SQLite dentro do container
echo -e "\n${YELLOW}[7/7] Verificando o schema do banco (serviço one-shot)...${NC}"
# O schema e aplicado pelo serviço `migrate` do compose, que roda ANTES do app
# atender (o app tem `depends_on: migrate: service_completed_successfully`).
# Nao ha passo de `npx prisma` aqui: a CLI nao existe na imagem de runtime e o
# `npx` resolveria o pacote do registry a cada deploy.
echo -e "${GREEN}✓ Schema aplicado pelo serviço migrate antes do app subir.${NC}"

# Conclusão
echo -e "\n${GREEN}==================================================================${NC}"
echo -e "${GREEN}           ✓ MyScreen foi implantado com sucesso!                 ${NC}"
echo -e "${GREEN}==================================================================${NC}"
echo -e "Acesse a aplicação em:"
if [ "${DOMAIN}" = "localhost" ]; then
    echo -e "  ${YELLOW}http://localhost${NC}"
else
    echo -e "  ${YELLOW}https://${DOMAIN}${NC}"
fi
echo -e "\nVerifique a aplicação (de fora da sua rede):"
echo -e "  ${YELLOW}curl -s https://${DOMAIN}/api/health${NC}"
echo -e "\nComandos úteis:"
echo -e " - Ver logs da aplicação:  ${YELLOW}docker compose logs -f app${NC}"
echo -e " - Ver logs do LiveKit:    ${YELLOW}docker compose logs -f livekit${NC}"
echo -e " - Ver logs do Caddy SSL:  ${YELLOW}docker compose logs -f caddy${NC}"
echo -e " - Métricas do SFU:        ${YELLOW}docker compose exec livekit wget -qO- http://localhost:9090/metrics${NC}"
echo -e " - Rotacionar segredos:    ${YELLOW}edite o .env e rode este script de novo${NC}"
echo -e " - Reiniciar serviços:     ${YELLOW}docker compose restart${NC}"
echo -e " - Parar serviços:         ${YELLOW}docker compose down${NC}"
echo -e "${GREEN}==================================================================${NC}\n"
