/**
 * Vercel: GET /api/order/:orderId — proxy direto à Fruitfy (igual testohardcomutm).
 * Documentação: GET https://api.fruitfy.io/api/order/{order}
 */
const FRUITFY_BASE = 'https://api.fruitfy.io';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

export default async function handler(req, res) {
  for (const [k, v] of Object.entries(corsHeaders)) {
    res.setHeader(k, v);
  }

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
    });
  }

  const orderId = String(req.query?.orderId || '').trim();
  if (!orderId) {
    return res.status(400).json({ success: false, message: 'ID do pedido inválido.' });
  }

  try {
    const response = await fetch(`${FRUITFY_BASE}/api/order/${encodeURIComponent(orderId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Store-Id': STORE_ID,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Language': 'pt_BR',
      },
    });

    const responseData = await response.json().catch(() => null);
    return res
      .status(response.status)
      .json(responseData ?? { success: false, message: 'Resposta inválida da Fruitfy.' });
  } catch (err) {
    console.error('Fruitfy GET /api/order proxy:', err);
    return res.status(500).json({
      success: false,
      message: 'Falha ao consultar pedido na Fruitfy.',
    });
  }
}
