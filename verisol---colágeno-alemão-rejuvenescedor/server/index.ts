/**
 * Servidor da API que integra com a Fruitfy (PIX).
 * Mantém token e Store-Id no servidor para não expor no frontend.
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const FRUITFY_BASE = 'https://api.fruitfy.io';
const TOKEN = process.env.FRUITFY_API_TOKEN;
const STORE_ID = process.env.FRUITFY_STORE_ID;
const PRODUCT_ID = process.env.FRUITFY_PRODUCT_ID;

/** Última resposta da Fruitfy (para debug quando o PIX não é encontrado). */
let lastFruitfyResponse: unknown = null;

/** Coleta todas as strings de um objeto (recursivo, incluindo arrays). */
function collectAllStrings(obj: unknown, out: string[] = []): string[] {
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

/** Normaliza código PIX: remove espaços e quebras (padrão copia e cola). */
function normalizePix(s: string): string {
  return String(s).replace(/\s/g, '').trim();
}

/** Verifica se a string parece um código PIX (começa com 00020 e tamanho ok). */
function looksLikePixCode(s: string): boolean {
  const t = String(s).trim();
  if (t.length < 20 || t.length > 2000) return false;
  return /^00020\d/.test(t.replace(/\s/g, ''));
}

/** Extrai ou valida código PIX; aceita formato Fruitfy (com pontos, barras, espaços). */
function extractPixFromString(s: string): string | null {
  const t = String(s).trim();
  const normalized = normalizePix(t);
  if (normalized.length >= 20 && normalized.length <= 2000 && /^00020\d/.test(normalized)) {
    return normalized;
  }
  const match = t.replace(/\s/g, '').match(/00020\d[\dA-Za-z.\/-]{20,1500}/);
  return match ? match[0] : null;
}

/** Preferência: códigos que começam com 00020 (padrão PIX BR). */
function pixScore(s: string): number {
  const t = s.trim();
  if (/^00020\d/.test(t)) return 2;
  if (t.length >= 80 && t.length <= 600) return 1;
  return 0;
}

function extractPixCode(obj: unknown): string | null {
  if (!obj || typeof obj !== 'object') return null;
  const rec = obj as Record<string, unknown>;
  const inner = rec.data as Record<string, unknown> | undefined;
  const pix = inner?.pix as Record<string, unknown> | undefined;
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
    const innerData = (inner as Record<string, unknown>).data;
    if (innerData && typeof innerData === 'object') {
      const innerRec = innerData as Record<string, unknown>;
      const innerPix = innerRec.pix as Record<string, unknown> | undefined;
      if (innerPix && typeof innerPix.code === 'string' && innerPix.code.trim().length > 0) {
        const raw = (innerPix.code as string).trim();
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

function extractOrderId(obj: unknown): string | null {
  if (obj === null || typeof obj !== 'object') return null;
  const rec = obj as Record<string, unknown>;
  const tryKey = (r: Record<string, unknown>, key: string) => {
    const val = r[key];
    return typeof val === 'string' ? val : null;
  };
  const id =
    tryKey(rec, 'order_id') ?? tryKey(rec, 'id') ?? tryKey(rec, 'uuid') ??
    (rec.order && typeof rec.order === 'object' ? tryKey(rec.order as Record<string, unknown>, 'id') ?? tryKey(rec.order as Record<string, unknown>, 'uuid') : null) ??
    (rec.data && typeof rec.data === 'object' ? extractOrderId(rec.data) : null);
  return id;
}

function extractQrCodeImage(obj: unknown): string | null {
  if (obj === null || typeof obj !== 'object') return null;
  const rec = obj as Record<string, unknown>;
  const inner = rec.data as Record<string, unknown> | undefined;
  const pix = inner?.pix as Record<string, unknown> | undefined;
  if (pix && typeof pix.qr_code_base64 === 'string' && pix.qr_code_base64.startsWith('data:')) {
    return pix.qr_code_base64;
  }
  if (inner && typeof inner === 'object') {
    const innerData = (inner as Record<string, unknown>).data;
    if (innerData && typeof innerData === 'object') {
      const innerPix = (innerData as Record<string, unknown>).pix as Record<string, unknown> | undefined;
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

function isPaidStatusValue(v: unknown): boolean {
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

function extractPaidStatus(obj: unknown): boolean {
  if (obj == null) return false;
  if (Array.isArray(obj)) return obj.some((item) => extractPaidStatus(item));
  if (typeof obj !== 'object') return false;
  const rec = obj as Record<string, unknown>;

  const directKeys = ['paid', 'is_paid', 'payment_confirmed', 'approved'];
  for (const key of directKeys) {
    if (typeof rec[key] === 'boolean' && rec[key] === true) return true;
  }

  const statusKeys = [
    'status',
    'payment_status',
    'pix_status',
    'order_status',
    'situation',
    'state',
  ];
  for (const key of statusKeys) {
    if (isPaidStatusValue(rec[key])) return true;
  }

  for (const value of Object.values(rec)) {
    if (extractPaidStatus(value)) return true;
  }
  return false;
}

function extractTransactionStatus(obj: unknown): string | null {
  if (obj == null || typeof obj !== 'object') return null;
  const rec = obj as Record<string, unknown>;

  const tryGetStatus = (value: unknown): string | null => {
    if (!value || typeof value !== 'object') return null;
    const candidate = (value as Record<string, unknown>).status;
    return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
  };

  // Formatos esperados da Fruitfy: { data: { status } } e variações aninhadas.
  const direct = typeof rec.status === 'string' && rec.status.trim() ? rec.status.trim() : null;
  const inData = tryGetStatus(rec.data);
  const inNestedData = rec.data && typeof rec.data === 'object'
    ? tryGetStatus((rec.data as Record<string, unknown>).data)
    : null;
  const inOrder = tryGetStatus(rec.order);
  const inDataOrder = rec.data && typeof rec.data === 'object'
    ? tryGetStatus((rec.data as Record<string, unknown>).order)
    : null;

  return direct ?? inData ?? inNestedData ?? inOrder ?? inDataOrder;
}

app.get('/api/last-pix-response', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(lastFruitfyResponse, null, 2));
});

app.get('/api/order-status/:orderId', async (req, res) => {
  if (!TOKEN || !STORE_ID) {
    return res.status(500).json({
      success: false,
      message: 'Configuração da API Fruitfy incompleta (FRUITFY_API_TOKEN, FRUITFY_STORE_ID).',
    });
  }
  const orderId = String(req.params.orderId || '').trim();
  if (!orderId) {
    return res.status(422).json({ success: false, message: 'orderId é obrigatório.' });
  }

  try {
    const orderRes = await fetch(`${FRUITFY_BASE}/api/order/${orderId}`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
        'Store-Id': STORE_ID,
      },
    });
    const orderData = await orderRes.json().catch(() => ({}));
    if (!orderRes.ok) {
      return res.status(orderRes.status).json({
        success: false,
        message: (orderData as { message?: string }).message || 'Erro ao consultar status do pedido.',
      });
    }
    const transactionStatus = extractTransactionStatus(orderData);
    const paidByStatus = transactionStatus?.toLowerCase() === 'paid';

    return res.status(200).json({
      success: true,
      paid: paidByStatus || extractPaidStatus(orderData),
      status: transactionStatus,
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
});

app.post('/api/create-pix', async (req, res) => {
  console.log('[API] POST /api/create-pix recebido');
  if (!TOKEN || !STORE_ID || !PRODUCT_ID) {
    return res.status(500).json({
      success: false,
      message: 'Configuração da API Fruitfy incompleta (FRUITFY_API_TOKEN, FRUITFY_STORE_ID, FRUITFY_PRODUCT_ID).',
    });
  }

  const { name, email, cpf, phone, amount, utm } = req.body as {
    name?: string;
    email?: string;
    cpf?: string;
    phone?: string;
    amount?: number;
    utm?: unknown;
  };

  const utmPayload = utm && typeof utm === 'object' ? (utm as Record<string, unknown>) : undefined;
  if (utmPayload) {
    console.log('[API] UTM recebidos (Fruitfy: campo `utm` no body, como testohardcomutm):', utmPayload);
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
    return res.status(422).json({
      success: false,
      message: 'CPF deve conter 11 dígitos.',
    });
  }

  const amountCentavos = Math.round(Number(amount));
  if (amountCentavos < 100) {
    return res.status(422).json({
      success: false,
      message: 'Valor mínimo para PIX é R$ 1,00 (100 centavos).',
    });
  }

  const body: Record<string, unknown> = {
    name: name.trim(),
    email: email.trim(),
    cpf: cpfOnlyNumbers,
    phone: phoneOnlyNumbers,
    items: [
      {
        id: PRODUCT_ID,
        value: amountCentavos,
        quantity: 1,
      },
    ],
  };

  /** Igual testohardcomutm/testohard-main/api/pix/charge.ts: só `utm` como objeto aninhado. */
  if (utmPayload) {
    body.utm = utmPayload;
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
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    lastFruitfyResponse = data;

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: (data as { message?: string }).message || 'Erro ao criar cobrança PIX.',
        errors: (data as { errors?: unknown }).errors,
      });
    }

    const orderId = extractOrderId(data);
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
      } catch (_) {
        /* ignora */
      }
    }

    if (!pixCopyPaste) {
      const fr = data as Record<string, unknown>;
      console.error('[API] PIX não encontrado na resposta. Chaves:', fr ? Object.keys(fr) : []);
      if (fr?.data && typeof fr.data === 'object') {
        console.error('[API] data chaves:', Object.keys(fr.data as object));
      }
      console.error('[API] Abra http://localhost:3001/api/last-pix-response para ver a resposta completa.');
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
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor API rodando em http://localhost:${PORT}`);
});
