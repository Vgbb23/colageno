/**
 * Persistência de parâmetros UTM no domínio para todas as páginas/abas.
 * Salva na sessionStorage e mantém na URL em toda navegação.
 */

import { mergeStoredQueryParams } from './campaignQuery';

const UTM_STORAGE_KEY = 'utm_params';

export const UTM_PREFIXES = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

function getSearchParams(search: string): URLSearchParams {
  const q = search.startsWith('?') ? search : `?${search}`;
  return new URLSearchParams(q);
}

/** Verifica se a query string contém algum parâmetro UTM. */
export function hasUtmParams(search: string): boolean {
  if (!search || !search.startsWith('?')) return false;
  const params = getSearchParams(search);
  return UTM_PREFIXES.some((key) => params.has(key));
}

/**
 * Coleta UTMs da query atual mesclada com a campanha salva na sessão (sessionStorage).
 * Usado no checkout para enviar ao backend junto com a criação do PIX.
 */
export function collectUtmParamsFromSearch(currentSearch: string): Record<
  (typeof UTM_PREFIXES)[number],
  string
> {
  const merged = mergeStoredQueryParams(currentSearch || '');
  const searchParams = new URLSearchParams(merged);
  const utm = {} as Record<(typeof UTM_PREFIXES)[number], string>;

  for (const key of UTM_PREFIXES) {
    const valueFromUrl = searchParams.get(key)?.trim() ?? '';
    const storageKey = `utmify:${key}`;
    let valueFromStorage = '';
    try {
      valueFromStorage = sessionStorage.getItem(storageKey)?.trim() ?? '';
      if (valueFromUrl) sessionStorage.setItem(storageKey, valueFromUrl);
    } catch {
      /* ignore */
    }
    utm[key] = valueFromUrl || valueFromStorage || '';
  }

  return utm;
}

/** Retorna a query string atual (com ?) se tiver UTM, senão a salva na sessionStorage. */
export function getUtmSearch(currentSearch: string): string {
  const s = typeof currentSearch === 'string' ? currentSearch : '';
  if (hasUtmParams(s)) return s.startsWith('?') ? s : `?${s}`;
  try {
    const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
    return stored ? (stored.startsWith('?') ? stored : `?${stored}`) : '';
  } catch {
    return '';
  }
}

/** Salva a query string na sessionStorage se contiver UTM. */
export function persistUtmSearch(search: string): void {
  if (!search || !hasUtmParams(search)) return;
  try {
    const q = search.startsWith('?') ? search : `?${search}`;
    sessionStorage.setItem(UTM_STORAGE_KEY, q);
  } catch {
    /* ignore */
  }
}

/** Garante que a URL atual tenha os UTMs (restaura da session se necessário). */
export function ensureUtmInUrl(pathname: string, currentSearch: string): string {
  const utmSearch = getUtmSearch(currentSearch);
  if (!utmSearch) return pathname + (currentSearch || '');
  const hasInCurrent = hasUtmParams(currentSearch);
  return pathname + (hasInCurrent ? currentSearch : utmSearch);
}

/**
 * Query string para /obrigado: remove `kit` e mescla todos os parâmetros persistidos (UTMs + demais).
 */
export function buildObrigadoQueryString(locationSearch: string): string {
  const raw = locationSearch.startsWith('?') ? locationSearch.slice(1) : locationSearch;
  const cur = new URLSearchParams(raw);
  cur.delete('kit');
  const merged = mergeStoredQueryParams(cur.toString() ? `?${cur.toString()}` : '');
  const out = new URLSearchParams(merged);
  out.delete('kit');
  if (!UTM_PREFIXES.some((key) => out.has(key))) {
    const extra = getUtmSearch('');
    const q = extra.startsWith('?') ? extra.slice(1) : extra;
    if (q) {
      const u = new URLSearchParams(q);
      u.forEach((v, k) => {
        if (!out.has(k)) out.set(k, v);
      });
    }
  }
  return out.toString();
}
