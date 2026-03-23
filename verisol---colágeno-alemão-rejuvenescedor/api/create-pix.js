/**
 * Vercel Serverless: POST /api/create-pix
 * Reutiliza netlify/functions/create-pix.js (CommonJS).
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { handler } = require('../netlify/functions/create-pix.js');

export default async function createPixVercel(req, res) {
  const event = {
    httpMethod: req.method || 'GET',
    body:
      req.method === 'POST' && req.body
        ? typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body)
        : '{}',
  };

  try {
    const result = await handler(event);
    const headers = result.headers || {};
    for (const [k, v] of Object.entries(headers)) {
      if (v != null) res.setHeader(k, String(v));
    }
    let parsed;
    try {
      parsed = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
    } catch {
      parsed = { message: result.body };
    }
    res.status(result.statusCode || 500).json(parsed);
  } catch (err) {
    console.error('create-pix Vercel:', err);
    res.status(500).json({ success: false, message: 'Erro interno na função.' });
  }
}
