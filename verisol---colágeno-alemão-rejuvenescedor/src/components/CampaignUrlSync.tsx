/**
 * Mantém na barra de endereço os parâmetros da campanha (UTMs, fbclid, etc.) em /, /checkout e /obrigado.
 */
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { enrichSearchIfNeeded, persistFullQuery } from '../utils/campaignQuery';
import { hasUtmParams, persistUtmSearch } from '../utils/utm';

export function CampaignUrlSync() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const search = location.search || '';
    persistFullQuery(search);
    if (hasUtmParams(search)) persistUtmSearch(search);

    const path = location.pathname;
    if (path !== '/' && path !== '/checkout' && path !== '/obrigado') return;

    const enriched = enrichSearchIfNeeded(path, search);
    if (enriched === null) return;

    const currentRaw = search.startsWith('?') ? search.slice(1) : search;
    if (enriched === currentRaw) return;

    navigate({ pathname: path, search: enriched ? `?${enriched}` : '' }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  return null;
}
