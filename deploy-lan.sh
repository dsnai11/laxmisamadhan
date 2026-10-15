#!/bin/bash

# IT Ticketing Portal - LAN Deployment Script
# Usage: ./deploy-lan.sh [LAN_IP] [DOMAIN] [--ssl] [--build-only] [--no-cache]

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

LAN_IP=""
DOMAIN=""
SSL=false
BUILD_ONLY=false
NO_CACHE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --ssl)
            SSL=true
            shift
            ;;
        --build-only)
            BUILD_ONLY=true
            shift
            ;;
        --no-cache)
            NO_CACHE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [LAN_IP] [DOMAIN] [--ssl] [--build-only] [--no-cache]"
            echo ""
            echo "Arguments:"
            echo "  LAN_IP       LAN IP address (auto-detected if not provided)"
            echo "  DOMAIN       Optional domain name"
            echo "  --ssl        Enable SSL/HTTPS"
            echo "  --build-only Only build images, don't deploy"
            echo "  --no-cache   Build without cache"
            exit 0
            ;;
        *)
            if [[ -z "$LAN_IP" ]]; then
                LAN_IP=$1
            elif [[ -z "$DOMAIN" ]]; then
                DOMAIN=$1
            fi
            shift
            ;;
    esac
done

# Auto-detect LAN IP
if [[ -z "$LAN_IP" ]]; then
    # Try to get the primary non-loopback IP
    LAN_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')
    if [[ -z "$LAN_IP" ]]; then
        LAN_IP=$(hostname -I | awk '{print $1}')
    fi
fi

if [[ -z "$LAN_IP" ]]; then
    echo -e "${RED}ERROR: Could not auto-detect LAN IP. Please specify as first argument.${NC}"
    exit 1
fi

# Validate IP format
if [[ ! $LAN_IP =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
    echo -e "${RED}ERROR: Invalid IP address format: $LAN_IP${NC}"
    exit 1
fi

FRONTEND_URL="http://$LAN_IP:5173"
if [[ -n "$DOMAIN" ]]; then
    PROTOCOL=$([ "$SSL" = true ] && echo "https" || echo "http")
    FRONTEND_URL="$PROTOCOL://$DOMAIN"
fi

echo -e "${CYAN}==========================================${NC}"
echo -e "${CYAN}IT Ticketing Portal - LAN Deployment${NC}"
echo -e "${CYAN}==========================================${NC}"
echo -e "${CYAN}LAN IP: $LAN_IP${NC}"
echo -e "${CYAN}Frontend URL: $FRONTEND_URL${NC}"
[[ -n "$DOMAIN" ]] && echo -e "${CYAN}Domain: $DOMAIN${NC}"
[[ "$SSL" = true ]] && echo -e "${CYAN}SSL: Enabled${NC}"
echo -e "${CYAN}==========================================${NC}"

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}ERROR: Docker is not installed.${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}ERROR: Docker Compose is not installed.${NC}"
    exit 1
fi

COMPOSE_CMD="docker-compose"
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
fi

# Check .env.production
ENV_FILE=".env.production"
if [[ ! -f "$ENV_FILE" ]]; then
    echo -e "${YELLOW}Creating .env.production from template...${NC}"
    if [[ -f ".env.production.example" ]]; then
        cp .env.production.example $ENV_FILE
        echo -e "${YELLOW}Please edit .env.production with your configuration!${NC}"
        echo -e "${YELLOW}Required: DB_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY${NC}"
        read -p "Press Enter after editing .env.production..."
    else
        echo -e "${RED}ERROR: .env.production.example not found!${NC}"
        exit 1
    fi
fi

# Generate secrets if needed
echo -e "${YELLOW}Checking secrets...${NC}"
SECRETS_GENERATED=false

if grep -q "your_secure_database_password_here" $ENV_FILE; then
    DB_PASS=$(openssl rand -base64 18 | tr -d "=+/" | cut -c1-24)
    sed -i "s/your_secure_database_password_here/$DB_PASS/" $ENV_FILE
    SECRETS_GENERATED=true
fi

if grep -q "your_jwt_secret_min_32_characters_here" $ENV_FILE; then
    JWT_SECRET=$(openssl rand -base64 36 | tr -d "=+/" | cut -c1-48)
    sed -i "s/your_jwt_secret_min_32_characters_here/$JWT_SECRET/" $ENV_FILE
    SECRETS_GENERATED=true
fi

if grep -q "your_jwt_refresh_secret_min_32_characters_here" $ENV_FILE; then
    JWT_REFRESH_SECRET=$(openssl rand -base64 36 | tr -d "=+/" | cut -c1-48)
    sed -i "s/your_jwt_refresh_secret_min_32_characters_here/$JWT_REFRESH_SECRET/" $ENV_FILE
    SECRETS_GENERATED=true
fi

if grep -q "your_32_character_encryption_key_here" $ENV_FILE; then
    ENC_KEY=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-32)
    sed -i "s/your_32_character_encryption_key_here/$ENC_KEY/" $ENV_FILE
    SECRETS_GENERATED=true
