// api/check-plan.js
// Клиент вызывает при логине — проверяет есть ли выданный план от админа
// GET /api/check-plan?userId=xxx

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    const user = await kv.get(`user:${userId}`);
    if (!user) return res.status(200).json({ plan: null, banned: false });

    return res.status(200).json({
      plan: user.plan || 'free',
      banned: user.banned || false,
      name: user.name,
    });
  } catch (err) {
    // KV not connected — silently return null
    return res.status(200).json({ plan: null, banned: false });
  }
}
