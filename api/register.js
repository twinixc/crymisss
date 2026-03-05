// api/register.js
// Вызывается при каждом логине — сохраняет пользователя в Vercel KV (Redis)
// Vercel KV бесплатно: 30k запросов/месяц, 256MB

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, name, pic, plan, source } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  try {
    const now = Date.now();
    const userId = Buffer.from(email).toString('base64').replace(/[^a-zA-Z0-9]/g,'').slice(0,24);
    const today = new Date().toISOString().slice(0,10); // YYYY-MM-DD

    // Проверяем, новый ли пользователь
    const existing = await kv.get(`user:${userId}`);
    const isNew = !existing;

    // Сохраняем/обновляем пользователя
    await kv.set(`user:${userId}`, {
      email, name, pic: pic||'',
      plan: plan||'free',
      source: source||'web',   // 'web' или 'telegram'
      createdAt: existing?.createdAt || now,
      lastSeenAt: now,
      loginCount: (existing?.loginCount||0) + 1,
    });

    if (isNew) {
      // Добавляем в sorted set по времени регистрации (для сортировки)
      await kv.zadd('users:all', { score: now, member: userId });
      // Инкрементим счётчики
      await kv.incr('stats:total_users');
      await kv.incr(`stats:users_by_day:${today}`);
      await kv.incr(`stats:users_by_source:${source||'web'}`);
    }

    // Обновляем счётчик активных сегодня
    await kv.sadd(`stats:active_today:${today}`, userId);

    return res.status(200).json({ ok: true, isNew });
  } catch (err) {
    console.error('Register error:', err);
    // Если KV не подключён — просто игнорируем (не ломаем приложение)
    return res.status(200).json({ ok: true, isNew: false, kvError: err.message });
  }
}
