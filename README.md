# Crymiss — Deploy на Vercel

## Структура проекта
```
crymiss/
├── api/
│   ├── chat.js            ← прокси к Gemini (ключ скрыт)
│   ├── config.js          ← отдаёт Google Client ID фронтенду
│   ├── register.js        ← регистрация юзеров в Vercel KV
│   ├── admin.js           ← статистика для владельца
│   ├── create-invoice.js  ← создание инвойса звёздами
│   └── webhook.js         ← вебхук Telegram бота
├── public/
│   ├── index.html         ← основное приложение
│   └── admin.html         ← панель администратора
├── vercel.json
└── .env.example
```

---

## Переменные окружения (Vercel → Settings → Environment Variables)

| Переменная | Где взять |
|---|---|
| `GROQ_API_KEY` | https://console.groq.com/keys |
| `GOOGLE_CLIENT_ID` | console.cloud.google.com → OAuth 2.0 |
| `TELEGRAM_BOT_TOKEN` | @BotFather → /newbot |
| `APP_URL` | https://твой-домен.vercel.app |
| `ADMIN_SECRET` | придумай любой пароль |
| `KV_REST_API_URL` | Vercel → Storage → KV (автоматически) |
| `KV_REST_API_TOKEN` | Vercel → Storage → KV (автоматически) |

---

## Шаг 1 — Vercel KV (база данных)

1. Vercel Dashboard → **Storage** → **Create Database** → **KV**
2. Название: `crymiss-kv` → Create
3. **Connect to Project** → выбери свой проект
4. Переменные `KV_REST_API_URL` и `KV_REST_API_TOKEN` добавятся **автоматически**
5. В корне проекта выполни: `npm install @vercel/kv`

---

## Шаг 2 — Деплой

```bash
# Установить Vercel CLI
npm i -g vercel

# Деплой
cd crymiss
vercel --prod
```

Или через GitHub: импортируй репо в Vercel, добавь все переменные.

---

## Шаг 3 — Вебхук Telegram бота

После деплоя открой в браузере:
```
https://api.telegram.org/bot<ТВОЙ_ТОКЕН>/setWebhook?url=https://твой-сайт.vercel.app/api/webhook
```

---

## Шаг 4 — Админ панель

Открой: `https://твой-сайт.vercel.app/admin.html`

Введи свой `ADMIN_SECRET` токен → увидишь статистику.

Или с токеном в URL: `https://твой-сайт.vercel.app/admin.html?token=твой_токен`

---

## Шаг 5 — Google OAuth (опционально)

1. console.cloud.google.com → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID → Web application
3. Authorized JavaScript origins: `https://твой-домен.vercel.app`
4. Скопируй Client ID → добавь в `GOOGLE_CLIENT_ID`
