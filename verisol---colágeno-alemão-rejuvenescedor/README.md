<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e243508f-a9c0-4a45-a187-6f9bd6068058

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   - **Site + API juntos (recomendado):** `npm run dev:all`
   - Ou em dois terminais: `npm run dev:server` (API porta 3001) e `npm run dev` (site porta 3000)

   Para o PIX (Fruitfy) funcionar, a API precisa estar rodando. Os logs da API aparecem no terminal onde você rodou `dev:server` ou no `dev:all`.

## Deploy na Netlify

1. Conecte o repositório ao Netlify; o build usa `npm run build` e a pasta de publicação é `dist`.
2. **Variáveis de ambiente** (Site settings → Environment variables): configure `FRUITFY_API_TOKEN`, `FRUITFY_STORE_ID` e `FRUITFY_PRODUCT_ID` com os mesmos valores do `.env` local.
3. A rota `/api/create-pix` é atendida pela função serverless em `netlify/functions/create-pix.js`; não é necessário servidor Node separado.

## Deploy na Vercel

1. Importe o projeto na Vercel (framework **Vite** detectado automaticamente).
2. **Environment Variables**: as mesmas da Netlify — `FRUITFY_API_TOKEN`, `FRUITFY_STORE_ID`, `FRUITFY_PRODUCT_ID`.
3. **Não** defina `VITE_API_URL` em produção (deixe vazio) para o front usar `/api/...` no mesmo domínio. As funções em `api/` reutilizam o código de `netlify/functions/`.
4. O `vercel.json` faz fallback SPA (`/checkout`, `/obrigado`, etc.) para `index.html`, exceto rotas `/api/*`.

## UTMs

Os parâmetros UTM na URL (ex.: `?utm_source=facebook&utm_medium=cpc`) são gravados na sessão e mantidos em todas as navegações (home e checkout), para que o domínio conserve os UTMs em qualquer “página” que o usuário abrir.

Na **finalização do PIX**, o checkout envia os UTMs no corpo do `POST /api/create-pix` (campo `utm`) e o backend repassa à Fruitfy **no mesmo formato do projeto de referência `testohardcomutm`**: corpo JSON com **`utm: { utm_source, ... }`** em `POST https://api.fruitfy.io/api/pix/charge` (não usar `metadata` para esse endpoint). O front também lê `sessionStorage` com prefixo **`utmify:`** (script UTMify), como no testohard.

Após o PIX ser pago, a API é consultada automaticamente (`GET /api/order-status/:orderId`). Quando o status vier como **pago**, o site redireciona para **`/obrigado`** com os parâmetros da campanha na URL. A rota **`/obrigado`** só abre se existir confirmação recente na sessão (não dá para “chutar” a URL sem ter pago).

## UTMify (pixel)

O pixel e o script de UTMs da UTMify são carregados em **todas as rotas** via `src/components/UtmifyScripts.tsx`. Opcional: defina `VITE_UTMIFY_PIXEL_ID` no `.env` (veja `.env.example`); se vazio, usa o ID padrão do projeto.
