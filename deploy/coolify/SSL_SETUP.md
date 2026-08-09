# Wildcard SSL для cbios.ru в Coolify (Traefik)

Проблема: `cryteam.cbios.ru` показывает «Небезопасно», потому что Let's Encrypt **не выдаёт wildcard** через HTTP-challenge.  
Нужен **DNS-challenge** (Cloudflare API) + **один сертификат** на `cbios.ru` + `*.cbios.ru`.

CRY BIOS — SaaS-приложение: **все поддомены** должны идти в один контейнер (см. [доку Coolify](https://coolify.io/docs/knowledge-base/proxy/traefik/wildcard-certs)).

---

## Шаг 1. Cloudflare API Token

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **My Profile** → **API Tokens**
2. **Create Token** → шаблон **Edit zone DNS**
3. Zone Resources: `cbios.ru`
4. Скопируйте token (показывается один раз)

В Cloudflare для `cbios.ru`:
- **SSL/TLS** → режим **Full (strict)** (не Flexible)
- DNS: `cbios.ru` A → IP VPS, `*.cbios.ru` A → тот же IP
- Прокси (оранжевое облако): можно вкл. или выкл.; при Full (strict) на origin **должен** быть валидный сертификат

---

## Шаг 2. DNS Challenge в Coolify Proxy

**Servers** → ваш сервер → **Proxy** → Edit / Docker Compose

Замените HTTP-challenge на DNS-challenge. Пример для Cloudflare (Traefik v3):

```yaml
# В секции command Traefik добавьте/замените:
- '--certificatesresolvers.letsencrypt.acme.dnschallenge=true'
- '--certificatesresolvers.letsencrypt.acme.dnschallenge.provider=cloudflare'
- '--certificatesresolvers.letsencrypt.acme.dnschallenge.delaybeforecheck=0'
- '--certificatesresolvers.letsencrypt.acme.email=your@email.com'
- '--certificatesresolvers.letsencrypt.acme.storage=/traefik/acme.json'
# УДАЛИТЕ или закомментируйте httpChallenge строки
```

В **environment** контейнера Traefik:

```env
CF_DNS_API_TOKEN=your_cloudflare_api_token
```

Провайдеры: [Lego DNS list](https://go-acme.github.io/lego/dns/) — для Cloudflare используйте `cloudflare`.

**Restart Proxy** после сохранения.

---

## Шаг 3. Wildcard-сертификат (cbios.ru + *.cbios.ru)

### Вариант A — labels на Proxy (рекомендуется Coolify docs)

**Servers** → **Proxy** → labels:

```yaml
- traefik.http.routers.traefik.tls.certresolver=letsencrypt
- traefik.http.routers.traefik.tls.domains[0].main=cbios.ru
- traefik.http.routers.traefik.tls.domains[0].sans=*.cbios.ru
```

### Вариант B — Dynamic Configuration

**Servers** → **Proxy** → **Dynamic Configurations** → New

Имя файла: `wildcard-cbios-ru.yaml`  
Содержимое: скопируйте из [`traefik-dynamic-wildcard-cbios.ru.yaml`](traefik-dynamic-wildcard-cbios.ru.yaml)

Restart Proxy → **Proxy → Logs** — дождитесь успешного ACME.

---

## Шаг 4. Приложение CRY BIOS (все поддомены → один сервис)

В Coolify откройте ресурс **CRY BIOS** → **Advanced** → **Custom Docker Options** / **Labels**

Скопируйте labels из [`app-traefik-labels.yaml`](app-traefik-labels.yaml).

**Domains:**
- `https://cbios.ru` — apex (landing, dashboard)
- Для wildcard **не добавляйте** каждый поддомен отдельно — маршрутизация через `HostRegexp`

**General → Wildcard Domain** (настройки сервера Coolify):  
`https://cbios.ru` — новые preview-URL будут на поддоменах вашего домена.

**Redeploy** приложения после изменения labels/domains.

---

## Шаг 5. Env приложения

```env
APP_URL=https://cbios.ru
BIO_BASE_DOMAIN=cbios.ru
NODE_ENV=production
PORT=3000
ADMIN_PASSWORD=...
```

---

## Проверка

```bash
# Сертификат на поддомене
curl -vI https://cryteam.cbios.ru 2>&1 | grep -i "subject\|issuer\|SSL"

# SAN должен содержать *.cbios.ru или cryteam.cbios.ru с валидным Let's Encrypt
openssl s_client -connect cryteam.cbios.ru:443 -servername cryteam.cbios.ru </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer
```

Браузер: замок без «Небезопасно».

---

## Частые ошибки

| Симптом | Решение |
|---------|---------|
| Небезопасно на `*.cbios.ru`, apex OK | Нет wildcard cert → шаги 2–3 |
| 404 на поддомене | Нет HostRegexp labels → шаг 4 |
| ACME failed | Проверить CF_DNS_API_TOKEN, DNS challenge logs |
| Cloudflare Flexible + origin HTTPS | Поставить **Full (strict)** |
| Cert есть, но wrong host | Redeploy app, проверить rule `HostRegexp` |

---

## Файлы в этом каталоге

| Файл | Назначение |
|------|------------|
| `traefik-dynamic-wildcard-cbios.ru.yaml` | Dynamic config для Proxy |
| `app-traefik-labels.yaml` | Labels для ресурса CRY BIOS |
| `proxy-dns-challenge.snippet.yaml` | Фрагмент command для Traefik |

SSL выпускает **Coolify/Traefik**, не Node.js. После настройки новые поддомены пользователей (`*.cbios.ru`) получают HTTPS автоматически.
