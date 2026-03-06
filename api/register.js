// api/register.js — сохраняет пользователя в Redis при логине
import { kvGet, kvSet, kvZAdd, kvIncr, kvSAdd } from './_redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, name, pic, plan, source, tgId, tgUsername } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  try {
    const now = Date.now();
    const userId = Buffer.from(email).toString('base64').replace(/[^a-zA-Z0-9]/g,'').slice(0,24);
    const today = new Date().toISOString().slice(0,10);

    let existing = null;
    try { existing = await kvGet('user:' + userId); } catch(_) {}
    const isNew = !existing;

    // Для TG пользователей формируем аватарку через telegram API
    // (photo_url из WebApp бывает пустой — используем tgId)
    let avatar = pic || '';
    if (!avatar && tgId) {
      // Telegram не отдаёт фото напрямую через WebApp без bot API
      // Сохраняем tgId и на фронте покажем инициалы или получим через бота
      avatar = '';
    }

    await kvSet('user:' + userId, {
      id: userId,
      email, name,
      pic: avatar,
      plan: plan || 'free',
      source: source || 'web',
      // TG данные — ключевое для отображения в админке
      tgId:       tgId       || null,
      tgUsername: tgUsername || '',
      createdAt:  existing?.createdAt || now,
      lastSeenAt: now,
      loginCount: (existing?.loginCount || 0) + 1,
      banned:     existing?.banned || false,
    });

    if (isNew) {
      await kvZAdd('users:all', now, userId);
      await kvIncr('stats:total_users');
      await kvIncr('stats:users_by_day:' + today);
      await kvIncr('stats:users_by_source:' + (source || 'web'));
    }

    await kvSAdd('stats:active_today:' + today, userId);
    return res.status(200).json({ ok: true, isNew });

  } catch (err) {
    console.error('Register error:', err);
    return res.status(200).json({ ok: true, isNew: false, kvError: err.message });
  }
}
