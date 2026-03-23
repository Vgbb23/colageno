/**
 * Pixel e script UTMify em todas as rotas (SPA).
 * ID configurável: VITE_UTMIFY_PIXEL_ID no .env
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    pixelId?: string;
  }
}

const DEFAULT_PIXEL_ID = '69bd76161c15bb07ab816873';

function getPixelId(): string {
  const env = import.meta.env.VITE_UTMIFY_PIXEL_ID as string | undefined;
  return (env && env.trim()) || DEFAULT_PIXEL_ID;
}

export function UtmifyScripts() {
  const location = useLocation();

  useEffect(() => {
    window.pixelId = getPixelId();
  }, []);

  useEffect(() => {
    const already =
      document.querySelector('script[data-utmify-pixel]') ||
      document.querySelector('script[src*="cdn.utmify.com.br/scripts/pixel"]');
    if (already) return;
    const a = document.createElement('script');
    a.async = true;
    a.defer = true;
    a.src = 'https://cdn.utmify.com.br/scripts/pixel/pixel.js';
    a.setAttribute('data-utmify-pixel', '1');
    document.head.appendChild(a);
  }, []);

  useEffect(() => {
    const already =
      document.querySelector('script[data-utmify-utms]') ||
      document.querySelector('script[src*="cdn.utmify.com.br/scripts/utms"]');
    if (already) return;
    const s = document.createElement('script');
    s.src = 'https://cdn.utmify.com.br/scripts/utms/latest.js';
    s.async = true;
    s.defer = true;
    s.setAttribute('data-utmify-utms', '1');
    s.setAttribute('data-utmify-prevent-xcod-sck', '');
    s.setAttribute('data-utmify-prevent-subids', '');
    document.head.appendChild(s);
  }, []);

  // Ajuda o pixel em SPAs a “ver” mudanças de rota (URL com UTMs)
  useEffect(() => {
    window.pixelId = getPixelId();
    try {
      window.dispatchEvent(new Event('utmify_location_change'));
    } catch {
      /* ignore */
    }
  }, [location.pathname, location.search]);

  return null;
}
