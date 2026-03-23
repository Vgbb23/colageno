/**
 * Persistência da query string completa (UTMs, fbclid, gclid, etc.) para acompanhar a URL em todas as páginas.
 */

const FULL_QUERY_KEY = 'full_campaign_query';

/** Grava a query atual se tiver ao menos um parâmetro. */
export function persistFullQuery(search: string): void {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  if (!raw.trim()) return;
  try {
    sessionStorage.setItem(FULL_QUERY_KEY, raw);
  } catch {
    /* ignore */
  }
}

function getStoredQueryRaw(): string {
  try {
    return sessionStorage.getItem(FULL_QUERY_KEY) || '';
  } catch {
    return '';
  }
}

/** Mescla parâmetros gravados na sessão com a query atual (não sobrescreve chaves já presentes). */
export function mergeStoredQueryParams(currentSearch: string): string {
  const raw = currentSearch.startsWith('?') ? currentSearch.slice(1) : currentSearch;
  const cur = new URLSearchParams(raw);
  const stored = getStoredQueryRaw();
  if (!stored) return cur.toString();
  const st = new URLSearchParams(stored);
  st.forEach((v, k) => {
    if (!cur.has(k)) cur.set(k, v);
  });
  return cur.toString();
}

/**
 * Se faltar parâmetros em relação ao que está salvo, retorna a nova query string; senão null.
 * `preserveKeys` nunca são copiados do stored (ex.: kit só no checkout).
 */
export function enrichSearchIfNeeded(
  pathname: string,
  currentSearch: string,
  options?: { skipKeysFromStored?: string[] }
): string | null {
  const skip = new Set(options?.skipKeysFromStored ?? []);
  const raw = currentSearch.startsWith('?') ? currentSearch.slice(1) : currentSearch;
  const cur = new URLSearchParams(raw);
  const stored = getStoredQueryRaw();
  if (!stored) return null;
  const st = new URLSearchParams(stored);
  let changed = false;
  st.forEach((v, k) => {
    if (skip.has(k)) return;
    if (pathname !== '/checkout' && k === 'kit') return;
    if (!cur.has(k)) {
      cur.set(k, v);
      changed = true;
    }
  });
  return changed ? cur.toString() : null;
}

/** Sessão: só liberar /obrigado após API marcar como pago. */
export const OBRIGADO_UNLOCK_KEY = 'obrigado_paid_unlock';

export type ObrigadoUnlockPayload = { t: number; orderId: string };

export function setObrigadoUnlock(orderId: string): void {
  try {
    const payload: ObrigadoUnlockPayload = { t: Date.now(), orderId: String(orderId) };
    sessionStorage.setItem(OBRIGADO_UNLOCK_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

const UNLOCK_MAX_MS = 45 * 60 * 1000;

/** Valida unlock sem consumir (para refresh na página obrigado). */
export function isObrigadoUnlockValid(): boolean {
  try {
    const raw = sessionStorage.getItem(OBRIGADO_UNLOCK_KEY);
    if (!raw) return false;
    const p = JSON.parse(raw) as ObrigadoUnlockPayload;
    if (!p?.t || !p?.orderId) return false;
    if (Date.now() - p.t > UNLOCK_MAX_MS) {
      sessionStorage.removeItem(OBRIGADO_UNLOCK_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function clearObrigadoUnlock(): void {
  try {
    sessionStorage.removeItem(OBRIGADO_UNLOCK_KEY);
  } catch {
    /* ignore */
  }
}
