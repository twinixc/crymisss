# Crymiss — Как зайти в Админку

## Адрес

```
https://твой-сайт.vercel.app/admin.html
```

Или сразу с токеном (не нужно вводить вручную):
```
https://твой-сайт.vercel.app/admin.html?token=ТУТ_ТВОЙ_ТОКЕН
```

---

## Шаг 1 — Добавь ADMIN_SECRET в Vercel

1. Открой **vercel.com** → твой проект
2. **Settings → Environment Variables**
3. Нажми **Add**:
   - Name: `ADMIN_SECRET`
   - Value: придумай любой пароль, например `crymiss_admin_2025_xyz`
   - Environment: выбери все три (Production, Preview, Development)
4. Нажми **Save**
5. Перейди во вкладку **Deployments** → три точки → **Redeploy**

---

## Шаг 2 — Открой админку

После редеплоя открой:
```
https://твой-сайт.vercel.app/admin.html
```

Введи пароль который задал в `ADMIN_SECRET` → нажми **Sign in**

---

## Что видно в админке

| Метрика | Что показывает |
|---|---|
| Total users | Сколько всего зарегистрировалось |
| Active today | Уникальных сессий за сегодня |
| Web users | Зашли через Google OAuth |
| Telegram users | Зашли через Telegram Mini App |
| Registrations chart | График регистраций за 7 дней |
| Plans distribution | Сколько на Free / Pro / Ultra |
| Recent users | Последние 20 пользователей с email, планом, датой |

Автообновление каждые **30 секунд**.

---

## Если данные нулевые (KV не подключён)

Админка покажет демо-данные и синюю подсказку.

Чтобы включить реальную статистику:

1. **vercel.com** → твой проект → вкладка **Storage**
2. **Create Database → KV**
3. Название: `crymiss-kv` → **Create & Continue**
4. Нажми **Connect to Project** → выбери свой проект → **Connect**
5. Vercel сам добавит переменные `KV_REST_API_URL` и `KV_REST_API_TOKEN`
6. Редеплой — готово, статистика начнёт собираться

---

## Если нет возможности выдавать подписки (звёзды не работают)

Можно выдать план вручную через консоль браузера.

Попроси пользователя:
1. Открыть **crymiss** в браузере
2. Нажать **F12** → вкладка **Console**
3. Ввести команду:

**Выдать Pro:**
```javascript
activatePlan('pro')
```

**Выдать Ultra:**
```javascript
activatePlan('ultra')
```

**Проверить текущий план:**
```javascript
G.plan
```

**Сбросить лимит вручную:**
```javascript
G.reqCount=0; G.windowStart=Date.now(); save(); updQuotaUI()
```

> Это работает только для текущего пользователя в текущем браузере.
> При следующем логине план сохранится из localStorage.

---

## Быстрые ссылки

| Что | Ссылка |
|---|---|
| Приложение | `https://твой-сайт.vercel.app` |
| Админка | `https://твой-сайт.vercel.app/admin.html` |
| Проверка конфига | `https://твой-сайт.vercel.app/api/config` |
| Vercel Dashboard | `https://vercel.com/dashboard` |
| Groq Console | `https://console.groq.com` |
| Telegram BotFather | `https://t.me/BotFather` |
