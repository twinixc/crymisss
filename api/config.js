// api/config.js — отдаёт публичные настройки фронтенду
// Google Client ID не секретный (он всё равно виден), но так удобнее управлять

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600');

  // ownerIdentity — НЕ секрет, просто для UI-распознавания.
  // Сам доступ к управлению защищён ADMIN_SECRET токеном.
  const raw = process.env.OWNER_IDENTITY || '';
  // Normalize: strip @, lowercase
  const ownerIdentity = raw.replace('@','').toLowerCase().trim();

  return res.status(200).json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    ownerIdentity,   // tg username или номер телефона владельца (нормализован)
    models: {
      free: 'llama-3.1-8b-instant',
      pro: 'llama-3.3-70b-versatile',
      ultra: 'llama-3.3-70b-versatile',
    }
  });
}
