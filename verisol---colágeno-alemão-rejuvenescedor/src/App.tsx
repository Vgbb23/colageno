/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams, Routes, Route } from 'react-router-dom';
import {
  CheckCircle2,
  ShieldCheck,
  Truck,
  CreditCard,
  XCircle,
  Sparkles,
  Beaker,
  MessageCircle,
  Zap,
  Droplets,
  Star,
  ChevronDown,
  ChevronUp,
  Clock,
  Users,
  Package,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Checkout from './components/Checkout';
import ThankYouPage from './components/ThankYouPage';
import { UtmifyScripts } from './components/UtmifyScripts';
import { CampaignUrlSync } from './components/CampaignUrlSync';
import { getUtmSearch, hasUtmParams, persistUtmSearch } from './utils/utm';

/** Kits disponíveis – usado na home e no checkout (leitura pela URL ?kit=1|2|3). */
const KITS = [
  { id: 1, name: 'Kit 1 Pote - Colágeno Verisol Nutrilibrium (Tratamento 30 dias)', price: 34.90, originalPrice: 97.00, image: 'https://i.ibb.co/LdjtrHdZ/image.png', quantity: 1 },
  { id: 2, name: 'Kit 2 Potes - Colágeno Verisol Nutrilibrium (Tratamento 60 dias)', price: 56.90, originalPrice: 194.00, image: 'https://i.ibb.co/FLpm6F8S/image.png', quantity: 1 },
  { id: 3, name: 'Kit 3 Potes - Colágeno Verisol Nutrilibrium (Tratamento 90 dias)', price: 78.90, originalPrice: 291.00, image: 'https://i.ibb.co/4w6gBxPc/image.png', quantity: 1 },
] as const;

// Colors based on the product image
const COLORS = {
  primary: '#8b4494', // Purple
  secondary: '#d4e157', // Yellow/Greenish
  accent: '#f3e5f5', // Light Purple
  dark: '#4a148c',
  white: '#ffffff',
  text: '#333333'
};

const FAQItem = ({ question, answer }: { question: string, answer: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className={`mb-4 rounded-2xl transition-all duration-300 ${isOpen ? 'bg-purple-50 shadow-sm border-purple-200' : 'bg-gray-50 border-transparent hover:bg-gray-100'} border`}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-5 text-left font-bold text-purple-900"
      >
        <span className="text-sm lg:text-base">{question}</span>
        <div className={`rounded-full p-1 transition-transform duration-300 ${isOpen ? 'bg-purple-200 rotate-180' : 'bg-gray-200'}`}>
          <ChevronDown className="h-4 w-4" />
        </div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">
              <p className="text-xs lg:text-sm text-gray-600 leading-relaxed border-t border-purple-100 pt-4">{answer}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/** Página de checkout: lê produto da URL (?kit=1|2|3) e mantém UTMs na mesma query. */
function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const kitId = searchParams.get('kit');
  const product = KITS.find((k) => k.id === Number(kitId));

  /** Garante ordem na barra de endereço: `kit` sempre primeiro (?kit=2&utm_...). */
  useEffect(() => {
    const raw = (location.search || '').replace(/^\?/, '');
    if (!raw) return;
    const p = new URLSearchParams(location.search);
    if (!p.has('kit')) return;
    const kitVal = p.get('kit');
    if (kitVal == null) return;
    p.delete('kit');
    const ordered = new URLSearchParams();
    ordered.set('kit', kitVal);
    p.forEach((v, k) => {
      ordered.set(k, v);
    });
    if (ordered.toString() !== raw) {
      navigate({ pathname: '/checkout', search: `?${ordered.toString()}` }, { replace: true });
    }
  }, [location.search, navigate]);

  const handleBack = () => {
    const params = new URLSearchParams(location.search);
    params.delete('kit');
    const qs = params.toString();
    navigate(qs ? `/?${qs}` : '/');
  };

  if (!product) {
    const params = new URLSearchParams(location.search);
    params.delete('kit');
    const qs = params.toString();
    navigate(qs ? `/?${qs}` : '/', { replace: true });
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <p className="text-gray-600">Redirecionando...</p>
      </div>
    );
  }

  return <Checkout onBack={handleBack} product={product} />;
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [viewers, setViewers] = useState(142);
  const [stock, setStock] = useState(12);
  const [showStickyCta, setShowStickyCta] = useState(false);
  const [recentPurchase, setRecentPurchase] = useState<{ name: string, city: string } | null>(null);
  const [timeLeft, setTimeLeft] = useState({ minutes: 14, seconds: 59 });

  // Só persistir UTMs no sessionStorage; não fazer replace na URL para não interferir no checkout
  useEffect(() => {
    const search = location.search || '';
    if (hasUtmParams(search)) persistUtmSearch(search);
  }, [location.search]);

  const utmSearch = getUtmSearch(location.search);

  /** Abre checkout com kit na URL: /checkout?kit=1&utm_... (kit sempre primeiro, depois demais params + UTMs da sessão se faltar). */
  const openCheckout = (product: (typeof KITS)[number]) => {
    const out = new URLSearchParams();
    out.set('kit', String(product.id));

    const rest = new URLSearchParams(location.search || '');
    rest.delete('kit');
    rest.forEach((v, k) => {
      out.set(k, v);
    });

    if (!hasUtmParams(location.search || '')) {
      const stored = getUtmSearch('');
      if (stored) {
        const q = stored.startsWith('?') ? stored.slice(1) : stored;
        new URLSearchParams(q).forEach((v, k) => {
          if (!out.has(k)) out.set(k, v);
        });
      }
    }

    navigate(`/checkout?${out.toString()}`);
    window.scrollTo(0, 0);
  };

  const purchases = [
    { name: 'Maria Silva', city: 'São Paulo, SP' },
    { name: 'Ana Oliveira', city: 'Rio de Janeiro, RJ' },
    { name: 'Cláudia Santos', city: 'Belo Horizonte, MG' },
    { name: 'Juliana Costa', city: 'Curitiba, PR' },
    { name: 'Patrícia Lima', city: 'Salvador, BA' }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { minutes: prev.minutes - 1, seconds: 59 };
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setViewers(prev => prev + (Math.random() > 0.5 ? 1 : -1));
    }, 5000);

    const purchaseInterval = setInterval(() => {
      const randomPurchase = purchases[Math.floor(Math.random() * purchases.length)];
      setRecentPurchase(randomPurchase);
      setTimeout(() => setRecentPurchase(null), 4000);
    }, 12000);

    const handleScroll = () => {
      // Show sticky CTA after scrolling 600px
      if (window.scrollY > 600) {
        setShowStickyCta(true);
      } else {
        setShowStickyCta(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      clearInterval(interval);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollToOffer = () => {
    document.getElementById('oferta')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <UtmifyScripts />
      <CampaignUrlSync />
      <Routes>
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/obrigado" element={<ThankYouPage />} />
      <Route path="/" element={
    <div className="min-h-screen bg-white font-sans text-gray-900 overflow-x-hidden">
      {/* Top Bar - Scarcity */}
      <div className="bg-red-600 py-2 text-center text-[10px] font-black text-white uppercase tracking-[0.2em] sticky top-0 z-50 shadow-md">
        <span className="flex items-center justify-center gap-2">
          <Clock className="h-3.5 w-3.5" /> OFERTA TERMINA EM: {String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
        </span>
      </div>

      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-[#8b4494] pt-6 pb-12 text-white">
        <div className="container mx-auto px-5">
          <div className="flex flex-col items-center">
            <div className="w-full text-center">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-block px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[9px] font-black uppercase tracking-[0.2em] mb-4"
              >
                ✨ Tecnologia Alemã Verisol®
              </motion.div>
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xl font-black leading-[1.1] tracking-tight"
              >
                O Segredo Alemão para uma Pele <span className="text-[#d4e157]">20 Anos Mais Jovem</span> e Sem Rugas
              </motion.h1>
              
              {/* Mobile Image - Centralized and prominent */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="relative z-10 my-6"
              >
                <img 
                  src="https://i.ibb.co/x8mj34ss/image.png" 
                  alt="Colágeno Verisol Nutrilibrium"
                  onError={(e) => {
                    e.currentTarget.src = "https://nutrilibrium.com.br/wp-content/uploads/2023/04/Colageno-Verisol-Nutrilibrium-Frutas-Vermelhas-200g.png";
                  }}
                  className="mx-auto w-full max-w-[340px] rounded-2xl shadow-2xl"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-0 right-0 rounded-xl bg-white p-2 text-[#4a148c] shadow-xl rotate-6 translate-x-2 -translate-y-2">
                  <div className="flex items-center gap-1 font-black text-[10px]">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span>4.9/5</span>
                  </div>
                </div>
              </motion.div>

              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-2 text-sm opacity-90 leading-relaxed font-medium"
              >
                Reduza rugas, recupere a firmeza da pele e fortaleça cabelos e unhas com apenas 2,5g por dia.
              </motion.p>

              <motion.ul 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-6 space-y-2 text-left w-full max-w-[280px] mx-auto"
              >
                {[
                  'Reduz rugas e linhas de expressão',
                  'Melhora firmeza e elasticidade',
                  'Fortalece cabelos e unhas',
                  'Pele mais hidratada e jovem'
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 bg-white/5 p-2.5 rounded-xl border border-white/10">
                    <CheckCircle2 className="h-4 w-4 text-[#d4e157] shrink-0" />
                    <span className="font-bold text-[11px] uppercase tracking-tight">{item}</span>
                  </li>
                ))}
              </motion.ul>

              <div className="mt-8">
                <button 
                  onClick={scrollToOffer}
                  className="w-full rounded-2xl bg-[#d4e157] px-6 py-4 text-base font-black text-[#4a148c] shadow-[0_10px_30px_rgba(212,225,87,0.4)] transition-transform active:scale-95 uppercase flex items-center justify-center gap-2 animate-bounce-subtle"
                >
                  QUERO MINHA PELE JOVEM <ArrowRight className="h-5 w-5" />
                </button>
                <div className="mt-6 flex flex-wrap justify-center gap-3 text-[9px] font-black uppercase opacity-60">
                  <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Compra segura</span>
                  <span className="flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> Envio Grátis</span>
                  <span className="flex items-center gap-1"><CreditCard className="h-3.5 w-3.5" /> Parcelado</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Bar - Mobile Optimized */}
      <div className="bg-purple-50 py-3 border-y border-purple-100">
        <div className="container mx-auto px-4 flex flex-col items-center gap-2 text-[11px] font-bold text-purple-800 uppercase tracking-wider">
          <span className="flex items-center gap-2"><Users className="h-4 w-4 text-purple-400" /> {viewers} pessoas vendo agora</span>
          <div className="h-1 w-full max-w-[200px] bg-gray-200 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: '100%' }}
              animate={{ width: '15%' }}
              transition={{ duration: 2, ease: "easeOut" }}
              className="h-full bg-red-500"
            />
          </div>
          <span className="text-red-600">Apenas {stock} unidades restantes</span>
        </div>
      </div>

      {/* 2. PROBLEMA - Mobile Optimized */}
      <section className="py-16 px-5">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-2xl font-black text-purple-900 leading-tight">
            Por Que Sua Pele Envelhece Mesmo Usando Cremes Caríssimos?
          </h2>
          <div className="mt-8 text-base text-gray-700 space-y-5">
            <p>Após os 25 anos, o corpo começa a perder colágeno naturalmente.</p>
            <div className="bg-purple-900 text-white p-6 rounded-2xl shadow-xl">
              <p className="font-black text-2xl text-[#d4e157]">Cai até 50%</p>
              <p className="text-sm font-bold uppercase mt-1">A produção aos 40 anos</p>
            </div>
            <p className="font-medium">Isso causa rugas, flacidez, pele sem brilho e unhas quebradiças.</p>
            <div className="bg-red-50 p-6 rounded-2xl border border-red-100 mt-8">
              <p className="text-lg font-black text-red-700 uppercase tracking-tight">O Erro Fatal:</p>
              <p className="mt-2 text-sm leading-relaxed">A maioria dos cremes age apenas na <strong>superfície</strong>, ignorando onde o envelhecimento realmente acontece.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. QUEBRA DE CRENÇA - Mobile Optimized */}
      <section className="py-16 bg-purple-900 text-white px-5">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-2xl font-black leading-tight">
            O Erro Que 90% Das Mulheres Cometem
          </h2>
          <div className="mt-10 space-y-4">
            {[
              'Cremes Caros',
              'Tratamentos Superficiais',
              'Maquiagem para Esconder'
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-center gap-4 bg-white/10 p-4 rounded-xl border border-white/20">
                <span className="font-bold text-sm uppercase">{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-10 space-y-4">
            <p className="text-lg opacity-80">A pele não envelhece apenas por fora.</p>
            <p className="text-[#d4e157] font-black text-2xl uppercase leading-none">Ela envelhece de dentro para fora.</p>
            <p className="text-lg font-bold">E o Verisol é a única solução real.</p>
          </div>
        </div>
      </section>

      {/* 4. APRESENTAÇÃO DO PRODUTO */}
      <section className="py-16 px-5 bg-white">
        <div className="container mx-auto">
          <div className="flex flex-col items-center gap-10">
            <div className="w-full">
              <img 
                src="https://i.ibb.co/67JT8THd/image.png" 
                alt="Benefícios Verisol" 
                onError={(e) => {
                  e.currentTarget.src = "https://nutrilibrium.com.br/wp-content/uploads/2023/04/Colageno-Verisol-Nutrilibrium-Frutas-Vermelhas-200g.png";
                }}
                className="mx-auto w-full max-w-md rounded-3xl shadow-2xl"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-black text-purple-900">Tecnologia Que Transforma</h2>
              <div className="mt-6 text-sm text-gray-700 space-y-4 leading-relaxed">
                <p>
                  O <strong>Verisol®</strong> é um colágeno hidrolisado com peptídeos bioativos específicos, desenvolvido na Alemanha para agir na <strong>derme</strong>.
                </p>
                <div className="grid grid-cols-1 gap-3 mt-8">
                  {[
                    { icon: <Sparkles className="h-5 w-5" />, text: 'Pele mais firme' },
                    { icon: <Zap className="h-5 w-5" />, text: 'Redução de rugas' },
                    { icon: <Droplets className="h-5 w-5" />, text: 'Hidratação profunda' },
                    { icon: <CheckCircle2 className="h-5 w-5" />, text: 'Unhas e cabelos fortes' }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 bg-purple-50 p-4 rounded-xl border border-purple-100 text-left">
                      <span className="text-[#8b4494]">{item.icon}</span>
                      <span className="font-bold text-purple-900">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. COMO FUNCIONA - Mobile Optimized */}
      <section className="py-16 bg-purple-50 px-5">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl font-black text-purple-900 mb-10">Como Atua no Seu Corpo</h2>
          <div className="space-y-6">
            {[
              { 
                step: '01', 
                title: 'Absorção Rápida', 
                desc: 'Peptídeos minúsculos são absorvidos instantaneamente.' 
              },
              { 
                step: '02', 
                title: 'Sinalização Celular', 
                desc: 'Estimula a produção natural de colágeno novo.' 
              },
              { 
                step: '03', 
                title: 'Regeneração', 
                desc: 'A pele recupera firmeza e elasticidade real.' 
              }
            ].map((item, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-purple-100 flex items-start gap-4 text-left">
                <span className="text-3xl font-black text-purple-200 leading-none">{item.step}</span>
                <div>
                  <h3 className="text-lg font-bold text-purple-900 mb-1">{item.title}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. BENEFÍCIOS - Mobile Optimized */}
      <section className="py-16 bg-[#8b4494] text-white px-5">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl font-black mb-10">O Que Você Vai Sentir</h2>
          <div className="grid grid-cols-1 gap-4">
            {[
              'Redução visível de rugas',
              'Pele muito mais firme',
              'Hidratação e brilho real',
              'Unhas muito mais fortes',
              'Cabelos saudáveis',
              'Aparência 10 anos mais jovem'
            ].map((benefit, i) => (
              <div key={i} className="flex items-center gap-3 bg-white/10 p-4 rounded-xl border border-white/20 text-left">
                <CheckCircle2 className="h-5 w-5 text-[#d4e157] shrink-0" />
                <span className="text-sm font-bold uppercase tracking-tight">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. PROVA CIENTÍFICA - Mobile Optimized */}
      <section className="py-16 px-5">
        <div className="container mx-auto text-center">
          <div className="inline-block p-1.5 px-3 bg-purple-100 text-purple-700 rounded-full text-[10px] font-black mb-6 uppercase tracking-widest">
            Comprovação Científica
          </div>
          <h2 className="text-2xl font-black text-purple-900 mb-8">Estudos Clínicos Comprovam</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              {[
                { val: '20%', label: 'Menos Rugas' },
                { val: '65%', label: 'Mais Colágeno' },
                { val: '18%', label: 'Mais Elasticidade' }
              ].map((stat, i) => (
                <div key={i} className="p-5 bg-purple-50 rounded-2xl flex items-center justify-between px-8">
                  <p className="text-sm font-black uppercase text-purple-900">{stat.label}</p>
                  <p className="text-3xl font-black text-purple-600">{stat.val}</p>
                </div>
              ))}
            </div>
            <p className="text-xs italic text-gray-400 mt-6">Resultados entre 4 e 8 semanas de uso.</p>
          </div>
        </div>
      </section>

      {/* 8. INGREDIENTES - Mobile Optimized */}
      <section className="py-16 bg-gray-50 px-5">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl font-black text-purple-900 mb-4">Fórmula Premium</h2>
          <p className="text-xs text-gray-500 mb-10 uppercase font-bold tracking-widest">Ingredientes Selecionados</p>
          
          <div className="space-y-4 mb-12">
            {[
              { title: 'Verisol®', desc: 'Peptídeos bioativos alemães.' },
              { title: 'Vitamina C', desc: 'Estimula a produção natural.' },
              { title: 'Biotina', desc: 'A vitamina da beleza.' },
              { title: 'Zinco', desc: 'Ação regeneradora celular.' },
              { title: 'Vitamina E', desc: 'Proteção antienvelhecimento.' },
              { title: 'Ácido Hialurônico', desc: 'Preenchimento e hidratação.' }
            ].map((ing, i) => (
              <div key={i} className="bg-white p-5 rounded-2xl shadow-sm text-left border-l-4 border-[#8b4494]">
                <h3 className="text-base font-black text-purple-900 mb-1">{ing.title}</h3>
                <p className="text-xs text-gray-500">{ing.desc}</p>
              </div>
            ))}
          </div>

          {/* Nutritional Info Image */}
          <div className="bg-white p-4 rounded-3xl shadow-xl border border-purple-100">
            <h3 className="text-sm font-black text-purple-900 mb-6 uppercase tracking-widest">Tabela Nutricional</h3>
            <img 
              src="https://i.ibb.co/5WyFJJb3/image.png" 
              alt="Informação Nutricional" 
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
              className="w-full h-auto rounded-xl"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </section>

      {/* 9. DEPOIMENTOS - Mobile Optimized */}
      <section className="py-16 px-5">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl font-black text-purple-900 mb-10">O Que Elas Dizem</h2>
          <div className="space-y-6">
            {[
              { name: 'Mariana S.', text: 'Minha pele ficou muito mais firme depois de 1 mês. Sinto meu rosto mais "esticado" e hidratado.' },
              { name: 'Carla R.', text: 'Minhas unhas pararam de quebrar e meu cabelo ficou visivelmente mais forte.' }
            ].map((dep, i) => (
              <div key={i} className="bg-purple-50 p-6 rounded-2xl text-left border border-purple-100">
                <div className="flex text-yellow-500 mb-3 scale-75 origin-left">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 fill-current" />)}
                </div>
                <p className="text-sm text-gray-700 italic mb-4 leading-relaxed">"{dep.text}"</p>
                <p className="text-xs font-black text-purple-900 uppercase tracking-wider">— {dep.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 10. OFERTA - Mobile Optimized */}
      <section id="oferta" className="py-16 bg-purple-900 text-white px-5">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl font-black mb-2">Recupere Sua Beleza</h2>
          <p className="text-sm text-purple-200 mb-10 uppercase font-bold tracking-widest">Frete Grátis Hoje</p>
          
          <div className="space-y-8">
            {/* Kit 1 */}
            <div className="bg-white text-gray-900 rounded-3xl p-6 flex flex-col border border-purple-100">
              <h3 className="text-xl font-black text-purple-900">1 Pote</h3>
              <p className="text-xs text-gray-400 font-bold uppercase mb-4">Tratamento 30 dias</p>
              <img src="https://i.ibb.co/LdjtrHdZ/image.png" alt="1 Pote" className="h-32 object-contain mx-auto mb-4" referrerPolicy="no-referrer" />
              <div className="mt-auto">
                <p className="text-xs text-gray-400 line-through font-bold">R$ 97,00</p>
                <p className="text-3xl font-black text-purple-900">R$ 34,90</p>
                <p className="text-sm font-black text-purple-600 mb-6">Tratamento para 1 mês</p>
                <button 
                  onClick={() => openCheckout(KITS[0])}
                  className="w-full bg-[#8b4494] text-white font-black py-4 rounded-2xl uppercase text-sm tracking-wider"
                >
                  COMPRAR AGORA
                </button>
              </div>
            </div>

            {/* Kit 2 */}
            <div className="bg-white text-gray-900 rounded-3xl p-6 flex flex-col border border-purple-100">
              <h3 className="text-xl font-black text-purple-900">2 Potes</h3>
              <p className="text-xs text-gray-400 font-bold uppercase mb-4">Tratamento 60 dias</p>
              <img src="https://i.ibb.co/FLpm6F8S/image.png" alt="2 Potes" className="h-32 object-contain mx-auto mb-4" referrerPolicy="no-referrer" />
              <div className="mt-auto">
                <p className="text-xs text-gray-400 line-through font-bold">R$ 194,00</p>
                <p className="text-3xl font-black text-purple-900">R$ 56,90</p>
                <p className="text-sm font-black text-purple-600 mb-6">Tratamento para 2 meses</p>
                <button 
                  onClick={() => openCheckout(KITS[1])}
                  className="w-full bg-[#8b4494] text-white font-black py-4 rounded-2xl uppercase text-sm tracking-wider"
                >
                  COMPRAR AGORA
                </button>
              </div>
            </div>

            {/* Kit 3 - Destaque no Mobile */}
            <div className="bg-white text-gray-900 rounded-3xl p-6 flex flex-col border-4 border-[#d4e157] relative shadow-2xl">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#d4e157] text-[#4a148c] px-6 py-1 rounded-full font-black text-[10px] uppercase tracking-widest">Mais Vendido</div>
              <h3 className="text-xl font-black text-purple-900">3 Potes</h3>
              <p className="text-xs text-gray-400 font-bold uppercase mb-4">Tratamento 90 dias</p>
              <img src="https://i.ibb.co/4w6gBxPc/image.png" alt="3 Potes" className="h-32 object-contain mx-auto mb-4" referrerPolicy="no-referrer" />
              <div className="mt-auto">
                <p className="text-xs text-gray-400 line-through font-bold">R$ 291,00</p>
                <p className="text-4xl font-black text-purple-900">R$ 78,90</p>
                <p className="text-sm font-black text-purple-600 mb-6">Tratamento para 3 meses</p>
                <button 
                  onClick={() => openCheckout(KITS[2])}
                  className="w-full bg-[#d4e157] text-[#4a148c] font-black py-5 rounded-2xl hover:bg-[#c5d14a] transition-colors shadow-lg uppercase text-sm tracking-wider flex flex-col items-center leading-none"
                >
                  <span>COMPRAR AGORA</span>
                  <span className="text-[9px] mt-1 opacity-70">Site Seguro e Criptografado</span>
                </button>
                <p className="mt-4 text-[10px] font-black text-green-600 uppercase tracking-widest flex items-center justify-center gap-1">
                  <Truck className="h-3 w-3" /> Frete Grátis Ativado
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 11. GARANTIA - Mobile Optimized */}
      <section className="py-16 px-5">
        <div className="container mx-auto">
          <div className="bg-gray-50 rounded-3xl p-8 flex flex-col items-center text-center border border-gray-200">
            <img 
              src="https://i.ibb.co/DDwtb2y9/image.png" 
              alt="Garantia" 
              className="w-48 h-auto mb-6"
              referrerPolicy="no-referrer"
            />
            <h2 className="text-xl font-black text-purple-900 mb-4 uppercase tracking-tight">Garantia de 30 Dias</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Se não gostar, devolvemos 100% do seu dinheiro. Sem perguntas, sem burocracia. Risco Zero para você.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ - Mobile Optimized */}
      <section className="py-16 bg-white px-5">
        <div className="container mx-auto max-w-2xl">
          <h2 className="text-2xl font-black text-purple-900 text-center mb-4">Dúvidas Frequentes</h2>
          <p className="text-center text-xs text-gray-500 mb-10 uppercase font-bold tracking-widest">Tudo o que você precisa saber</p>
          
          <div className="space-y-1">
            <FAQItem 
              question="O que é o Verisol?" 
              answer="O Verisol é um colágeno alemão de alta tecnologia composto por peptídeos bioativos que agem diretamente na derme, a camada mais profunda da pele, reduzindo rugas e combatendo a flacidez de dentro para fora." 
            />
            <FAQItem 
              question="Quanto tempo para ver os resultados?" 
              answer="Os primeiros resultados podem ser notados a partir de 4 semanas de uso contínuo, com melhora visível na elasticidade da pele e redução de linhas finas." 
            />
            <FAQItem 
              question="Como devo tomar?" 
              answer="Recomenda-se a ingestão de 2,5g (uma colher de medida) por dia, diluído em 200ml de água ou na bebida de sua preferência. Pode ser tomado a qualquer hora do dia." 
            />
            <FAQItem 
              question="Grávidas ou lactantes podem tomar?" 
              answer="Por ser um produto natural, não há contraindicações graves, porém recomendamos sempre consultar seu médico antes de iniciar qualquer suplementação durante a gravidez ou amamentação." 
            />
            <FAQItem 
              question="O produto engorda?" 
              answer="Não. Nossa fórmula é livre de açúcares, gorduras e possui baixíssimo valor calórico, não interferindo no peso corporal." 
            />
            <FAQItem 
              question="Qual o prazo de entrega?" 
              answer="O prazo médio de entrega é de 5 a 10 dias úteis, dependendo da sua região. O frete é grátis para todo o Brasil hoje!" 
            />
            <FAQItem 
              question="Como funciona a garantia?" 
              answer="Oferecemos 30 dias de garantia incondicional. Se por qualquer motivo você não ficar satisfeita, basta nos enviar um e-mail e devolvemos 100% do seu investimento." 
            />
            <FAQItem 
              question="É aprovado pela ANVISA?" 
              answer="Sim, nosso produto é fabricado em laboratórios certificados e segue todas as normas e exigências da ANVISA." 
            />
          </div>
        </div>
      </section>

      {/* 13. CTA FINAL - Mobile Optimized */}
      <section className="py-16 bg-purple-50 px-5 pb-24">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl font-black text-purple-900 mb-4">Sua Pele Merece</h2>
          <p className="text-sm text-gray-600 mb-10 leading-relaxed">
            Recupere sua autoestima e sinta-se jovem novamente com a tecnologia alemã.
          </p>
          <button 
            onClick={scrollToOffer}
            className="w-full rounded-2xl bg-[#8b4494] px-8 py-5 text-lg font-black text-white shadow-xl uppercase tracking-wider"
          >
            QUERO EXPERIMENTAR AGORA
          </button>
          
          <div className="mt-12 flex flex-wrap justify-center gap-6 opacity-40 grayscale scale-75">
            <img src="https://logodownload.org/wp-content/uploads/2017/10/anvisa-logo.png" alt="Anvisa" className="h-10 object-contain" referrerPolicy="no-referrer" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Logo_da_Nutrilibrium.png/1200px-Logo_da_Nutrilibrium.png" alt="Nutrilibrium" className="h-10 object-contain" referrerPolicy="no-referrer" />
          </div>
        </div>
      </section>

      {/* Sticky Mobile CTA */}
      <AnimatePresence>
        {showStickyCta && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 z-[100] p-4 bg-white/90 backdrop-blur-xl border-t border-purple-100 lg:hidden shadow-[0_-10px_30px_rgba(0,0,0,0.1)]"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[9px] font-black text-red-600 uppercase animate-pulse">🔥 Apenas {stock} unidades restantes</span>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter flex items-center gap-1"><Users className="h-3 w-3" /> {viewers} pessoas vendo</span>
              </div>
              <button 
                onClick={scrollToOffer}
                className="w-full bg-[#d4e157] text-[#4a148c] font-black py-4 rounded-2xl shadow-[0_10px_20px_rgba(212,225,87,0.3)] uppercase text-sm tracking-widest flex items-center justify-center gap-2"
              >
                <Zap className="h-4 w-4 fill-current" /> QUERO MINHA PELE JOVEM
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent Purchase Notification */}
      <AnimatePresence>
        {recentPurchase && (
          <motion.div 
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -100, opacity: 0 }}
            className="fixed bottom-24 left-4 z-[110] bg-white p-3 rounded-xl shadow-2xl border border-purple-100 flex items-center gap-3 max-w-[220px] lg:bottom-8 lg:left-8"
          >
            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
              <Package className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-[10px] font-black text-purple-900 leading-tight">{recentPurchase.name}</p>
              <p className="text-[9px] text-gray-500">{recentPurchase.city}</p>
              <p className="text-[8px] font-bold text-green-600 uppercase mt-0.5">Acabou de comprar!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-purple-900 py-12 text-center text-purple-300 text-[10px] uppercase font-bold tracking-widest px-5">
        <div className="container mx-auto">
          <p>© 2026 Nutrilibrium</p>
          <p className="mt-2 opacity-50">CNPJ: 00.000.000/0001-00</p>
          <div className="mt-6 flex justify-center gap-6">
            <a href="#" className="hover:text-white">Termos</a>
            <a href="#" className="hover:text-white">Privacidade</a>
          </div>
        </div>
      </footer>
    </div>
      } />
      </Routes>
    </>
  );
}

