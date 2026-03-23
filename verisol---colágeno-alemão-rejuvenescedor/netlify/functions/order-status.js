/**
 * Netlify Function: consulta status de pagamento do pedido na Fruitfy.
 * Rota: GET /.netlify/functions/order-status/:orderId (ou /api/order-status/:orderId via redirect)
 */

const FRUITFY_BASE = 'https://api.fruitfy.io';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  };
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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { success: false, message: 'Method Not Allowed' });
  }

  const TOKEN = process.env.FRUITFY_API_TOKEN;
  const STORE_ID = process.env.FRUITFY_STORE_ID;
  if (!TOKEN || !STORE_ID) {
    return jsonResponse(500, {
      success: false,
      message: 'Configuração da API Fruitfy incompleta (FRUITFY_API_TOKEN, FRUITFY_STORE_ID).',
    });
  }

  const orderId = String(event.pathParameters?.orderId || '').trim();
  if (!orderId) {
    return jsonResponse(422, { success: false, message: 'orderId é obrigatório.' });
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
      return jsonResponse(orderRes.status, {
        success: false,
        message: orderData.message || 'Erro ao consultar status do pedido.',
      });
    }

    return jsonResponse(200, {
      success: true,
      paid: extractPaidStatus(orderData),
      orderId,
      data: orderData,
    });
  } catch (err) {
    console.error('Fruitfy order status error:', err);
    return jsonResponse(500, {
      success: false,
      message: 'Erro ao consultar status do pedido.',
    });
  }
};
