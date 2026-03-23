/**
 * Vercel Serverless: POST /api/create-pix
 * Lógica espelhada de netlify/functions/create-pix.js (sem require — evita 500 no bundle da Vercel).
 */
const FRUITFY_BASE = 'https://api.fruitfy.io';

function collectAllStrings(obj, out = []) {
  if (obj === null || obj === undefined) return out;
  if (typeof obj === 'string') {
    out.push(obj);
    return out;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) collectAllStrings(item, out);
    return out;
  }
  if (typeof obj === 'object') {
    for (const v of Object.values(obj)) collectAllStrings(v, out);
  }
  return out;
}

function normalizePix(s) {
  return String(s).replace(/\s/g, '').trim();
}

function looksLikePixCode(s) {
  const t = String(s).trim();
  if (t.length < 20 || t.length > 2000) return false;
  return /^00020\d/.test(t.replace(/\s/g, ''));
}

function extractPixFromString(s) {
  const t = String(s).trim();
  const normalized = normalizePix(t);
  if (normalized.length >= 20 && normalized.length <= 2000 && /^00020\d/.test(normalized)) {
    return normalized;
  }
  const match = t.replace(/\s/g, '').match(/00020\d[\dA-Za-z.\/-]{20,1500}/);
  return match ? match[0] : null;
}

function pixScore(s) {
  const t = s.trim();
  if (/^00020\d/.test(t)) return 2;
  if (t.length >= 80 && t.length <= 600) return 1;
  return 0;
}

function extractPixCode(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const rec = obj;
  const inner = rec.data;
  const pix = inner?.pix;
  if (pix && typeof pix.code === 'string' && pix.code.trim().length > 0) {
    const raw = pix.code.trim();
    if (/^00020\d/.test(raw.replace(/\s/g, ''))) return raw;
    const extracted = extractPixFromString(pix.code);
    if (extracted) return extracted;
  }
  const keys = ['pix_copy_paste', 'brcode', 'copy_paste', 'pix_code', 'code', 'payload', 'emv', 'qr_code', 'pix'];
  for (const k of keys) {
    const v = inner?.[k] ?? rec[k];
    if (typeof v === 'string') {
      const extracted = extractPixFromString(v);
      if (extracted) return extracted;
    }
  }
  if (inner && typeof inner === 'object') {
    const innerData = inner.data;
    if (innerData && typeof innerData === 'object') {
      const innerRec = innerData;
      const innerPix = innerRec.pix;
      if (innerPix && typeof innerPix.code === 'string' && innerPix.code.trim().length > 0) {
        const raw = innerPix.code.trim();
        if (/^00020\d/.test(raw.replace(/\s/g, ''))) return raw;
        const extracted = extractPixFromString(innerPix.code);
        if (extracted) return extracted;
      }
      for (const k of keys) {
        const v = innerRec[k];
        if (typeof v === 'string') {
          const extracted = extractPixFromString(v);
          if (extracted) return extracted;
        }
      }
    }
  }
  const all = collectAllStrings(obj);
  for (const s of all) {
    const extracted = extractPixFromString(s);
    if (extracted) return extracted;
  }
  const candidates = all.filter(looksLikePixCode).map((s) => normalizePix(s));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => pixScore(b) - pixScore(a));
  return candidates[0];
}

function extractOrderId(obj) {
  if (obj === null || typeof obj !== 'object') return null;
  const rec = obj;
  const tryKey = (r, key) => (typeof r[key] === 'string' ? r[key] : null);
  const id =
    tryKey(rec, 'order_id') ??
    tryKey(rec, 'id') ??
    tryKey(rec, 'uuid') ??
    (rec.order && typeof rec.order === 'object'
      ? tryKey(rec.order, 'id') ?? tryKey(rec.order, 'uuid')
      : null) ??
    (rec.data && typeof rec.data === 'object' ? extractOrderId(rec.data) : null);
  return id;
}

