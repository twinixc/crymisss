// api/chat.js — Groq API proxy с поддержкой изображений (vision)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server misconfigured: missing GROQ_API_KEY' });

  const { messages, plan } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages required' });
  }

  // Vision модель для изображений, текстовые для обычных сообщений
  const hasImages = messages.some(m =>
    Array.isArray(m.parts)
      ? m.parts.some(p => p.image_data)
      : m.image_data
  );

  const MODELS = {
    free:  hasImages ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.1-8b-instant',
    pro:   hasImages ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.3-70b-versatile',
    ultra: hasImages ? 'meta-llama/llama-4-maverick-17b-128e-instruct' : 'llama-3.3-70b-versatile',
  };

  const SYSTEM = 'You are Crymiss, an advanced AI assistant. Your name is Crymiss — NOT Groq, Meta, Llama, ChatGPT, Claude, or Gemini. If asked who you are, say you are Crymiss powered by proprietary AI. Never mention Groq, Meta, Llama, OpenAI, Anthropic, or Google. You are expert at code, analysis, writing, vision tasks, and any request. Reply in the language the user writes in.';

  try {
    const model = MODELS[plan] || MODELS.free;

    // Normalize messages to OpenAI format (Groq is OpenAI-compatible)
    const normalized = messages.map(m => {
      const role = m.role === 'model' ? 'assistant' : (m.role || 'user');

      // Handle parts array (Gemini format) OR flat message
      let parts = Array.isArray(m.parts) ? m.parts : [{ text: m.text || m.content || '' }];

      // Build content — string if text-only, array if has images
      const imgParts = parts.filter(p => p.image_data);
      const textPart = parts.find(p => p.text)?.text || '';

      if (imgParts.length > 0) {
        // Multi-modal content
        const contentArr = [];
        if (textPart) contentArr.push({ type: 'text', text: textPart });
        imgParts.forEach(p => {
          contentArr.push({
            type: 'image_url',
            image_url: { url: `data:${p.mime_type || 'image/jpeg'};base64,${p.image_data}` }
          });
        });
        return { role, content: contentArr };
      }

      return { role, content: textPart };
    });

    const groqMessages = [{ role: 'system', content: SYSTEM }, ...normalized];

    const body = {
      model,
      messages: groqMessages,
      temperature: plan === 'free' ? 0.7 : 0.85,
      max_tokens: plan === 'free' ? 1024 : plan === 'pro' ? 4096 : 8192,
      stream: false,
    };

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!groqRes.ok) {
      const errData = await groqRes.json().catch(() => ({}));
      return res.status(groqRes.status).json({
        error: errData?.error?.message || ('Groq error ' + groqRes.status),
      });
    }

    const data = await groqRes.json();
    const reply = data?.choices?.[0]?.message?.content;
    if (!reply) return res.status(500).json({ error: 'Empty response from AI' });

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Chat error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
