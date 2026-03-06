// api/check-plan.js — клиент проверяет план при логине
import { kvGet } from './_redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    const user = await kvGet('user:' + userId);
    return res.status(200).json({ plan: user.plan||'free', banned: user.banned||false });
  } catch(_) {
    return res.status(200).json({ plan: null, banned: false });
  }
}
