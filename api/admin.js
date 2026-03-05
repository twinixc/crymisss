// api/admin.js
// Статистика для владельца — защищена ADMIN_SECRET токеном
// Доступ: GET /api/admin?token=твой_секрет

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Проверка токена
  const token = req.query.token || req.headers['x-admin-token'];
  const secret = process.env.ADMIN_SECRET;

  if (!secret || token !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const today = new Date().toISOString().slice(0,10);

    // Основные счётчики
    const [totalUsers, activeToday] = await Promise.all([
      kv.get('stats:total_users'),
      kv.scard(`stats:active_today:${today}`),
    ]);

    // Пользователи по источнику
    const [webUsers, tgUsers] = await Promise.all([
      kv.get('stats:users_by_source:web'),
      kv.get('stats:users_by_source:telegram'),
    ]);

    // Последние 7 дней регистраций
    const last7days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0,10);
      const count = await kv.get(`stats:users_by_day:${d}`) || 0;
      last7days.push({ date: d, count: Number(count) });
    }

    // Последние 20 зарегистрированных пользователей
    const recentIds = await kv.zrange('users:all', -20, -1, { rev: true });
    const recentUsers = recentIds.length
      ? await Promise.all(recentIds.map(id => kv.get(`user:${id}`)))
      : [];

    // Пользователи по планам (считаем из последних)
    const allIds = await kv.zrange('users:all', 0, -1);
    const planCounts = { free: 0, pro: 0, ultra: 0 };
    if (allIds.length) {
      const allUsers = await Promise.all(allIds.map(id => kv.get(`user:${id}`)));
      allUsers.forEach(u => { if (u?.plan) planCounts[u.plan] = (planCounts[u.plan]||0) + 1; });
    }

    return res.status(200).json({
      totalUsers: Number(totalUsers) || 0,
      activeToday: Number(activeToday) || 0,
      webUsers: Number(webUsers) || 0,
      tgUsers: Number(tgUsers) || 0,
      planCounts,
      last7days,
      recentUsers: recentUsers.filter(Boolean).map(u => ({
        name: u.name,
        email: u.email?.replace(/(.{2}).+(@.+)/, '$1***$2'), // маскируем email
        plan: u.plan,
        source: u.source,
        createdAt: u.createdAt,
        lastSeenAt: u.lastSeenAt,
        loginCount: u.loginCount,
      }))
    });

  } catch (err) {
    console.error('Admin error:', err);
    return res.status(500).json({ error: err.message });
  }
}
