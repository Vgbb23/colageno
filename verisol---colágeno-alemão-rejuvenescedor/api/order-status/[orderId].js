/**
 * Vercel Serverless: GET /api/order-status/:orderId
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { handler } = require('../../netlify/functions/order-status.js');

export default async function orderStatusVercel(req, res) {
  const orderId = req.query?.orderId || '';
  const event = {
    httpMethod: req.method || 'GET',
    pathParameters: { orderId },
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
    console.error('order-status Vercel:', err);
    res.status(500).json({ success: false, message: 'Erro interno na função.' });
  }
}
