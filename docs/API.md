# HTTP API CRY BIOS

Все эндпоинты начинаются с `/api`. Тела запросов и ответов: JSON (`Content-Type: application/json`), кроме загрузки файлов (multipart) и прогресса импорта (SSE). Ниже `$BASE` — адрес вашей установки, например `https://cbios.ru`.

Примеры проверены на работающем сервере. Если вы меняете маршрут, обновите и этот файл.

- [Быстрый старт](#быстрый-старт)
- [Соглашения: ошибки, лимиты, CORS](#соглашения)
- [Авторизация](#авторизация)
- [Публичные эндпоинты](#публичные-эндпоинты)
- [Профиль](#профиль)
- [Аналитика](#аналитика)
- [Загрузка файлов](#загрузка-файлов)
- [Аккаунт и 2FA](#аккаунт-и-двухфакторная-защита-2fa)
- [Импорт с guns.lol](#импорт-с-gunslol)
- [Discord](#discord)
- [API администратора](#api-администратора)
- [Служебные](#служебные)

---

## Быстрый старт

```bash
BASE=https://cbios.ru

# 1. Регистрация (или вход, если аккаунт уже есть). Возвращает токен сессии.
curl -s -X POST $BASE/api/auth/login-register \
  -H 'Content-Type: application/json' \
  -d '{"username":"demo","password":"Str0ng-Pass-9x!","acceptTerms":true}'
# {"token":"e74d51ca-…","username":"demo","isNew":true}

TOKEN=e74d51ca-…

# 2. Прочитать свой публичный профиль (авторизация не нужна)
curl -s $BASE/api/bio/demo

# 3. Изменить профиль: отправьте конфиг целиком, изменив нужные поля
curl -s $BASE/api/bio/demo \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); d["displayName"]="Demo API"; print(json.dumps(d))' \
  | curl -s -X POST $BASE/api/bio/demo \
      -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d @-
```

---

## Соглашения

**Ошибки.** Любая ошибка: HTTP-код 4xx/5xx и тело `{"error": "текст"}`. Текст может быть на русском или английском, ориентируйтесь на код ответа, а не на текст.

| Код | Когда |
|---|---|
| 400 | Некорректные данные |
| 401 | Нет или недействительна сессия |
| 403 | Действие запрещено (аккаунт заблокирован, регистрация закрыта) |
| 404 | Профиль или маршрут не найден (`API endpoint not found` для неизвестных `/api/*`) |
| 413 | Файл слишком большой |
| 415 | Неподдерживаемый тип файла |
| 429 | Превышен лимит запросов |
| 503 | Режим обслуживания (`"maintenance": true` в теле) или внешний сервис недоступен |

**Лимиты запросов.** Считаются по IP (где указано, по пользователю). Оставшийся лимит видно в заголовках `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`. При 429 подождите.

| Что | Лимит |
|---|---|
| Публичные чтения (`/api/bio/:slug`, `/api/resolve-host`, `/api/legal`) | 300 в минуту с IP |
| `/api/github` | 120 в минуту |
| Вход и регистрация | 20 попыток за 15 мин на пару IP+логин, 30 неудачных за 15 мин на IP |
| Новые аккаунты | 5 в час с одного IP |
| Записи визитов | 30 в минуту; не больше 3 визитов за 10 мин с IP на один профиль |
| Загрузка файлов | 40 за 15 мин на пользователя |
| Импорт и rehost | 10 в час на пользователя |
| Операции безопасности аккаунта (2FA, смена пароля) | 30 за 15 мин |

**Режим обслуживания.** Когда админ его включает, `POST /api/upload`, `POST /api/bio/:username`, импорт и rehost отвечают `503`. Чтение профилей и вход продолжают работать.

**CORS.** Браузерные запросы с чужих сайтов разрешены только для доменов платформы и списка `CORS_ALLOWED_ORIGINS`. Серверные клиенты и скрипты (curl, Node, Python) ограничений CORS не имеют.

**Размер тела.** Обычный JSON: до 100 КБ (лимит Express по умолчанию). Конфиг профиля с большим `customCSS` и блоками учитывайте при сохранении.

---

## Авторизация

Есть два способа, оба дают доступ к одним и тем же маршрутам.

**Bearer-токен (для скриптов и API-клиентов).** Токен приходит в ответе на вход/регистрацию, дальше передаётся в заголовке:

```
Authorization: Bearer <token>
```

**HttpOnly-cookie `cry_session` (для браузера).** Ставится при входе. Для небезопасных методов (POST/PUT/DELETE) заголовок `Origin`, если он есть, должен совпадать с хостом сервера, иначе запрос отклоняется как CSRF. С Bearer-токеном эта проверка не применяется.

Токен одноразовый на пользователя: новый вход, смена пароля или `logout` делают старый токен недействительным. Срок жизни сессии задан на сервере, продлевается входом.

### `POST /api/auth/login-register`

Вход и регистрация в одном маршруте: если пользователь существует, это вход, иначе регистрация.

Тело:

| Поле | Тип | Описание |
|---|---|---|
| `username` | string | 3–15 символов: латиница, цифры, `_`, `-` |
| `password` | string | Для регистрации действует парольная политика сервера |
| `acceptTerms` | boolean | Обязателен `true` **только при создании** аккаунта |

Ответы:

- `201 {"token","username","isNew":true}`: аккаунт создан
- `200 {"token","username","isNew":false}`: вход выполнен
- `200 {"twoFactorRequired":true,"challenge":"…"}`: включена 2FA, нужен второй шаг, см. [вход с 2FA](#вход-с-2fa)
- `400` с `"consentRequired":true`: не передан `acceptTerms`
- `403`: аккаунт заблокирован или регистрация закрыта админом
- `429`: лимит или временная блокировка аккаунта после серии неудачных попыток

### `GET /api/auth/verify`

Проверка токена. `200 {"username":"demo"}` или `401 {"error":"Invalid token"}`.

### `POST /api/auth/logout`

Закрывает сессию. `200 {"success":true}`.

### `POST /api/auth/change-password`

Тело `{"currentPassword","newPassword"}`. Ответ содержит **новый токен**, старый перестаёт работать: `{"success":true,"token":"…"}`.

### `POST /api/auth/change-username`

Тело `{"newUsername":"newname"}`. Ответ `{"success":true,"username":"newname"}`. Имя не должно быть занято или зарезервировано.

---

## Публичные эндпоинты

Авторизация не нужна.

### `GET /api/bio/:slug`

Полный публичный конфиг профиля по имени пользователя или `aliasSlug`. Для забаненных и несуществующих: `404 {"error":"Profile not found"}`.

```bash
curl -s $BASE/api/bio/demo
```

Основные поля ответа (полный список типов: `BioConfig` в [`src/types.ts`](../src/types.ts)):

| Поле | Описание |
|---|---|
| `username`, `displayName`, `bio` | Имя, отображаемое имя, описание |
| `avatarUrl` | Путь или URL аватара |
| `verified`, `customBadge`, `badges` | Бейджи |
| `uid` | Числовой ID профиля |
| `fontFamily`, `primaryColor`, `textColor`, `glowColor`, `customCSS` | Оформление |
| `bgType`, `bgValue`, `bgBlur`, `bgDim` | Фон |
| `audioUrl`, `playlist`, … | Плеер |
| `blocks` | Массив блоков (соцсети, HTML, Discord, цитаты, embed) |
| `aliasSlug`, `customDomain` | Короткое имя и подключённый домен |

### `GET /api/all-bios`

Краткий список всех незаблокированных профилей: `[{username, displayName, bio, avatarUrl, verified}]`. Без пагинации. Если пользователей много, кэшируйте ответ на своей стороне.

### `GET /api/resolve-host?host=<hostname>`

Определяет, какому профилю принадлежит поддомен (`name.cbios.ru`) или подключённый домен.

```json
{"success":true,"username":"demo","slug":"demo","source":"subdomain"}
```

`source`: `subdomain` или `custom_domain`. Если не найдено: `{"success":false,"reason":"no_match"}` либо `"profile_not_found"`. Без параметра используется заголовок `Host`.

`GET /api/bio-by-host?host=…`: упрощённая устаревшая версия, возвращает `{"success":true,"username":"…"}` или `{"success":false}`.

### `GET /api/public-config`

Настройки платформы для клиентов: `appUrl`, `baseDomain`, `profileUrlMode`, `socials` (ссылки проекта), `registrationOpen`, `maintenanceMode`, `maintenanceMessage`, `hideAdminPanelLink`, `mediaCdnUrl`. Удобно проверить перед регистрацией, открыта ли она.

### `GET /api/legal`

Юридические данные оператора (то, что админ задал в разделе «Юр. данные»): `siteName`, `operatorForm`, `operatorName`, `taxId`, `regNumber`, `address`, `operatorContact`, `abuseContact`, `jurisdiction`, `lastUpdated` (`ГГГГ-ММ-ДД`), `showRequisitesInFooter`, `privacyExtra`, `termsExtra`. Кэшируется на 60 секунд.

### `GET /api/home-layout`

Макет главной страницы (блоки и настройки конструктора). Кэш 30 секунд. Тема отдаётся отдельно как таблица стилей: `GET /api/theme.css`.

### `GET /api/github`

Данные репозитория проекта для главной (звёзды, релиз, коммиты), кэшируются сервером. `{"enabled":false}`, если отключено через `GITHUB_REPO=off`; `503`, если GitHub недоступен.

### Короткие пути вне `/api`

| Путь | Что |
|---|---|
| `/<username>` | Страница профиля |
| `/uploads/<файл>` | Загруженные медиа |
| `/robots.txt`, `/sitemap.xml` | SEO (в production) |

---

## Профиль

### `POST /api/bio/:username`

Сохраняет конфиг профиля. Авторизация обязательна, и токен должен принадлежать **тому же** `:username`, иначе `401`.

Тело: конфиг профиля целиком (`BioConfig`). Лучший способ: получить текущий через `GET /api/bio/:slug`, изменить поля, отправить обратно. Ответ: `{"message":"Profile saved successfully","config":{…}}`.

Что сервер делает с полями:

- `username` принудительно равен `:username`.
- `verified`, `uid`, служебные бейджи и поля Discord меняются **только** сервером. Присланные значения игнорируются.
- `aliasSlug`: 1–32 символа `a-z 0-9 _ -`, не зарезервированный и не занятый (`400` / `409`).
- `customDomain`: принимается только после подтверждения владения. Добавьте DNS TXT-запись `_crybios.<домен>` со значением `cry-bios-verify=<username>`, затем сохраните профиль.
- Файлы, которыми профиль больше не пользуется, удаляются из `uploads/`.

---

## Аналитика

### `POST /api/bio/:slug/visit`

Записывает визит. Авторизация не нужна, так страница сама отправляет просмотр. Тело необязательное: `{"referrer":"https://…","host":"name.cbios.ru"}`. Ответ всегда `{"ok":true}` (повторные визиты с того же IP тихо отбрасываются). IP посетителя и cookie не сохраняются.

### `GET /api/bio/:username/analytics`

Сводка по профилю. Только владелец (`401` иначе).

```json
{
  "username": "demo",
  "totalViews": 1,
  "uniqueViews": 1,
  "visitsOverTime": [{"date":"11-22","views":1}],
  "referrersHistogram": [{"referrer":"Telegram","count":1}],
  "devicesHistogram":   [{"device":"Desktop","count":1}],
  "browsersHistogram":  [{"browser":"Chrome","count":1}],
  "countriesHistogram": [{"country":"RU","count":1}],
  "hostsHistogram":     [{"host":"cbios.ru","count":1}]
}
```

`visitsOverTime`: последние 7 дней (`ММ-ДД`). Гистограммы: топ-10. Уникальные просмотры считаются приблизительно (по часу, браузеру, устройству и стране). Хранится до 5000 записей на пользователя.

---

## Загрузка файлов

### `POST /api/upload`

`multipart/form-data`, авторизация обязательна.

| Поле | Описание |
|---|---|
| `file` | Файл, до **50 МБ** |
| `uploadType` | Для изображений: `avatar`, `bg` (по умолчанию) или `image` |

Разрешены изображения (JPEG, PNG, WebP, GIF), видео и аудио. Сервер перекодирует файл: изображения оптимизируются, аудио в MP3 128 кбит/с, видео перекодируется.

```bash
curl -s -X POST $BASE/api/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F uploadType=avatar -F file=@avatar.png
```

Ответ для изображения: `{"url":"/uploads/…","thumbUrl":"…","avifUrl":"…","deduplicated":false}`. Для видео и аудио: `{"url","deduplicated"}`. Подставьте `url` в `avatarUrl`, `bgValue`, `audioUrl` и сохраните профиль.

Ошибки: `401` (нет сессии), `413` (больше 50 МБ), `415` (формат не поддерживается или файл повреждён).

---

## Аккаунт и двухфакторная защита (2FA)

Все маршруты требуют сессию. Чувствительные действия требуют повторно ввести пароль.

### `GET /api/account/security`

`{"twoFactorEnabled":false,"recoveryCodesLeft":0}`

### Включение 2FA

1. `POST /api/auth/2fa/setup` с `{"password":"…"}` возвращает `{"secret","otpauthUrl","qr"}` (`qr`: data-URL с QR-кодом для приложения-аутентификатора).
2. `POST /api/auth/2fa/enable` с `{"code":"123456"}` возвращает `{"success":true,"recoveryCodes":[…]}`. **Резервные коды показываются один раз**, сохраните их.

### Отключение и новые резервные коды

- `POST /api/auth/2fa/disable` с `{"password","code"}`
- `POST /api/auth/2fa/recovery-codes` с `{"password","code"}` возвращает новый набор резервных кодов, старые перестают работать

В поле `code` принимается код из приложения или резервный код (резервный сгорает после использования).

### Вход с 2FA

1. `POST /api/auth/login-register` возвращает `{"twoFactorRequired":true,"challenge":"…"}`.
2. `POST /api/auth/2fa/login` с `{"challenge":"…","code":"123456"}` возвращает `{"token","username","isNew":false}`.

Challenge живёт 5 минут и допускает 5 попыток.

---

## Импорт с guns.lol

Все маршруты требуют сессию, лимит: 10 в час.

### `POST /api/import-profile`

Тело `{"input":"https://guns.lol/name"}` (ссылка или HTML страницы). Ответ `{"success":true,"jobId":"…"}`; импорт идёт в фоне.

### `GET /api/import-profile/progress/:jobId`

Поток Server-Sent Events (`text/event-stream`). События:

| Событие | Данные |
|---|---|
| `progress` | `{current,total,label}` |
| `done` | Результат: сопоставленные поля профиля и `preview` |
| `error` | `{error}` |

Применить результат к профилю нужно самому через `POST /api/bio/:username`. Задача хранится 15 минут. Доступна только создавшему её пользователю.

### `POST /api/rehost-import-media`

Скачивает внешние медиа (аватар, фон, аудио, плейлист, курсор) на ваш сервер. Тело `{"avatarUrl","bgType","bgValue","audioUrl","customCursorUrl","playlist"}`, ответ `{"success":true,"data":{…}}` с локальными URL.

`POST /api/import-gunslol`: устаревший синхронный вариант (тело `{"input"}` или `{"targetUsername"}`).

---

## Discord

- `GET /api/discord/oauth/start`: нужна сессия. Возвращает `{"url":"https://discord.com/oauth2/authorize?…"}`; с `?redirect=1` сразу перенаправляет. `503`, если OAuth не настроен на сервере.
- `GET /api/discord/oauth/callback`: служебный, Discord возвращает сюда пользователя; дальше редирект в `/dashboard?discord=…`.
- `POST /api/discord/disconnect`: нужна сессия, отвязывает Discord от профиля.
- `GET /api/discord/:userId`: публичный статус присутствия. Отдаётся **только** для привязанных к профилям Discord ID (`userId`: числовой snowflake), иначе `404`. Кэшируется.

---

## API администратора

Доступ по паролю администратора в заголовке `x-admin-password`. Значение **кодируйте как URL-компонент** (`encodeURIComponent`), чтобы спецсимволы дошли без искажений.

```bash
curl -s $BASE/api/admin/overview -H "x-admin-password: $(python3 -c 'import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))' "$ADMIN_PASSWORD")"
```

Лимиты: 120 запросов за 15 минут; после серии неверных паролей IP блокируется на 15 минут (`429`, `Retry-After`). Все успешные изменяющие запросы пишутся в журнал (`GET /api/admin/audit`).

Пароль администратора **не** передавайте по незащищённому HTTP.

| Метод и путь | Назначение |
|---|---|
| `GET /api/admin/verify` | Проверка пароля |
| `GET /api/admin/status` | Режимы платформы |
| `POST /api/admin/site-settings` | `hideAdminPanelLink`, `registrationOpen`, `maintenanceMode` (boolean), `maintenanceMessage` (string, до 300 символов) |
| `GET /api/admin/overview` | Счётчики, система, хранилище, проверки здоровья |
| `GET`, `PUT /api/admin/legal` | **Юридические данные** (ниже) |
| `GET`, `PUT /api/admin/home-layout`, `POST …/reset` | Макет и тема главной |
| `POST /api/admin/theme/asset`, `GET …/assets`, `DELETE …/asset/:name` | Файлы темы |
| `GET /api/admin/users` | Список пользователей |
| `POST /api/admin/user/:username/ban`, `…/reset-sessions`, `…/reset-2fa` | Блокировка, закрытие сессий, сброс 2FA |
| `POST /api/admin/users/bulk` | Массовые действия |
| `POST /api/admin/rename-user`, `…/change-user-password`, `…/toggle-verify/:username` | Переименование, пароль, галочка |
| `DELETE /api/admin/user/:username` | Удаление пользователя |
| `GET /api/admin/export-user/:username`, `POST …/import-user/:username` | Экспорт и импорт одного пользователя |
| `GET /api/admin/backups`, `POST …/backups/run`, `GET`/`DELETE …/backups/:name` | Резервные копии |
| `GET /api/admin/export-db`, `POST …/import-db`, `GET …/export-full`, `POST …/import-full` | Выгрузка и восстановление (в том числе чанками `import-full/init|chunk|finish`) |
| `GET /api/admin/storage-stats`, `POST …/cleanup-orphans`, `POST …/optimize-media` | Хранилище и медиа |
| `POST /api/admin/analytics/clear` | Очистка аналитики |
| `GET`, `DELETE /api/admin/logs`, `GET …/audit` | Логи сервера и журнал действий |
| `POST /api/admin/change-password` | Смена пароля администратора |

### `GET /api/admin/legal` и `PUT /api/admin/legal`

`PUT` принимает **любое подмножество** полей, остальные сохраняются:

| Поле | Тип | Ограничение |
|---|---|---|
| `siteName` | string | до 60 символов, пусто = `CRY BIOS` |
| `operatorForm` | string | до 60 (ИП, ООО, …) |
| `operatorName` | string | до 200 |
| `taxId`, `regNumber` | string | до 40 |
| `address` | string | до 300 |
| `operatorContact` | string | e-mail, до 120 |
| `abuseContact` | string | e-mail или пусто |
| `jurisdiction` | string | до 120 |
| `lastUpdated` | string | `ГГГГ-ММ-ДД`. Если не передать при изменении текстов, ставится сегодняшняя дата |
| `showRequisitesInFooter` | boolean | реквизиты в подвале главной |
| `privacyExtra`, `termsExtra` | string | до 4000, абзацы через пустую строку, только текст (HTML не выполняется) |

```bash
curl -s -X PUT $BASE/api/admin/legal \
  -H "x-admin-password: $PW" -H 'Content-Type: application/json' \
  -d '{"operatorForm":"ИП","operatorName":"Иванов И. И.","operatorContact":"help@example.com"}'
```

Ошибки: `400` при не-строковом значении, некорректном e-mail или дате, либо пустом теле. Данные хранятся в `data/legal_settings.json`, входят в полный бэкап и восстанавливаются из него.

---

## Рефералы и вход через Telegram

Рекламная ссылка: `https://<сайт>/?ref=<код>`. Код создаётся в админке («Рефералы»). При заходе по ссылке фронтенд считает переход и запоминает код на 30 дней; он засчитывается при регистрации через форму и через Telegram-бота. Один переход с IP на одну ссылку в сутки.

| Путь | Доступ | Описание |
|---|---|---|
| `POST /api/ref/click` | публичный | `{code}` — засчитать переход, выставить cookie `cry_ref` |
| `GET /api/ref/stats/:token` | по токену | Числа для рекламщика: переходы, регистрации, 24 ч / 7 дн, конверсия, ряд по дням. Страница: `/ref-stats/:token` |
| `GET /api/admin/referrals` | админ | Ссылки со статистикой + сводка по Telegram |
| `POST /api/admin/referrals` | админ | `{name, code?, note?}` |
| `PUT /api/admin/referrals/:code` | админ | `{name?, note?, active?}` |
| `DELETE /api/admin/referrals/:code` | админ | Удалить ссылку и счётчик переходов |
| `GET /api/admin/referrals/:code/signups` | админ | Список зарегистрировавшихся (`limit`, `offset`) |

Регистрация формой принимает необязательное поле `ref` в `POST /api/auth/login-register`.

**Вход по ключу из бота.** Включается переменной `TELEGRAM_BOT_TOKEN`. Пользователь пишет боту `/start` (или заходит по `https://t.me/<бот>?start=ref_<код>`), бот присылает одноразовый ключ `ABCDE-FGHJK` на 10 минут. Ключ вводится на сайте. Если Telegram ещё не привязан, нужно выбрать имя и принять условия — создаётся аккаунт без пароля (вход только через бота). Если у аккаунта включена 2FA, код из приложения всё равно запрашивается.

| Путь | Описание |
|---|---|
| `GET /api/auth/telegram/config` | `{enabled, botUsername}` |
| `POST /api/auth/telegram/login` | `{key}` → сессия, либо `{needUsername:true, suggestedUsername}`; вторым запросом `{key, username, acceptTerms:true}` |
| `GET /api/auth/telegram/me` | Привязан ли Telegram к текущему аккаунту |
| `POST /api/auth/telegram/link` | `{key}` — привязать Telegram к существующему аккаунту |
| `DELETE /api/auth/telegram/link` | Отвязать (нельзя для аккаунтов, созданных через бота) |

---

## Служебные

| Путь | Описание |
|---|---|
| `GET /api/health` | Проверка для мониторинга: `{"status":"ok","checks":{…},"stats":{…}}` |
| `GET /api/install-script` | Скрипт установки `install.sh` |
| `GET /api/theme.css` | Тема платформы как CSS |

---

## Заметки для интеграторов

- **Не делайте опрос чаще, чем нужно.** Публичные чтения ограничены 300 запросами в минуту с IP; кэшируйте `GET /api/bio/:slug` и `GET /api/all-bios`.
- **Храните токен как пароль.** Он даёт полный доступ к аккаунту, пока не будет закрыта сессия.
- **Версионирования у API нет.** Маршруты могут меняться между релизами; смотрите заметки к релизам и этот файл.
- **Нет отдельных API-ключей.** Доступ скриптов строится на токене сессии пользователя. Если вам нужны ключи с ограниченными правами, это отдельная доработка.
