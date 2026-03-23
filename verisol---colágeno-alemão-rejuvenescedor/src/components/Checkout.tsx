import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ShieldCheck, 
  Lock, 
  Truck, 
  CreditCard, 
  ChevronLeft, 
  Plus, 
  Minus, 
  CheckCircle2, 
  Copy,
  Info,
  Star,
  Clock,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { buildObrigadoQueryString, collectUtmParamsFromSearch } from '../utils/utm';
import { setObrigadoUnlock } from '../utils/campaignQuery';
import {
  encodeUpsellCustomerPrefill,
  isFruitfyOrderPaid,
  normalizePhoneForUpsell,
} from '../utils/postPaymentRedirect';

interface Product {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  quantity?: number;
}

interface CheckoutProps {
  onBack: () => void;
  product: Product;
}

type PixResult = { pixCopyPaste: string; orderId?: string; qrCodeImage?: string | null };

/** Formatação visual apenas; a API continua recebendo só dígitos. */
function formatCpfDisplay(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatPhoneDisplay(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function formatCepDisplay(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function isValidCpf(cpfDigits: string): boolean {
  const cpf = cpfDigits.replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(cpf[i]) * (10 - i);
  let check = (sum * 10) % 11;
  if (check === 10) check = 0;
  if (check !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(cpf[i]) * (11 - i);
  check = (sum * 10) % 11;
  if (check === 10) check = 0;
  return check === Number(cpf[10]);
}

export default function Checkout({ onBack, product }: CheckoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [quantity, setQuantity] = useState(product.quantity || 1);
  const [timeLeft, setTimeLeft] = useState({ minutes: 9, seconds: 59 });
  const [cep, setCep] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [cpfTouched, setCpfTouched] = useState(false);
  const [cepTouched, setCepTouched] = useState(false);
  const [cepApiInvalid, setCepApiInvalid] = useState(false);
  const [pixResult, setPixResult] = useState<PixResult | null>(null);
  const [pixError, setPixError] = useState<string | null>(null);
  const [pixDebugResponse, setPixDebugResponse] = useState<unknown>(null);
  const [loadingPix, setLoadingPix] = useState(false);
  const [address, setAddress] = useState({
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: ''
  });
  const [shipping, setShipping] = useState<'free' | 'sedex' | null>(null);
  const [loadingCep, setLoadingCep] = useState(false);
  const orderIdForRedirect = pixResult?.orderId != null ? String(pixResult.orderId) : '';
  const cpfDigits = cpf.replace(/\D/g, '');
  const cepDigits = cep.replace(/\D/g, '');
  const cpfInvalid = cpfTouched && cpfDigits.length > 0 && !isValidCpf(cpfDigits);
  const cepInvalidLength = cepTouched && cepDigits.length > 0 && cepDigits.length !== 8;
  const cepInvalid = cepInvalidLength || (cepTouched && cepApiInvalid);

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

  const shippingPrice = shipping === 'sedex' ? 19.54 : 0;
  const total = (product.price * quantity) + shippingPrice;

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(formatCpfDisplay(e.target.value));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneDisplay(e.target.value));
  };

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 8);
    setCep(formatCepDisplay(value));
    setCepApiInvalid(false);

    if (value.length === 8) {
      setLoadingCep(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${value}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setAddress(prev => ({
            ...prev,
            street: data.logradouro,
            neighborhood: data.bairro,
            city: data.localidade,
            state: data.uf
          }));
          // Default to free shipping when CEP is found
          if (!shipping) setShipping('free');
        } else {
          setCepApiInvalid(true);
        }
      } catch (error) {
        console.error("Erro ao buscar CEP", error);
        setCepApiInvalid(true);
      } finally {
        setLoadingCep(false);
      }
    }
  };

  /** Busca profunda: coleta todas as strings do objeto (resposta da API). */
  function collectAllStrings(obj: unknown, out: string[] = []): string[] {
    if (obj == null) return out;
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

  function normalizePix(s: string): string {
    return String(s).replace(/\s/g, '').trim();
  }

  function looksLikePixCode(s: string): boolean {
    const t = String(s).trim().replace(/\s/g, '');
    return t.length >= 20 && t.length <= 2000 && /^00020\d/.test(t);
  }

  /** Extrai ou valida código PIX; aceita formato com pontos, barras e espaços (ex.: Fruitfy). */
  function extractPixFromString(s: string): string | null {
    const t = String(s).trim();
    const normalized = normalizePix(t);
    if (normalized.length >= 20 && normalized.length <= 2000 && /^00020\d/.test(normalized)) {
      return normalized;
    }
    const match = normalized.match(/00020\d[\dA-Za-z.\/-]{20,1500}/);
    return match ? match[0] : null;
  }

  /** Percorre objeto e retorna a primeira string que pareça código PIX (qualquer chave). */
  function findPixInObject(obj: unknown): string {
    if (obj == null) return '';
    if (typeof obj === 'string') {
      const ex = extractPixFromString(obj);
      return ex ?? '';
    }
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = findPixInObject(item);
        if (found) return found;
      }
      return '';
    }
    if (typeof obj === 'object') {
      const rec = obj as Record<string, unknown>;
      for (const v of Object.values(rec)) {
        const found = findPixInObject(v);
        if (found) return found;
      }
    }
    return '';
  }

  function getPixCopyPasteFromResponse(data: unknown): string {
    const d = data as Record<string, unknown>;
    const inner = d?.data as Record<string, unknown> | undefined;
    const nested = inner?.data as Record<string, unknown> | undefined;
    const pixObj = (inner?.pix ?? nested?.pix) as Record<string, unknown> | undefined;
    if (pixObj && typeof pixObj.code === 'string' && pixObj.code.trim().length > 0) {
      const raw = String(pixObj.code).trim();
      if (/^00020\d/.test(raw.replace(/\s/g, ''))) return raw;
      const ex = extractPixFromString(pixObj.code);
      if (ex) return ex;
    }
    const order = (inner?.order ?? nested?.order) as Record<string, unknown> | undefined;
    const pix = pixObj;
    const byKeys =
      (pixObj?.code as string) ??
      (nested?.pix_copy_paste as string) ??
      (nested?.brcode as string) ??
      (nested?.copy_paste as string) ??
      (inner?.pix_copy_paste as string) ??
      (inner?.brcode as string) ??
      (order?.pix_copy_paste as string) ??
      (order?.brcode as string) ??
      (pix?.copy_paste as string) ??
      (pix?.brcode as string) ??
      (d?.pix_copy_paste as string) ??
      (d?.brcode as string) ??
      '';
    if (byKeys && looksLikePixCode(byKeys)) return byKeys.trim();
    const fromByKeys = byKeys ? extractPixFromString(byKeys) : null;
    if (fromByKeys) return fromByKeys;
    const fromRecurse = findPixInObject(data);
    if (fromRecurse) return fromRecurse;
    const all = collectAllStrings(data);
    for (const str of all) {
      const extracted = extractPixFromString(str);
      if (extracted) return extracted;
    }
    const candidates = all.filter(looksLikePixCode).map((s) => normalizePix(s));
    const prefer = (a: string, b: string) => (/^00020\d/.test(b) ? 1 : 0) - (/^00020\d/.test(a) ? 1 : 0);
    candidates.sort(prefer);
    return candidates[0] ?? '';
  }

  function getQrCodeImageFromResponse(data: unknown): string | null {
    const d = data as Record<string, unknown>;
    const inner = d?.data as Record<string, unknown> | undefined;
    const nested = inner?.data as Record<string, unknown> | undefined;
    const pix = (inner?.pix ?? nested?.pix) as Record<string, unknown> | undefined;
    if (pix && typeof pix.qr_code_base64 === 'string' && pix.qr_code_base64.startsWith('data:')) {
      return pix.qr_code_base64;
    }
    const qr = (inner?.qr_code ?? nested?.qr_code ?? inner?.qr_code_base64 ?? nested?.qr_code_base64) as string | undefined;
    return qr && typeof qr === 'string' ? qr : null;
  }

  const handleFinalize = async () => {
    setPixError(null);
    setPixDebugResponse(null);
    const nameTrim = name.trim();
    const emailTrim = email.trim();
    const cpfOnly = cpfDigits;
    const phoneOnly = phone.replace(/\D/g, '');
    const cpfIsValid = isValidCpf(cpfOnly);
    const cepIsValid = cepDigits.length === 8 && !cepApiInvalid;
    setCpfTouched(true);
    setCepTouched(true);
    if (!nameTrim || !emailTrim || !cpfIsValid || !phoneOnly || !cepIsValid) {
      setPixError('Revise os campos obrigatórios: CPF e CEP precisam ser válidos.');
      return;
    }
    setLoadingPix(true);
    try {
      const amountCentavos = Math.round(total * 100);
      const apiBase = ((import.meta.env.VITE_API_URL as string) || '').replace(/\/$/, '');
      const url = apiBase ? `${apiBase}/api/create-pix` : '/api/create-pix';
      const utm = collectUtmParamsFromSearch(location.search || '');
      const payload: Record<string, unknown> = {
        name: nameTrim,
        email: emailTrim,
        cpf: cpfOnly,
        phone: phoneOnly,
        amount: amountCentavos,
      };
      payload.utm = utm;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 404) {
        setPixError('Servidor da API não encontrado (404). Rode "npm run dev:all" ou, em outro terminal, "npm run dev:server".');
        return;
      }
      let json: Record<string, unknown>;
      try {
        json = await res.json();
      } catch {
        setPixError(res.ok ? 'Resposta inválida da API.' : `Erro ${res.status}. O servidor da API está rodando? (npm run dev:server)`);
        return;
      }
      if (!res.ok) {
        setPixError((json?.message as string) || 'Erro ao gerar PIX. Tente novamente.');
        return;
      }
      if (import.meta.env.DEV) {
        console.log('Resposta API create-pix:', json);
      }
      // Backend já envia pixCopyPaste normalizado; fallback para extração no front
      const pixCopyPaste =
        (json?.pixCopyPaste && String(json.pixCopyPaste).trim()) ||
        getPixCopyPasteFromResponse(json);
      if (!pixCopyPaste) {
        if (import.meta.env.DEV && json?.data) {
          console.warn('Estrutura data (Fruitfy):', json.data);
        }
        setPixDebugResponse(json);
        setPixError('Resposta do gateway sem código PIX. Contate o suporte.');
        return;
      }
      const orderId = json?.orderId ?? (json?.data as Record<string, unknown>)?.order_id;
      const qrCodeImage = json?.qrCodeImage ?? getQrCodeImageFromResponse(json);
      setPixResult({ pixCopyPaste, orderId, qrCodeImage });
      setStep('success');
      window.scrollTo(0, 0);
    } catch {
      setPixError('Falha de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setLoadingPix(false);
    }
  };

  const goObrigado = useCallback(() => {
    if (orderIdForRedirect) setObrigadoUnlock(orderIdForRedirect);
    const qs = buildObrigadoQueryString(location.search);
    navigate(qs ? `/obrigado?${qs}` : '/obrigado');
  }, [orderIdForRedirect, location.search, navigate]);

  if (step === 'success' && pixResult) {
    return (
      <SuccessScreen
        total={total}
        pixCopyPaste={pixResult.pixCopyPaste}
        orderId={pixResult.orderId}
        onBack={onBack}
        onPaidConfirmed={goObrigado}
        utmSearch={location.search || ''}
        redirectName={name.trim()}
        redirectEmail={email.trim()}
        redirectPhone={phone}
        redirectCpfDigits={cpfDigits}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Checkout Header */}
      <header className="bg-white border-b border-gray-200 py-4 px-5 sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between max-w-4xl">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronLeft className="h-6 w-6 text-gray-600" />
          </button>
          <div className="flex flex-col items-center">
            <h1 className="text-lg font-black text-purple-900 leading-none tracking-tighter">NUTRILIBRIUM</h1>
            <span className="text-[10px] text-green-600 font-bold flex items-center gap-1 mt-1">
              <Lock className="h-3 w-3" /> AMBIENTE 100% SEGURO
            </span>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-black text-red-600 uppercase tracking-tighter">Expira em</div>
            <div className="text-sm font-black text-red-600 leading-none">
              {String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-xl px-5 py-8 space-y-6">
        {/* Step Indicator */}
        <div className="flex justify-between items-center px-4 mb-2">
          <Step num={1} label="Identificação" active />
          <div className="h-px bg-gray-200 flex-1 mx-2 mt-[-10px]"></div>
          <Step num={2} label="Entrega" active={cep.replace(/\D/g, '').length > 0} />
          <div className="h-px bg-gray-200 flex-1 mx-2 mt-[-10px]"></div>
          <Step num={3} label="Pagamento" active={!!shipping} />
        </div>
        {/* Product Summary */}
        <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex gap-4">
            <div className="h-24 w-24 bg-gray-100 rounded-xl overflow-hidden shrink-0 border border-gray-50">
              <img src={product.image} alt={product.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="flex flex-col justify-between py-1 flex-1">
              <div>
                <h2 className="text-sm font-bold text-gray-800 leading-tight mb-1">{product.name}</h2>
                <div className="flex items-center gap-2">
                  <p className="text-purple-600 font-black text-lg">R$ {(product.price * quantity).toFixed(2).replace('.', ',')}</p>
                  {product.originalPrice && (
                    <p className="text-xs text-gray-400 line-through">R$ {(product.originalPrice * quantity).toFixed(2).replace('.', ',')}</p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center bg-gray-100 rounded-lg p-1">
                  <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="p-1 hover:bg-white rounded-md transition-colors"
                  >
                    <Minus className="h-4 w-4 text-gray-600" />
                  </button>
                  <span className="px-4 text-sm font-bold text-gray-800">{quantity}</span>
                  <button 
                    onClick={() => setQuantity(quantity + 1)}
                    className="p-1 hover:bg-white rounded-md transition-colors"
                  >
                    <Plus className="h-4 w-4 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Personal Data */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-purple-600" />
            </div>
            <h3 className="font-black text-purple-900 uppercase text-sm tracking-wider">Dados Pessoais</h3>
          </div>
          
          <div className="space-y-3">
            <Input label="Nome Completo" placeholder="Ex: Maria Silva" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="E-mail" type="email" placeholder="Ex: maria@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Input
                  label="CPF"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={handleCpfChange}
                  onBlur={() => setCpfTouched(true)}
                  maxLength={14}
                  inputMode="numeric"
                  autoComplete="off"
                />
                {cpfInvalid && (
                  <p className="mt-1 ml-1 text-[11px] text-red-600 font-semibold">CPF inválido.</p>
                )}
              </div>
              <Input label="Celular / WhatsApp" placeholder="(00) 00000-0000" value={phone} onChange={handlePhoneChange} maxLength={15} inputMode="tel" autoComplete="tel" />
            </div>
            {pixError && (
              <div className="space-y-2">
                <p className="text-sm text-red-600 font-medium">{pixError}</p>
                {pixDebugResponse && (
                  <details className="bg-gray-100 rounded-lg p-3 border border-gray-200" open>
                    <summary className="text-xs font-bold text-gray-600 cursor-pointer">
                      Resposta da API – abra e copie tudo abaixo para enviar ao suporte
                    </summary>
                    <p className="text-[10px] text-gray-500 mt-1 mb-1">
                      Se o servidor estiver rodando, você também pode abrir: http://localhost:3001/api/last-pix-response
                    </p>
                    <pre className="mt-2 text-[10px] overflow-auto max-h-56 text-gray-700 whitespace-pre-wrap break-all select-all">
                      {JSON.stringify(pixDebugResponse, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Delivery Address */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
              <Truck className="h-5 w-5 text-purple-600" />
            </div>
            <h3 className="font-black text-purple-900 uppercase text-sm tracking-wider">Endereço de Entrega</h3>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Input 
                label="CEP" 
                placeholder="00000-000" 
                value={cep}
                onChange={handleCepChange}
                onBlur={() => setCepTouched(true)}
                maxLength={9}
                inputMode="numeric"
                autoComplete="postal-code"
              />
              {cepInvalid && (
                <p className="mt-1 ml-1 text-[11px] text-red-600 font-semibold">
                  {cepInvalidLength ? 'CEP inválido. Use 8 dígitos.' : 'CEP não encontrado.'}
                </p>
              )}
              {loadingCep && (
                <div className="absolute right-3 bottom-3">
                  <div className="h-4 w-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Input label="Rua / Avenida" value={address.street} onChange={(e: any) => setAddress({...address, street: e.target.value})} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Número" value={address.number} onChange={(e: any) => setAddress({...address, number: e.target.value})} />
                <Input label="Complemento" value={address.complement} onChange={(e: any) => setAddress({...address, complement: e.target.value})} />
              </div>
              <Input label="Bairro" value={address.neighborhood} onChange={(e: any) => setAddress({...address, neighborhood: e.target.value})} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Cidade" value={address.city} readOnly />
                <Input label="Estado" value={address.state} readOnly />
              </div>
            </div>
          </div>
        </section>

        {/* Forma de pagamento – PIX (abaixo do endereço) */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="h-5 w-5 text-[#8b4494] shrink-0" />
            <h3 className="font-black text-purple-900 uppercase text-sm tracking-wider italic">
              Forma de pagamento
            </h3>
          </div>

          <div
            className="relative rounded-2xl border-2 border-[#8b4494] bg-white p-4 pr-3 overflow-hidden"
            role="group"
            aria-label="PIX selecionado"
          >
            <Zap className="absolute top-3 right-3 h-16 w-16 text-[#8b4494] opacity-[0.07] pointer-events-none" />
            <div className="relative flex items-center gap-3">
              <div
                className="h-5 w-5 shrink-0 rounded-full border-2 border-[#8b4494] flex items-center justify-center bg-white"
                aria-hidden
              >
                <div className="h-2.5 w-2.5 rounded-full bg-[#8b4494]" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="font-bold text-purple-900 text-sm leading-tight">
                  PIX (Aprovação imediata)
                </p>
                <p className="text-[10px] font-black text-[#8b4494] uppercase tracking-wide mt-1">
                  Liberação instantânea do pedido
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-1.5 rounded-full border border-[#d4e157] bg-[#d4e157]/25 px-2.5 py-1.5">
                <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden className="shrink-0">
                  <path d="M8 8l4 4-4 4-4-4 4-4zm12 0l4 4-4 4-4-4 4-4zM8 20l4 4-4 4-4-4 4-4zm12 0l4 4-4 4-4-4 4-4z" fill="#32BCAD" />
                </svg>
                <span className="text-[11px] font-black text-[#4a148c] tracking-tight">PIX</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 rounded-xl bg-purple-50/80 border border-purple-100 p-4">
            <Zap className="h-5 w-5 text-[#d4e157] shrink-0 mt-0.5 fill-[#d4e157]" />
            <p className="text-xs leading-relaxed text-purple-800/80">
              <span className="font-black text-purple-900">Dica:</span>{' '}
              O pagamento via PIX é processado na hora e garante que seu pedido seja enviado ainda hoje.
            </p>
          </div>
        </section>

        {/* Shipping Options */}
        <AnimatePresence>
          {cep.replace(/\D/g, '').length === 8 && (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4"
            >
              <h3 className="font-black text-purple-900 uppercase text-sm tracking-wider">Opções de Frete</h3>
              <div className="space-y-3">
                <ShippingOption 
                  selected={shipping === 'free'} 
                  onClick={() => setShipping('free')}
                  title="Frete Grátis"
                  time="7 a 10 dias úteis"
                  price="GRÁTIS"
                />
                <ShippingOption 
                  selected={shipping === 'sedex'} 
                  onClick={() => setShipping('sedex')}
                  title="Frete SEDEX"
                  time="2 a 3 dias úteis"
                  price="R$ 19,54"
                />
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Order Summary */}
        <section className="bg-white rounded-2xl p-6 text-purple-900 shadow-sm border border-gray-100">
          <h3 className="font-black uppercase text-sm tracking-widest mb-6 border-b border-gray-100 pb-3">Resumo do Pedido</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal ({quantity}x)</span>
              <span className="font-bold text-gray-900">R$ {(product.price * quantity).toFixed(2).replace('.', ',')}</span>
            </div>
            {product.originalPrice && (
              <div className="flex justify-between text-green-600 font-bold">
                <span>Você economizou</span>
                <span>- R$ {((product.originalPrice - product.price) * quantity).toFixed(2).replace('.', ',')}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-500">
              <span>Frete</span>
              <span className="font-bold text-gray-900">{shippingPrice === 0 ? 'GRÁTIS' : `R$ ${shippingPrice.toFixed(2).replace('.', ',')}`}</span>
            </div>
            
            <div className="flex justify-between text-xl font-black pt-3 border-t border-gray-100 mt-3">
              <span>TOTAL</span>
              <span className="text-purple-600">R$ {total.toFixed(2).replace('.', ',')}</span>
            </div>
          </div>
        </section>

        <button 
          onClick={handleFinalize}
          disabled={loadingPix}
          className="w-full bg-purple-900 text-white font-black py-4 rounded-xl text-lg shadow-lg hover:bg-purple-800 active:scale-[0.98] transition-all uppercase tracking-wider disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loadingPix ? 'Gerando PIX...' : 'Finalizar Compra'}
        </button>

        {/* Feedbacks in white section */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
          <h3 className="font-black text-purple-900 uppercase text-xs tracking-widest mb-2">O que dizem nossos clientes</h3>
          <div className="space-y-4">
            <FeedbackItem 
              name="Carla M." 
              text="Compra super segura, recebi tudo certinho em 5 dias!" 
            />
            <FeedbackItem 
              name="Ricardo T." 
              text="O site é muito fácil de usar, preenchi tudo rapidinho." 
            />
            <FeedbackItem 
              name="Juliana S." 
              text="Atendimento nota 10 e o produto é maravilhoso." 
            />
          </div>
        </section>

        <div className="flex flex-col items-center gap-4 py-6 opacity-40">
          <div className="flex gap-4">
            <ShieldCheck className="h-8 w-8" />
            <Lock className="h-8 w-8" />
            <CreditCard className="h-8 w-8" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-center">
            Seus dados estão protegidos por criptografia de ponta a ponta
          </p>
        </div>
      </main>
    </div>
  );
}

function Input({ label, ...props }: any) {
  return (
    <div className="space-y-1.5 w-full">
      <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider ml-1">{label}</label>
      <input 
        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-base sm:text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all appearance-none"
        {...props}
      />
    </div>
  );
}

function ShippingOption({ selected, onClick, title, time, price }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${selected ? 'border-purple-600 bg-purple-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}
    >
      <div className="flex items-center gap-3">
        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${selected ? 'border-purple-600' : 'border-gray-300'}`}>
          {selected && <div className="h-2.5 w-2.5 bg-purple-600 rounded-full" />}
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-gray-800">{title}</p>
          <p className="text-[10px] text-gray-500 font-medium">{time}</p>
        </div>
      </div>
      <span className={`text-sm font-black ${price === 'GRÁTIS' ? 'text-green-600' : 'text-purple-900'}`}>{price}</span>
    </button>
  );
}

function FeedbackItem({ name, text }: { name: string, text: string }) {
  return (
    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
      <div className="flex gap-1 mb-2">
        {[1,2,3,4,5].map(i => <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />)}
      </div>
      <p className="text-xs leading-relaxed italic text-gray-600">"{text}"</p>
      <p className="text-[10px] font-black mt-2 text-purple-600 uppercase tracking-wider">— {name}</p>
    </div>
  );
}

function Step({ num, label, active }: { num: number, label: string, active?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black ${active ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
        {num}
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-tighter ${active ? 'text-purple-900' : 'text-gray-400'}`}>{label}</span>
    </div>
  );
}

const POLL_ORDER_MS = 200;
const REDIRECT_AFTER_PAID_MS = 1200;

function SuccessScreen({
  total,
  pixCopyPaste,
  orderId,
  onBack,
  onPaidConfirmed,
  utmSearch,
  redirectName,
  redirectEmail,
  redirectPhone,
  redirectCpfDigits,
}: {
  total: number;
  pixCopyPaste: string;
  orderId?: string;
  onBack: () => void;
  onPaidConfirmed: () => void;
  utmSearch: string;
  redirectName: string;
  redirectEmail: string;
  redirectPhone: string;
  redirectCpfDigits: string;
}) {
  const [reservationTime, setReservationTime] = useState({ minutes: 29, seconds: 59 });
  const [statusMessage, setStatusMessage] = useState('Aguardando pagamento...');
  const [isPaymentApproved, setIsPaymentApproved] = useState(false);
  const hasRedirectedAfterPayment = useRef(false);

  const postPaymentUrl = ((import.meta.env.VITE_POST_PAYMENT_REDIRECT_URL as string) || '').trim();

  useEffect(() => {
    const timer = setInterval(() => {
      setReservationTime(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { minutes: prev.minutes - 1, seconds: 59 };
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!orderId || hasRedirectedAfterPayment.current) {
      if (!orderId) {
        setStatusMessage(
          'Não foi possível verificar o pagamento automaticamente (pedido sem ID). Guarde o comprovante do PIX e fale com o suporte.'
        );
      }
      return undefined;
    }

    let isCancelled = false;
    let inFlight = false;

    const checkOrderStatus = async () => {
      if (isCancelled || hasRedirectedAfterPayment.current || inFlight) return;
      inFlight = true;
      try {
        const apiBase = ((import.meta.env.VITE_API_URL as string) || '').replace(/\/$/, '');
        const path = `/api/order/${encodeURIComponent(orderId)}`;
        const url = apiBase ? `${apiBase}${path}` : path;
        const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
        if (!res.ok) return;

        const orderResponse = await res.json().catch(() => null);
        if (!isFruitfyOrderPaid(orderResponse)) {
          setStatusMessage('Aguardando confirmação do pagamento pela operadora...');
          return;
        }

        hasRedirectedAfterPayment.current = true;
        setIsPaymentApproved(true);
        setStatusMessage('Pagamento confirmado! Redirecionando...');

        window.setTimeout(() => {
          if (isCancelled) return;

          if (postPaymentUrl) {
            try {
              const nextUrl = new URL(postPaymentUrl);
              const q = utmSearch.startsWith('?') ? utmSearch.slice(1) : utmSearch;
              const params = new URLSearchParams(q);
              params.set('orderId', orderId);
              try {
                params.set(
                  'prefill',
                  encodeUpsellCustomerPrefill({
                    n: redirectName,
                    e: redirectEmail,
                    p: normalizePhoneForUpsell(redirectPhone),
                    c: redirectCpfDigits,
                  })
                );
              } catch {
                /* segue só com orderId + UTMs */
              }
              nextUrl.search = params.toString();
              window.location.href = nextUrl.toString();
            } catch {
              onPaidConfirmed();
            }
          } else {
            onPaidConfirmed();
          }
        }, REDIRECT_AFTER_PAID_MS);
      } catch {
        if (!isCancelled) setStatusMessage('Verificando pagamento...');
      } finally {
        inFlight = false;
      }
    };

    void checkOrderStatus();
    const intervalId = window.setInterval(() => {
      void checkOrderStatus();
    }, POLL_ORDER_MS);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    orderId,
    onPaidConfirmed,
    postPaymentUrl,
    redirectCpfDigits,
    redirectEmail,
    redirectName,
    redirectPhone,
    utmSearch,
  ]);

  const [showToast, setShowToast] = useState(false);

  const copyToClipboard = async () => {
    const text = pixCopyPaste || '';
    if (!text) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      } finally {
        document.body.removeChild(textarea);
      }
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col items-center relative pb-10">
      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] bg-purple-900 text-white px-6 py-3 rounded-full font-bold shadow-2xl flex items-center gap-2 whitespace-nowrap"
          >
            <CheckCircle2 className="h-5 w-5 text-secondary" /> Código PIX Copiado!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="w-full bg-purple-900 pt-12 pb-24 px-5 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary rounded-full blur-[100px]"></div>
        </div>
        
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="relative z-10"
        >
          <div className="h-16 w-16 bg-green-500 rounded-full flex items-center justify-center mb-4 mx-auto shadow-lg shadow-green-500/20">
            <CheckCircle2 className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Pedido Reservado!</h1>
          <p className="text-purple-100 text-xs font-medium max-w-[250px] mx-auto leading-relaxed">
            Finalize o pagamento via PIX para garantir sua oferta exclusiva.
          </p>
        </motion.div>
      </div>

      {/* Main Content Card */}
      <motion.div 
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-md px-5 -mt-16 relative z-20"
      >
        <div className="bg-white rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-gray-100 space-y-8">
          
          {/* Timer Section */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 bg-red-50 px-4 py-2 rounded-2xl border border-red-100">
              <Clock className="h-4 w-4 text-red-600 animate-pulse" />
              <p className="text-red-600 text-xs font-black uppercase tracking-widest">
                Expira em: <span className="font-mono">{String(reservationTime.minutes).padStart(2, '0')}:{String(reservationTime.seconds).padStart(2, '0')}</span>
              </p>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {isPaymentApproved ? 'Pagamento aprovado!' : 'Aguardando pagamento...'}
            </p>
            <p className="text-sm font-black text-purple-900 mt-1">Valor: R$ {total.toFixed(2).replace('.', ',')}</p>
          </div>

          {isPaymentApproved && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 -mt-4">
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide text-center">
                Pagamento aprovado, redirecionando...
              </p>
            </div>
          )}

          {/* Copy Paste Section */}
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm font-black text-purple-900">PIX Copia e Cola</p>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Copie e pague no app do banco</p>
            </div>
            
            <div className="relative group">
              <div className="bg-gray-50 rounded-2xl p-4 pr-14 text-[11px] font-mono break-all text-gray-600 border border-gray-100 min-h-[80px] flex items-center leading-relaxed">
                {pixCopyPaste}
              </div>
              <button 
                onClick={copyToClipboard}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-purple-900 text-white p-3.5 rounded-xl hover:bg-purple-800 active:scale-95 transition-all shadow-lg shadow-purple-900/20"
                title="Copiar Código"
              >
                <Copy className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-purple-50 p-5 rounded-3xl border border-purple-100 space-y-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-purple-600" />
              <p className="text-xs font-black text-purple-900 uppercase tracking-wider">Como pagar?</p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {[
                'Abra o aplicativo do seu banco',
                'Escolha a opção PIX Copia e Cola',
                'Cole o código e confirme os dados',
                'Pronto! Seu acesso será liberado'
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="h-4 w-4 rounded-full bg-purple-200 text-purple-900 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  <p className="text-[11px] text-purple-800 font-medium">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-10 text-center space-y-6">
          <p className="text-xs text-purple-900 font-bold px-2">
            {statusMessage}
          </p>
          <p className="text-[10px] text-gray-400 font-medium px-2">
            {postPaymentUrl
              ? 'Ao confirmar o PIX, você será redirecionado para a próxima página (UTMs e orderId vão na URL).'
              : 'A página será redirecionada automaticamente para “Obrigado” quando o pagamento for confirmado.'}
          </p>
          <div className="flex items-center justify-center gap-6 opacity-40">
            <ShieldCheck className="h-6 w-6" />
            <Lock className="h-6 w-6" />
            <Truck className="h-6 w-6" />
          </div>
          <button 
            onClick={onBack}
            className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] hover:text-purple-900 transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            <ChevronLeft className="h-3 w-3" /> Voltar para a loja
          </button>
        </div>
      </motion.div>
    </div>
  );
}