function extractQrCodeImage(obj) {
  if (obj === null || typeof obj !== 'object') return null;
  const rec = obj;
  const inner = rec.data;
  const pix = inner?.pix;
  if (pix && typeof pix.qr_code_base64 === 'string' && pix.qr_code_base64.startsWith('data:')) {
    return pix.qr_code_base64;
  }
  if (inner && typeof inner === 'object') {
    const innerData = inner.data;
    if (innerData && typeof innerData === 'object') {
      const innerPix = innerData.pix;
      if (innerPix && typeof innerPix.qr_code_base64 === 'string' && innerPix.qr_code_base64.startsWith('data:')) {
        return innerPix.qr_code_base64;
      }
    }
  }
  const keys = ['qr_code', 'qr_code_base64', 'qr_code_url', 'qr_code_image'];
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === 'string' && (v.startsWith('data:') || v.startsWith('http') || v.length > 100)) return v;
  }
  return extractQrCodeImage(rec.data);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

function setCors(res) {
  for (const [k, v] of Object.entries(corsHeaders)) {
    res.setHeader(k, v);
  }
}

function parseBody(req) {
  const raw = req.body;
  if (raw == null) return {};
  if (typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;
  const s = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const TOKEN = process.env.FRUITFY_API_TOKEN;
  const STORE_ID = process.env.FRUITFY_STORE_ID;
  const PRODUCT_ID = process.env.FRUITFY_PRODUCT_ID;

  if (!TOKEN || !STORE_ID || !PRODUCT_ID) {
    return res.status(500).json({
      success: false,
      message: 'Configuração da API Fruitfy incompleta (variáveis de ambiente).',
      hint: 'Defina FRUITFY_API_TOKEN, FRUITFY_STORE_ID e FRUITFY_PRODUCT_ID no painel da Vercel.',
    });
  }

  const body = parseBody(req);
  const { name, email, cpf, phone, amount, utm } = body;

  const utmPayload = utm && typeof utm === 'object' ? utm : undefined;
  if (utmPayload) {
    console.log('[create-pix] UTM:', utmPayload);
  }

  if (!name?.trim() || !email?.trim() || !cpf || !phone || amount == null || amount < 1) {
    return res.status(422).json({
      success: false,
      message: 'Dados obrigatórios: name, email, cpf, phone, amount (em centavos).',
    });
  }

  const cpfOnlyNumbers = String(cpf).replace(/\D/g, '');
  const phoneOnlyNumbers = String(phone).replace(/\D/g, '');

  if (cpfOnlyNumbers.length !== 11) {
    return res.status(422).json({ success: false, message: 'CPF deve conter 11 dígitos.' });
  }

  const amountCentavos = Math.round(Number(amount));
  if (amountCentavos < 100) {
    return res.status(422).json({
      success: false,
      message: 'Valor mínimo para PIX é R$ 1,00 (100 centavos).',
    });
  }

  const payload = {
    name: name.trim(),
    email: email.trim(),
    cpf: cpfOnlyNumbers,
    phone: phoneOnlyNumbers,
    items: [{ id: PRODUCT_ID, value: amountCentavos, quantity: 1 }],
  };

  if (utmPayload) {
    payload.utm = utmPayload;
  }

  try {
    const response = await fetch(`${FRUITFY_BASE}/api/pix/charge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Language': 'pt_BR',
        Authorization: `Bearer ${TOKEN}`,
        'Store-Id': STORE_ID,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: data.message || 'Erro ao criar cobrança PIX.',
        errors: data.errors,
      });
    }

    let orderId = extractOrderId(data);
    let pixCopyPaste = extractPixCode(data);
    let qrCodeImage = extractQrCodeImage(data);

    if (!pixCopyPaste && orderId) {
      try {
        const orderRes = await fetch(`${FRUITFY_BASE}/api/order/${orderId}`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${TOKEN}`,
            'Store-Id': STORE_ID,
          },
        });
        const orderData = await orderRes.json().catch(() => ({}));
        if (orderRes.ok && orderData) {
          pixCopyPaste = pixCopyPaste || extractPixCode(orderData);
          qrCodeImage = qrCodeImage || extractQrCodeImage(orderData);
        }
      } catch (_) {}
    }

    return res.status(201).json({
      success: true,
      pixCopyPaste: pixCopyPaste || null,
      orderId: orderId || undefined,
      qrCodeImage: qrCodeImage || undefined,
      data,
    });
  } catch (err) {
    console.error('Fruitfy API error:', err);
    return res.status(500).json({
      success: false,
      message: 'Erro ao comunicar com o gateway de pagamento.',
    });
  }
}
