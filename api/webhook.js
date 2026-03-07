// api/webhook.js
// Вебхук для Telegram бота
// Получает pre_checkout_query (нужно подтвердить) и successful_payment (активировать план)
// Установить вебхук: https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://твой-сайт.vercel.app/api/webhook

// Verify Telegram webhook signature
async function verifyTelegramRequest(req, botToken) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true; // skip if not configured
  const provided = req.headers['x-telegram-bot-api-secret-token'];
  return provided === secret;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).end();

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) return res.status(500).end();

  // [SEC] Verify webhook secret token if configured
  if (!(await verifyTelegramRequest(req, BOT_TOKEN))) {
    return res.status(401).end();
  }

  // [SEC] Validate content-type and body size
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('application/json')) return res.status(400).end();

  const update = req.body;
  if (!update || typeof update !== 'object') return res.status(400).end();

  try {
    // ── Подтверждение оплаты (ОБЯЗАТЕЛЬНО в течение 10 сек) ──
    if (update.pre_checkout_query) {
      const pcq = update.pre_checkout_query;
      await tgApi(BOT_TOKEN, 'answerPreCheckoutQuery', {
        pre_checkout_query_id: pcq.id,
        ok: true
      });
      return res.status(200).json({ ok: true });
    }

    // ── Успешная оплата ──
    if (update.message?.successful_payment) {
      const msg     = update.message;
      const payment = msg.successful_payment;
      const userId  = msg.from.id;

      let payload;
      try { payload = JSON.parse(payment.invoice_payload); } catch(_) { payload = {}; }

      const plan = payload.plan || (payment.total_amount >= 350 ? 'ultra' : 'pro');

      // Сохраняем план в KV storage Vercel (или просто отправляем сообщение)
      // В реальном проекте тут нужна БД. Пока уведомляем пользователя.
      await tgApi(BOT_TOKEN, 'sendMessage', {
        chat_id: userId,
        text: getPlanSuccessMessage(plan, payment.total_amount),
        parse_mode: 'HTML'
      });

      return res.status(200).json({ ok: true });
    }

    // ── Команда /start ──
    if (update.message?.text?.startsWith('/start')) {
      const userId = update.message.from.id;
      const firstName = String(update.message.from.first_name || 'User').replace(/[<>&"]/g, '').slice(0, 64);
      await tgApi(BOT_TOKEN, 'sendMessage', {
        chat_id: userId,
        text: `Привет, <b>${firstName}</b>! 👋\n\nЯ Crymiss Bot — открой приложение для чата с AI.\n\n<b>Планы:</b>\n⚡ Pro — 100 запросов/день за 100 ⭐\n🚀 Ultra — 1000 запросов/день за 350 ⭐`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '🤖 Открыть Crymiss', web_app: { url: process.env.APP_URL || 'https://crymiss.vercel.app' } }
          ],[
            { text: '⚡ Купить Pro — 100 ⭐',   callback_data: `buy_pro_${userId}` },
            { text: '🚀 Купить Ultra — 350 ⭐', callback_data: `buy_ultra_${userId}` }
          ]]
        }
      });
    }

    // ── Callback query (кнопки купить) ──
    if (update.callback_query) {
      const cb     = update.callback_query;
      const userId = cb.from.id;
      const data   = cb.data || '';

      await tgApi(BOT_TOKEN, 'answerCallbackQuery', { callback_query_id: cb.id });

      if (data.startsWith('buy_pro_') || data.startsWith('buy_ultra_')) {
        const plan = data.startsWith('buy_pro_') ? 'pro' : 'ultra';
        const PLANS = {
          pro:   { title: 'Crymiss Pro',   description: '100 запросов в день, умнее и быстрее',        amount: 100 },
          ultra: { title: 'Crymiss Ultra', description: '1000 запросов в день, максимальный интеллект', amount: 350 }
        };
        const p = PLANS[plan];
        await tgApi(BOT_TOKEN, 'sendInvoice', {
          chat_id: userId,
          title: p.title,
          description: p.description,
          payload: JSON.stringify({ plan, tgUserId: userId, ts: Date.now() }),
          currency: 'XTR',
          prices: [{ label: plan.toUpperCase(), amount: p.amount }],
          provider_token: ''
        });
      }
    }

  } catch (err) {
    console.error('Webhook error:', err);
  }

  return res.status(200).json({ ok: true });
}

async function tgApi(token, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

function getPlanSuccessMessage(plan, stars) {
  const plans = {
    pro:   { name: 'Pro',   limit: 100,  emoji: '⚡' },
    ultra: { name: 'Ultra', limit: 1000, emoji: '🚀' }
  };
  const p = plans[plan] || plans.pro;
  return `${p.emoji} <b>Оплата прошла успешно!</b>\n\nПлан <b>${p.name}</b> активирован.\n\n✅ ${p.limit} запросов в день\n✅ Сброс каждые 5 часов\n\nСпасибо за ${stars} ⭐\n\n<a href="${process.env.APP_URL || 'https://crymiss.vercel.app'}">Открыть Crymiss →</a>`;
}
