/**
 * Pós-pagamento PIX (alinhado ao testohardcomutm): prefill para upsell e detecção de pedido pago na resposta Fruitfy.
 * Documentação Fruitfy: GET /api/order/{order} — pedido com status "paid" e campo paid_at quando pago.
 */

/** Telefone só dígitos; prefixo 55 se ausente (Brasil). */
export function normalizePhoneForUpsell(phoneValue: string): string {
  const digits = phoneValue.replace(/\D/g, '');
  return digits.startsWith('55') ? digits : `55${digits}`;
}

/** Compacta dados do checkout para o upsell (base64url). */
export function encodeUpsellCustomerPrefill(payload: { n: string; e: string; p: string; c: string }): string {
  const raw = JSON.stringify(payload);
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Interpreta JSON da Fruitfy (GET /api/order ou wrapper) — pago se paid_at preenchido ou status === paid. */
export function isFruitfyOrderPaid(orderResponse: unknown): boolean {
  if (orderResponse == null || typeof orderResponse !== 'object') return false;
  const r = orderResponse as Record<string, unknown>;

  const hasPaidAt = (o: unknown): boolean => {
    if (o == null || typeof o !== 'object') return false;
    const v = (o as Record<string, unknown>).paid_at;
    return v != null && String(v).trim() !== '';
  };

  const isPaidStatus = (o: unknown): boolean => {
    if (o == null || typeof o !== 'object') return false;
    const s = (o as Record<string, unknown>).status;
    return typeof s === 'string' && s.trim().toLowerCase() === 'paid';
  };

  const check = (o: unknown) => hasPaidAt(o) || isPaidStatus(o);

  if (check(r)) return true;

  const data = r.data;
  if (data != null && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (check(d)) return true;
    // Alguns formatos: { data: { data: order } }
    if (d.data != null && typeof d.data === 'object' && check(d.data)) return true;
    if (d.order != null && typeof d.order === 'object' && check(d.order)) return true;
  }

  if (r.order != null && typeof r.order === 'object' && check(r.order)) return true;

  return false;
}
