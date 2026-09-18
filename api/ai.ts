// api/ai.ts
// Vercel Serverless Function: Secure Server-Side Proxy for Groq AI Engine
// Protects GROQ_API_KEY from ever being exposed to client-side browser bundles (Zero-Trust)

const DEFAULT_GROQ_MODELS = [
  'qwen/qwen3.8-27b',
  'groq/compound-mini',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
];

interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqProxyRequestBody {
  messages: GroqMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export default async function handler(req: any, res: any) {
  // CORS / Preflight handling
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      service: 'Smart Absensi Guru - Secure Groq AI Serverless Proxy',
      timestamp: new Date().toISOString(),
      modelsAvailable: DEFAULT_GROQ_MODELS,
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // 1. Read secret key strictly from server environment (Never leaked to client bundle)
  const apiKey = (process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || '').trim();

  if (!apiKey || apiKey.includes('YOUR_') || apiKey === '') {
    return res.status(503).json({
      success: false,
      error: 'GROQ_API_KEY is not configured on the server.',
      fallbackReason: 'API_KEY_UNAVAILABLE',
    });
  }

  let body: GroqProxyRequestBody = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid JSON body' });
    }
  }

  const { messages, model, temperature = 0.6, max_tokens = 1200 } = body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request: "messages" array is required and must not be empty.',
    });
  }

  // Sanitize messages
  const sanitizedMessages = messages
    .filter((m) => m && typeof m.content === 'string' && m.content.trim() !== '')
    .map((m) => ({
      role: m.role || 'user',
      content: String(m.content).slice(0, 8000), // Protect against payload bloat
    }));

  if (sanitizedMessages.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'All messages were empty after sanitization.',
    });
  }

  // Model fallback cascade
  const configuredModel = model || process.env.VITE_GROQ_MODEL || DEFAULT_GROQ_MODELS[0];
  const candidateModels = Array.from(new Set([configuredModel, ...DEFAULT_GROQ_MODELS]));

  let lastErrorDetails: any = null;

  for (const currentModel of candidateModels) {
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: currentModel,
          messages: sanitizedMessages,
          temperature: Math.min(Math.max(Number(temperature) || 0.6, 0), 1),
          max_tokens: Math.min(Number(max_tokens) || 1200, 4096),
        }),
      });

      if (!groqRes.ok) {
        lastErrorDetails = await groqRes.json().catch(() => ({ status: groqRes.status }));
        continue; // Cascade to next model
      }

      const data = await groqRes.json();
      const content = data?.choices?.[0]?.message?.content;

      if (content && typeof content === 'string' && content.trim() !== '') {
        return res.status(200).json({
          success: true,
          content: content.trim(),
          modelUsed: currentModel,
        });
      }
    } catch (err: any) {
      lastErrorDetails = { message: err?.message || 'Network fetch failure' };
    }
  }

  // If all candidate models failed
  return res.status(502).json({
    success: false,
    error: 'All Groq AI models failed or rate limits exceeded.',
    lastError: lastErrorDetails,
  });
}
