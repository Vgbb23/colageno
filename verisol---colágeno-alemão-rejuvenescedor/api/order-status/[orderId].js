/**
 * Vercel Serverless: GET /api/order-status/:orderId
 * Lógica espelhada de netlify/functions/order-status.js (sem require).
 */
const FRUITFY_BASE = 'https://api.fruitfy.io';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

function setCors(res) {
  for (const [k, v] of Object.entries(corsHeaders)) {
    res.setHeader(k, v);
  }
}

function isPaidStatusValue(v) {
  if (typeof v === 'boolean') return v === true;
  if (typeof v !== 'string') return false;
  const s = v.trim().toLowerCase();
  return [
    'paid',
    'approved',
    'succeeded',
    'success',
    'completed',
    'pago',
    'aprovado',
    'confirmado',
    'concluido',
    'concluído',
  ].some((k) => s.includes(k));
}

function extractPaidStatus(obj) {
  if (obj == null) return false;
  if (Array.isArray(obj)) return obj.some((item) => extractPaidStatus(item));
  if (typeof obj !== 'object') return false;
  const rec = obj;

  for (const key of ['paid', 'is_paid', 'payment_confirmed', 'approved']) {
    if (typeof rec[key] === 'boolean' && rec[key] === true) return true;
  }
  for (const key of ['status', 'payment_status', 'pix_status', 'order_status', 'situation', 'state']) {
    if (isPaidStatusValue(rec[key])) return true;
  }
  return Object.values(rec).some((value) => extractPaidStatus(value));
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const TOKEN = process.env.FRUITFY_API_TOKEN;
  const STORE_ID = process.env.FRUITFY_STORE_ID;
  if (!TOKEN || !STORE_ID) {
    return res.status(500).json({
      success: false,
      message: 'Configuração da API Fruitfy incompleta (FRUITFY_API_TOKEN, FRUITFY_STORE_ID).',
      hint: 'Defina as variáveis no painel da Vercel.',
    });
  }

  const orderId = String(req.query?.orderId || '').trim();
  if (!orderId) {
    return res.status(422).json({ success: false, message: 'orderId é obrigatório.' });
  }

  try {
    const orderRes = await fetch(`${FRUITFY_BASE}/api/order/${orderId}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${TOKEN}`,
        'Store-Id': STORE_ID,
      },
    });
    const orderData = await orderRes.json().catch(() => ({}));
    if (!orderRes.ok) {
      return res.status(orderRes.status).json({
        success: false,
        message: orderData.message || 'Erro ao consultar status do pedido.',
      });
    }

    return res.status(200).json({
      success: true,
      paid: extractPaidStatus(orderData),
      orderId,
      data: orderData,
    });
  } catch (err) {
    console.error('Fruitfy order status error:', err);
    return res.status(500).json({
      success: false,
      message: 'Erro ao consultar status do pedido.',
    });
  }
}
