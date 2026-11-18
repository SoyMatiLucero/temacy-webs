/*
 * Service worker de la web app del grupo (v5).
 *
 * Para qué está: que la app abra AL TOQUE, también con mala señal o sin conexión. No guarda nada de
 * las conversaciones: los mensajes, el chat (/widget.js) y la API van siempre a la red.
 *
 * Cómo: los archivos de la app se sirven de la copia guardada, sin esperar a la red. Por detrás, al
 * abrir la app (y como mucho cada diez minutos), se traen TODOS de nuevo y, sólo si llegaron todos,
 * se reemplaza la copia entera. Así no queda una mezcla de versiones (la página nueva con la lógica
 * vieja), y con señal mala no hay que esperar a que un pedido se venza para ver la app.
 *
 * Consecuencia: un cambio publicado se ve la SEGUNDA vez que se abre la app, no la primera.
 * Y otra, a cuidar al publicar: si falta UNO solo de los archivos de la lista, la copia no se
 * actualiza y los teléfonos se quedan con la versión anterior sin avisar. El guion de publicación
 * tiene que comprobar que estén todos.
 *
 * Al sumar un archivo a la app hay que sumarlo a ARCHIVOS, o no va a estar sin conexión.
 */
const COPIA = 'grupo-v5';
// El sello de esta publicación. El deploy lo reemplaza por el identificador del commit (ver
// .github/workflows/deploy-ftp.yml); en una máquina de desarrollo queda tal cual. Sirve para dos
// cosas: este archivo cambia en cada publicación, así que el teléfono se entera de que hay una
// nueva; y los archivos se piden con el sello en la dirección, así ningún intermediario (la CDN
// del hosting guardaba los .js y .css una semana) puede devolver los de la publicación anterior.
const SELLO = 'ed0d2b79';
const BASE = new URL(self.registration.scope).pathname;
const ARCHIVOS = ['', 'index.html', 'app.css', 'app.js', 'movimiento.js', 'comun.js', 'entidades.js',
  'charla.html', 'charla.css', 'charla.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'fuentes/cabinet-grotesk-800.woff2', 'fuentes/satoshi-400.woff2', 'fuentes/satoshi-500.woff2', 'fuentes/satoshi-700.woff2'];
const RUTAS = new Set(ARCHIVOS.map((a) => BASE + a));
const CADA_MS = 10 * 60 * 1000;
let ultimaVez = 0;
let enCurso = null;

function ponerAlDia() {
  if (enCurso) return enCurso;
  enCurso = (async () => {
    const rutas = [...RUTAS];
    // Se piden con el sello y se guardan por su ruta pelada, que es como después se los busca.
    const respuestas = await Promise.all(rutas.map((r) => fetch(r + '?v=' + SELLO, { cache: 'no-cache' })));
    if (respuestas.some((r) => !r.ok)) return;            // faltó alguno: se deja la copia como estaba
    const copia = await caches.open(COPIA);
    await Promise.all(rutas.map((r, i) => copia.put(r, respuestas[i])));
  })().catch(() => {}).then(() => { enCurso = null; });
  return enCurso;
}

self.addEventListener('install', (e) => {
  ultimaVez = Date.now();
  e.waitUntil(ponerAlDia().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('grupo-') && k !== COPIA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Sólo los archivos de la app, que son siempre los mismos y vienen de este sitio. Todo lo demás
  // (/api, /widget.js, /socket.io, logos, adjuntos) no se toca ni se guarda: en la copia no entra
  // nada que haya subido o escrito alguien.
  if (!RUTAS.has(url.pathname)) return;
  if (Date.now() - ultimaVez > CADA_MS) { ultimaVez = Date.now(); e.waitUntil(ponerAlDia()); }
  // La página es la misma con cualquier parámetro (./?e=suvico, charla.html?e=…): se busca por su ruta.
  e.respondWith(caches.open(COPIA).then((copia) => copia.match(url.pathname)).then((guardado) => guardado || fetch(req)));
});