fi

if [[ "$SECRETS_GENERATED" = true ]]; then
    echo -e "${GREEN}Generated secure secrets in .env.production${NC}"
fi

# Update FRONTEND_URL
sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=$FRONTEND_URL|" $ENV_FILE

# Build and deploy
BUILD_ARGS=()
[[ "$NO_CACHE" = true ]] && BUILD_ARGS+=("--no-cache")

if [[ "$BUILD_ONLY" = false ]]; then
    echo -e "${YELLOW}Stopping existing containers...${NC}"
    $COMPOSE_CMD down --remove-orphans
fi

echo -e "${YELLOW}Building images...${NC}"
$COMPOSE_CMD build "${BUILD_ARGS[@]}"

if [[ "$BUILD_ONLY" = true ]]; then
    echo -e "${GREEN}Build completed successfully!${NC}"
    exit 0
fi

echo -e "${YELLOW}Starting services...${NC}"
$COMPOSE_CMD up -d

echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
SERVICES=("postgres" "redis" "backend" "frontend")
MAX_WAIT=120
ELAPSED=0

while [[ $ELAPSED -lt $MAX_WAIT ]]; do
    ALL_HEALTHY=true
    for SERVICE in "${SERVICES[@]}"; do
        HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "ticket-portal-$SERVICE" 2>/dev/null || echo "unhealthy")
        if [[ "$HEALTH" != "healthy" ]]; then
            ALL_HEALTHY=false
            break
        fi
    done
    
    if [[ "$ALL_HEALTHY" = true ]]; then
        echo -e "${GREEN}All services are healthy!${NC}"
        break
    fi
    
    sleep 5
    ELAPSED=$((ELAPSED + 5))
    echo -n "."
done

if [[ "$ALL_HEALTHY" = false ]]; then
    echo ""
    echo -e "${YELLOW}Services taking longer to start. Check logs with: docker-compose logs -f${NC}"
fi

# Run database migrations
echo -e "${YELLOW}Running database migrations...${NC}"
docker exec ticket-portal-backend npx prisma migrate deploy

# Seed initial data
echo -e "${YELLOW}Seeding initial data...${NC}"
docker exec ticket-portal-backend npx prisma db seed 2>/dev/null || echo -e "${YELLOW}Seed script not found, skipping...${NC}"

echo -e "${GREEN}"
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}DEPLOYMENT SUCCESSFUL!${NC}"
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}Frontend: $FRONTEND_URL${NC}"
echo -e "${GREEN}API: http://$LAN_IP:3000/api/v1${NC}"
echo -e "${GREEN}WebSocket: http://$LAN_IP:3001${NC}"
echo -e "${GREEN}"
echo -e "${CYAN}Default Admin Credentials:${NC}"
echo -e "${CYAN}  Email: admin@ticketportal.local${NC}"
echo -e "${CYAN}  Password: (check logs: docker logs ticket-portal-backend | grep 'Temporary Password')${NC}"
echo -e "${GREEN}"
echo -e "${CYAN}Useful Commands:${NC}"
echo -e "${CYAN}  View logs: docker-compose logs -f [service]${NC}"
echo -e "${CYAN}  Stop: docker-compose down${NC}"
echo -e "${CYAN}  Restart: docker-compose restart${NC}"
echo -e "${CYAN}  Update: ./deploy-lan.sh $LAN_IP${NC}"
echo -e "${GREEN}==========================================${NC}"