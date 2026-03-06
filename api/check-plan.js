// api/check-plan.js — клиент проверяет план при каждом логине
import { getRedis } from './_redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    const r = await getRedis();
    const raw = await r.get('user:' + userId);
    if (!raw) return res.status(200).json({ plan: 'free', banned: false });
    const user = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return res.status(200).json({
      plan:    user.plan    || 'free',
      banned:  user.banned  || false,
    });
  } catch(_) {
    return res.status(200).json({ plan: 'free', banned: false });
  }
}
