# Crymiss — Deploy на Vercel

## Структура проекта
```
crymiss/
├── api/
│   ├── chat.js       ← бэкенд: прокси к Gemini (ключ скрыт)
│   └── config.js     ← отдаёт Google Client ID фронтенду
├── public/
│   └── index.html    ← весь фронтенд
├── vercel.json       ← конфиг роутинга
├── .env.example      ← шаблон переменных
└── .gitignore        ← скрывает .env файлы
```

---

## Шаг 1 — Google OAuth Client ID

1. Иди на https://console.cloud.google.com
2. Создай новый проект (или выбери существующий)
3. Слева: **APIs & Services → OAuth consent screen**
   - User Type: External → Create
   - App name: Crymiss
   - Support email: твой email
   - Сохрани
4. Слева: **APIs & Services → Credentials**
   - Нажми **+ CREATE CREDENTIALS → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Name: Crymiss Web
   - **Authorized JavaScript origins:**
     ```
     https://твой-домен.vercel.app
     ```
     (добавь после деплоя, сначала можно без него)
   - **Authorized redirect URIs:** то же самое
   - Нажми **Create**
5. Скопируй **Client ID** — выглядит так:
   ```
   123456789-abcdefghijk.apps.googleusercontent.com
   ```

---

## Шаг 2 — Deploy на Vercel

### Вариант А — через GitHub (рекомендую)

1. Залей папку `crymiss/` в GitHub репозиторий
2. Иди на https://vercel.com → **New Project**
3. Импортируй свой репозиторий
4. В разделе **Environment Variables** добавь:

   | Name | Value |
   |------|-------|
   | `GEMINI_API_KEY` | `AIzaSyCuoys5YPw0X3Fax3HNMv2ZAaTu4mDzp-4` |
   | `GOOGLE_CLIENT_ID` | `123456789-xxxx.apps.googleusercontent.com` |

5. Нажми **Deploy**
6. После деплоя скопируй URL (например `crymiss.vercel.app`)
7. Вернись в Google Console и добавь этот URL в Authorized origins

### Вариант Б — через Vercel CLI

```bash
npm i -g vercel
cd crymiss
vercel
# Следуй инструкциям

# Добавь переменные:
vercel env add GEMINI_API_KEY
vercel env add GOOGLE_CLIENT_ID

# Передеплой:
vercel --prod
```

---

## Шаг 3 — Telegram Mini App (опционально)

1. Открой @BotFather в Telegram
2. Напиши `/newbot` → создай бота
3. Напиши `/mybots` → выбери бота → **Bot Settings → Menu Button**
4. Введи URL твоего сайта: `https://crymiss.vercel.app`
5. Готово! Пользователи открывают бота и видят Crymiss как Mini App

Для авторизации через TG: приложение автоматически определяет
что запущено в Telegram и логинит пользователя через его TG данные.

---

## Важно

- **Никогда не коммить `.env.local`** — он в `.gitignore`
- Ключ Gemini хранится ТОЛЬКО в Vercel Environment Variables
- Браузер никогда не видит ключ — все запросы идут через `/api/chat`
- Google Client ID — не секрет, он виден в браузере (это нормально)

---

## Проверка что всё работает

После деплоя открой:
- `https://твой-сайт.vercel.app/api/config` — должен вернуть `{"googleClientId":"..."}`
- `https://твой-сайт.vercel.app` — должен открыться Crymiss
