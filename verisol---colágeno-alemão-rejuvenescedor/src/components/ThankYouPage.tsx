/**
 * Página de obrigado — só acessível após a API confirmar pagamento (token em sessionStorage).
 * Parâmetros da URL (campanha/UTMs) permanecem na barra de endereço.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, Package, ArrowRight, Heart } from 'lucide-react';
import { motion } from 'motion/react';
import { hasUtmParams, persistUtmSearch } from '../utils/utm';
import { clearObrigadoUnlock, isObrigadoUnlockValid, mergeStoredQueryParams } from '../utils/campaignQuery';

export default function ThankYouPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [allowed, setAllowed] = useState(false);

  const homeQs = mergeStoredQueryParams(location.search || '');
  const homeHref = homeQs ? `/?${homeQs}` : '/';

  useEffect(() => {
    if (!isObrigadoUnlockValid()) {
      navigate(homeHref, { replace: true });
      return;
    }
    setAllowed(true);
    const s = location.search || '';
    if (hasUtmParams(s)) persistUtmSearch(s);
  }, [location.search, navigate, homeHref]);

  const handleGoHome = () => {
    clearObrigadoUnlock();
    navigate(homeHref);
  };

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-purple-950 text-purple-200 text-sm">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-[#6b3a73] to-purple-950 text-white flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-16 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 12 }}
          className="mb-8"
        >
          <div className="h-24 w-24 rounded-full bg-[#d4e157] flex items-center justify-center shadow-lg shadow-[#d4e157]/30 mx-auto">
            <CheckCircle2 className="h-14 w-14 text-[#4a148c]" strokeWidth={2.5} />
          </div>
        </motion.div>

        <motion.h1
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-3xl font-black tracking-tight mb-3"
        >
          Obrigado pela sua compra!
        </motion.h1>
        <motion.p
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-purple-100 text-sm max-w-md leading-relaxed mb-2"
        >
          Seu pagamento foi confirmado. Em breve você receberá as informações de envio no e-mail cadastrado.
        </motion.p>
        <motion.p
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-purple-200/80 text-xs max-w-sm mb-10 flex items-center justify-center gap-1.5"
        >
          <Heart className="h-3.5 w-3.5 text-[#d4e157] fill-[#d4e157]" />
          Agradecemos a confiança na Nutrilibrium.
        </motion.p>

        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="flex flex-col sm:flex-row gap-3 w-full max-w-sm"
        >
          <button
            type="button"
            onClick={handleGoHome}
            className="flex-1 flex items-center justify-center gap-2 bg-[#d4e157] text-[#4a148c] font-black py-4 rounded-2xl uppercase text-xs tracking-wider shadow-lg hover:brightness-105 active:scale-[0.98] transition-all"
          >
            Voltar ao início
            <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-14 flex items-center gap-2 text-purple-300/60 text-[10px] font-bold uppercase tracking-widest"
        >
          <Package className="h-4 w-4" />
          Pedido em separação
        </motion.div>
      </div>
    </div>
  );
}
