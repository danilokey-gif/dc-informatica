// Service worker mínimo: existe para o navegador considerar o site instalável como app (PWA).
// Não guarda páginas em cache, já que os dados do sistema mudam o tempo todo.
// Só cuida da abertura de páginas: se a internet falhar por um instante (Wi-Fi oscilando, PC
// voltando da suspensão), tenta de novo e, se continuar sem rede, mostra um aviso com botão
// "Tentar novamente" no lugar da tela de erro do navegador (ERR_FAILED).
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

async function abrirPagina(request) {
  for (const pausa of [0, 800, 2000]) {
    if (pausa) await esperar(pausa)
    try {
      return await fetch(request)
    } catch (e) {
      // sem rede: tenta de novo
    }
  }
  return new Response(PAGINA_SEM_INTERNET, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

self.addEventListener('fetch', (event) => {
  // Demais pedidos (imagens, dados, envios) seguem direto para a rede, sem passar por aqui.
  if (event.request.mode === 'navigate') event.respondWith(abrirPagina(event.request))
})

const PAGINA_SEM_INTERNET = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sem conexão - Dc Informática</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,Segoe UI,Arial,sans-serif;background:#f4f6f9;color:#1f2937}
  .caixa{max-width:420px;padding:2rem;text-align:center}
  h1{font-size:1.35rem;margin:0 0 .6rem}
  p{color:#4b5563;line-height:1.5;margin:0 0 1.4rem}
  button{background:#c8102e;color:#fff;border:0;border-radius:8px;padding:.75rem 1.6rem;font-size:1rem;cursor:pointer}
</style></head>
<body><div class="caixa">
  <h1>Sem conexão com a internet</h1>
  <p>Não foi possível abrir a página agora. Confira o Wi-Fi ou o cabo de rede e tente de novo.</p>
  <button onclick="location.reload()">Tentar novamente</button>
</div>
<script>window.addEventListener('online',()=>location.reload())</script>
</body></html>`
