// api/create-invoice.js
// Создаёт инвойс для оплаты звёздами Telegram через бота
// Бот сам отправляет invoice пользователю

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) return res.status(500).json({ error: 'Bot token not configured' });

  const { plan, tgUserId, tgUsername } = req.body;
  if (!plan || !tgUserId) return res.status(400).json({ error: 'Missing plan or tgUserId' });

  const PLANS = {
    pro:   { title: 'Crymiss Pro',   description: '100 запросов в день — умнее и быстрее',      amount: 100, label: 'PRO'   },
    ultra: { title: 'Crymiss Ultra', description: '1000 запросов в день — максимальный интеллект', amount: 350, label: 'ULTRA' }
  };

  const p = PLANS[plan];
  if (!p) return res.status(400).json({ error: 'Invalid plan' });

  try {
    // Отправляем инвойс пользователю через sendInvoice
    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendInvoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: tgUserId,
        title: p.title,
        description: p.description,
        payload: JSON.stringify({ plan, tgUserId, ts: Date.now() }),
        currency: 'XTR',         // XTR = Telegram Stars
        prices: [{ label: p.label, amount: p.amount }],
        provider_token: '',       // для Stars provider_token пустой
        start_parameter: `buy_${plan}`
      })
    });

    const tgData = await tgRes.json();
    if (!tgData.ok) throw new Error(tgData.description || 'Telegram API error');

    return res.status(200).json({ ok: true, messageId: tgData.result?.message_id });

  } catch (err) {
    console.error('Invoice error:', err);
    return res.status(500).json({ error: err.message });
  }
}
