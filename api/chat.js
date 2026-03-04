// api/chat.js — Vercel Serverless Function
// Ключ хранится на сервере в ENV, браузер его никогда не видит

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfigured: missing API key' });
  }

  try {
    const { messages, plan } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request: messages required' });
    }

    // Выбираем модель по плану
    const models = {
      free:  'gemini-2.0-flash-lite',
      pro:   'gemini-2.0-flash',
      ultra: 'gemini-2.0-flash'
    };
    const model = models[plan] || models.free;

    const SYSTEM_PROMPT = `You are Crymiss, an advanced AI assistant created by the Crymiss team.
Your name is Crymiss. You are NOT Gemini, NOT Google, NOT ChatGPT, NOT Claude — you are Crymiss.
If asked who you are, what your name is, or if you are Gemini/Google — always say you are Crymiss.
You can say you are powered by advanced proprietary language models, but never mention Gemini, Google, OpenAI, or Anthropic.
You are smart, concise, and expert at code, analysis, writing, and any task.
Reply in the language the user writes in.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: messages,
      generationConfig: {
        temperature: plan === 'free' ? 0.7 : 0.9,
        maxOutputTokens: plan === 'free' ? 1024 : 2048
      }
    };

    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!geminiRes.ok) {
      const errData = await geminiRes.json().catch(() => ({}));
      return res.status(geminiRes.status).json({
        error: errData?.error?.message || `Gemini error ${geminiRes.status}`
      });
    }

    const data = await geminiRes.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      return res.status(500).json({ error: 'Empty response from AI' });
    }

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Chat API error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
