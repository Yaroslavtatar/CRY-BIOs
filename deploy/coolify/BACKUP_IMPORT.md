# Импорт больших ZIP-бэкапов (обход 502)

502 Bad Gateway при импорте бэкапа обычно приходит **не от Node.js**, а от прокси (Traefik / Cloudflare) — лимит размера одного HTTP-запроса или timeout на долгую распаковку.

CRY BIOS использует **chunked upload** (8 MB на запрос) и **async import job** — UI делает это автоматически.

## Способы импорта

### 1. Chunked upload (рекомендуется)

В админ-панели: «Загрузить ZIP» → предпросмотр локально → «Импортировать».

Архив режется на чанки по 8 MB, каждый — отдельный POST. После сборки на сервере импорт идёт в фоне, UI опрашивает статус.

### 2. Import с диска (без HTTP upload)

Для архивов 500 MB+ или если Cloudflare proxy блокирует загрузку:

```bash
scp backup.zip user@vps:/opt/cry-bios/data/incoming/
```

В админ-панели: секция **«Импорт с сервера»** → выберите файл из `data/incoming/` → «Импортировать».

### 3. Emergency: прямой доступ к порту

Обход Traefik/Cloudflare — только для админов на VPS:

```bash
curl -X POST http://127.0.0.1:3000/api/admin/import-full/from-disk \
  -H "Content-Type: application/json" \
  -H "x-admin-password: YOUR_PASSWORD" \
  -d '{"filename":"backup.zip"}'
```

## Cloudflare

Если домен за **оранжевым облаком** (proxy):

- Лимит ~**100 MB** на один request — chunked upload обязателен для больших архивов
- Альтернатива: **DNS only** (серое облако) для `cbios.ru` или поддомена админки
- Для очень больших архивов: **import с диска** (scp)

## Traefik / Coolify

Обновите labels из `LABELS_PASTE.txt`:

- `maxRequestBodyBytes=2147483648` (2 GB) — запас для legacy single-POST
- `crybios-timeouts` — dial/response/idle 300–600s

Перезапустите приложение в Coolify после изменения labels.

## Переменные окружения

```env
BACKUP_MAX_MB=2048
BACKUP_CHUNK_MB=8
```

## Диагностика

| Симптом | Причина | Решение |
|---------|---------|---------|
| 502 на confirm import | Прокси / один большой POST | Chunked (авто в UI) |
| 502 на preview | Устаревший сервер без client preview | Обновите CRY BIOS |
| Timeout после upload | Sync extract в старой версии | Обновите — async job |
| 413 Payload Too Large | Traefik body limit | Labels 2GB или chunked |
| Файл >100MB + CF proxy | Cloudflare limit | Chunked или DNS-only / scp |
