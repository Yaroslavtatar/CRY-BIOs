#!/usr/bin/env bash
# CRY BIOS — быстрая установка (Docker или без контейнера)
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Yaroslavtatar/CRY-BIOs/main/install.sh | bash
#   curl -fsSL .../install.sh | bash -s -- docker
#   curl -fsSL .../install.sh | bash -s -- native
#
# Env overrides:
#   CRY_BIOS_REPO, CRY_BIOS_DIR, CRY_BIOS_BRANCH, ADMIN_PASSWORD, APP_URL, BIO_BASE_DOMAIN, PORT

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

REPO="${CRY_BIOS_REPO:-https://github.com/Yaroslavtatar/CRY-BIOs.git}"
BRANCH="${CRY_BIOS_BRANCH:-main}"
INSTALL_DIR="${CRY_BIOS_DIR:-/opt/cry-bios}"
PORT="${PORT:-3000}"
APP_URL="${APP_URL:-http://localhost:${PORT}}"
BIO_BASE_DOMAIN="${BIO_BASE_DOMAIN:-localhost}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

log() { echo -e "${BLUE}[cry-bios]${NC} $*"; }
ok() { echo -e "${GREEN}[ok]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
fail() { echo -e "${RED}[error]${NC} $*" >&2; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Команда '$1' не найдена. Установите её и повторите."
}

prompt_admin_password() {
  if [[ -n "$ADMIN_PASSWORD" ]]; then
    return
  fi
  if [[ ! -t 0 ]]; then
    ADMIN_PASSWORD="admin_secret"
    warn "ADMIN_PASSWORD не задан — используется admin_secret (смените после установки!)"
    return
  fi
  read -r -s -p "Пароль админ-панели (Enter = admin_secret): " ADMIN_PASSWORD
  echo
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin_secret}"
}

clone_or_update() {
  if [[ -d "$INSTALL_DIR/.git" ]]; then
    log "Обновление репозитория в $INSTALL_DIR ..."
    git -C "$INSTALL_DIR" fetch origin "$BRANCH"
    git -C "$INSTALL_DIR" checkout "$BRANCH"
    git -C "$INSTALL_DIR" pull origin "$BRANCH"
  else
    need_cmd git
    log "Клонирование $REPO → $INSTALL_DIR ..."
    sudo mkdir -p "$(dirname "$INSTALL_DIR")"
    if [[ -d "$INSTALL_DIR" ]]; then
      sudo rm -rf "$INSTALL_DIR"
    fi
    sudo git clone --depth 1 --branch "$BRANCH" "$REPO" "$INSTALL_DIR"
    sudo chown -R "$(id -u):$(id -g)" "$INSTALL_DIR" 2>/dev/null || true
  fi
}

write_env_file() {
  local env_file="$INSTALL_DIR/.env"
  prompt_admin_password
  log "Запись $env_file"
  cat >"$env_file" <<EOF
NODE_ENV=production
PORT=${PORT}
APP_URL=${APP_URL}
BIO_BASE_DOMAIN=${BIO_BASE_DOMAIN}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
BACKUP_RETAIN=5
BACKUP_CRON_HOURS=24
EOF
  chmod 600 "$env_file"
  ok ".env создан"
}

install_docker() {
  need_cmd docker
  if docker compose version >/dev/null 2>&1; then
    COMPOSE="docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE="docker-compose"
  else
    fail "Нужен Docker Compose (docker compose или docker-compose)"
  fi

  clone_or_update
  write_env_file
  cd "$INSTALL_DIR"

  log "Сборка и запуск Docker ..."
  export ADMIN_PASSWORD APP_URL BIO_BASE_DOMAIN PORT
  $COMPOSE down 2>/dev/null || true
  $COMPOSE up -d --build

  ok "CRY BIOS запущен в Docker на порту ${PORT}"
  echo -e "${GREEN}URL:${NC} ${APP_URL}"
  echo -e "${GREEN}Админка:${NC} ${APP_URL}/admin"
  echo -e "${GREEN}Данные:${NC} docker volume cry_bios_data → /app/data"
}

install_native_deps() {
  if command -v apt-get >/dev/null 2>&1; then
    log "Установка системных пакетов (apt) ..."
    sudo apt-get update -qq
    sudo apt-get install -y curl git build-essential python3 ffmpeg
  elif command -v apk >/dev/null 2>&1; then
    log "Установка системных пакетов (apk) ..."
    sudo apk add --no-cache curl git python3 make g++ gcc ffmpeg
  elif command -v dnf >/dev/null 2>&1; then
    log "Установка системных пакетов (dnf) ..."
    sudo dnf install -y curl git gcc-c++ make python3 ffmpeg
  else
    warn "Неизвестный пакетный менеджер — убедитесь, что установлены: git, node 22+, ffmpeg, build tools"
  fi
}

install_node() {
  if command -v node >/dev/null 2>&1 && [[ "$(node -p "process.versions.node.split('.')[0]")" -ge 22 ]]; then
    ok "Node $(node -v) уже установлен"
    return
  fi
  need_cmd curl
  log "Установка Node.js 22 через NodeSource ..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ok "Node $(node -v)"
}

install_native() {
  install_native_deps
  install_node
  need_cmd npm

  clone_or_update
  write_env_file
  cd "$INSTALL_DIR"

  log "npm ci && npm run build ..."
  npm ci
  npm run build

  sudo mkdir -p "$INSTALL_DIR/data/uploads" "$INSTALL_DIR/data/backups" "$INSTALL_DIR/data/tmp"

  SERVICE_USER="${SERVICE_USER:-$(whoami)}"
  UNIT="/etc/systemd/system/cry-bios.service"
  log "Создание systemd unit $UNIT"

  sudo tee "$UNIT" >/dev/null <<EOF
[Unit]
Description=CRY BIOS self-hosted bio platform
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${INSTALL_DIR}/.env
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  sudo systemctl daemon-reload
  sudo systemctl enable cry-bios
  sudo systemctl restart cry-bios

  ok "CRY BIOS запущен (systemd cry-bios) на порту ${PORT}"
  echo -e "${GREEN}URL:${NC} ${APP_URL}"
  echo -e "${GREEN}Админка:${NC} ${APP_URL}/admin"
  echo -e "${GREEN}Логи:${NC} journalctl -u cry-bios -f"
  echo -e "${GREEN}Данные:${NC} ${INSTALL_DIR}/data"
}

usage() {
  cat <<EOF
CRY BIOS installer

  bash install.sh docker   — Docker Compose (рекомендуется)
  bash install.sh native   — Node.js + systemd без контейнера
  bash install.sh          — интерактивный выбор

Переменные: CRY_BIOS_DIR, ADMIN_PASSWORD, APP_URL, BIO_BASE_DOMAIN, PORT
EOF
}

main() {
  echo -e "${BLUE}=====================================================${NC}"
  echo -e "${GREEN}  CRY BIOS — установка${NC}"
  echo -e "${BLUE}=====================================================${NC}"

  local mode="${1:-}"
  if [[ -z "$mode" ]]; then
    if [[ -t 0 ]]; then
      echo "1) Docker (рекомендуется)"
      echo "2) Native (Node.js + systemd)"
      read -r -p "Выбор [1]: " choice
      case "${choice:-1}" in
        2|native) mode=native ;;
        *) mode=docker ;;
      esac
    else
      mode=docker
    fi
  fi

  case "$mode" in
    docker|1) install_docker ;;
    native|2|node) install_native ;;
    -h|--help|help) usage ;;
    *) fail "Неизвестный режим: $mode (docker | native)" ;;
  esac
}

main "${1:-}"
