/*
 * Lo que comparten la app (app.js) y el marco de cada chat (charla.js): guardar cosas en el
 * teléfono, y leer y validar la configuración del chat de cada entidad.
 *
 * Todo lo que viene de esa configuración lo escribe la entidad en la plataforma, así que se trata
 * como texto ajeno: se recorta, se valida y nunca se mete como HTML.
 */
window.Comun = (function () {
  'use strict';

  var G = window.GRUPO || { nombre: '', entidades: [], situaciones: [] };

  // La versión de lo que se dicen la app y los marcos de los chats. Si cambia qué mensajes se
  // mandan o qué significan, se sube el número: al publicar, por un rato puede quedar la app
  // vieja con un marco nuevo, y así la app se da cuenta y se recarga sola (ver app.js, «hola»).
  var VERSION = 5;
  // Prefijo de todo lo que la app guarda en el navegador. Es FIJO a propósito: si dependiera de
  // VERSION, cada vez que se sube ese número la app olvidaría qué mensajes ya se vieron y avisaría
  // «te contestaron» por conversaciones leídas.
  var PRE = 'grupo_';

  function leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function guardar(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function borrar(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function leerJSON(k) { try { return JSON.parse(leer(k) || 'null'); } catch (e) { return null; } }

  function texto(v, max) { return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : ''; }
  // Para comparar lo que escribe la persona con los temas: sin mayúsculas ni tildes.
  function norm(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function color(v) { return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim() : ''; }
  // Sólo https, una ruta del sitio de la plataforma o una imagen incrustada. Va a un <img>, nunca a
  // HTML. La plataforma manda sus logos como ruta («/brands/…»): se completa con su sitio (`base`),
  // que es de donde vino el chat de esa entidad.
  function logo(v, base) {
    if (typeof v !== 'string') return '';
    var s = v.trim();
    if (s.length >= 300000) return '';
    if (base && s.indexOf(base + '/') === 0) return s;      // ya venía completada con el sitio de la plataforma
    if (!/^(https:\/\/|\/(?!\/)|data:image\/(png|jpeg|webp|svg\+xml);)/i.test(s)) return '';
    return s.charAt(0) === '/' ? (base || '') + s : s;
  }
  function enlace(v) { var s = typeof v === 'string' ? v.trim() : ''; return /^https:\/\/[^\s"'<>]+$/i.test(s) && s.length < 500 ? s : ''; }
  // Blanco o tinta oscura, según cuál se lea mejor sobre el color de la entidad. 0.21 es donde el
  // contraste con blanco y con la tinta oscura se cruzan: de ahí para arriba gana la tinta.
  function tintaSobre(hex) {
    var n = parseInt(hex.slice(1), 16), c = [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (x) {
      x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] > 0.21 ? '#16202b' : '#ffffff';
  }
  // Una huella de un texto. Sirve para reconocer «es lo mismo que ya vi» sin guardar en el teléfono
  // lo que dice. Se saca sin espacios, para que dé igual cómo venga cortado el texto.
  function huella(s) {
    var t = norm(s).replace(/\s+/g, ''), h = 2166136261;
    for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h.toString(36);
  }

  function entidad(slug) {
    var s = String(slug || '').toLowerCase(), hallada = null;
    G.entidades.forEach(function (e) { if (e.slug === s) hallada = e; });
    return hallada;
  }

  /* ── Dónde está el chat de cada entidad ────────────────────────────────────────────────────────
   *
   * Cada entidad tiene su script del chat, el que da la plataforma para pegar en un sitio:
   *   <script src="https://…/widget.js" data-key="wk_…" async></script>
   * En entidades.js están sus dos datos: `guion` (el src) y `clave` (el data-key). El chat le habla
   * a la plataforma de donde vino su script, y la app le pide la configuración a ese mismo sitio.
   *
   * Dos casos en que NO se usa `guion` y el chat se pide a este mismo sitio (`/widget.js`):
   *   · en una máquina de desarrollo (servidor-local.js), que se lo pasa a la API local: así se
   *     prueba contra los bots de la base local y las pruebas no dejan conversaciones en producción;
   *   · si la entidad no tiene `guion`: es para publicar la app detrás de un servidor que reenvíe a
   *     la plataforma las rutas del chat (lo mismo que hace servidor-local.js).
   */
  var EN_DESARROLLO = /^(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(location.hostname);
  // De dónde se carga el chat de esta entidad.
  function guionDe(ent) {
    var s = !EN_DESARROLLO && typeof ent.guion === 'string' ? ent.guion.trim() : '';
    return /^https?:\/\/[^\s"'<>\/]+\/widget\.js$/i.test(s) ? s : '/widget.js';
  }
  // El sitio de la plataforma de esta entidad. Vacío: es este mismo sitio.
  function plataformaDe(ent) {
    var g = guionDe(ent);
    try { return g.charAt(0) === '/' ? '' : new URL(g).origin; } catch (e) { return ''; }
  }
  // La plataforma manda como RUTA lo que sirve ella misma (el logo «/brands/…», la foto del asesor,
  // el aviso «/privacidad/…») y el chat lo usa tal cual: cargado desde otro sitio, se lo pediría al
  // sitio de la app, que no lo tiene. Se completa con el sitio de la plataforma de esa entidad. Con
  // el chat en este mismo sitio no cambia nada.
  function completarConfig(ent, cruda) {
    var base = plataformaDe(ent);
    if (!base || !cruda || typeof cruda !== 'object') return cruda;
    var completa = function (v) { return typeof v === 'string' && /^\/(?!\/)/.test(v) ? base + v : v; };
    if (cruda.branding && typeof cruda.branding === 'object' && cruda.branding.logo) cruda.branding.logo = completa(cruda.branding.logo);
    if (cruda.asesor && typeof cruda.asesor === 'object' && cruda.asesor.foto) cruda.asesor.foto = completa(cruda.asesor.foto);
    if (cruda.privacidad_url) cruda.privacidad_url = completa(cruda.privacidad_url);
    return cruda;
  }

  // Los botones de arranque que la entidad configuró en su chat («Mis haberes», «Autorizar un
  // medicamento»…). `texto` es lo que el chat manda cuando la persona toca el botón; `enlace`,
  // adónde lleva si el botón es un enlace.
  function intenciones(lista) {
    if (!Array.isArray(lista)) return [];
    return lista.map(function (i) {
      var etiqueta = texto(i && i.label, 60), url = i && i.accion === 'link' ? enlace(i.link) : '';
      return { etiqueta: etiqueta, texto: texto(i && (i.text || i.label), 200), enlace: url };
    }).filter(function (i) { return i.etiqueta && (i.texto || i.enlace); }).slice(0, 12);
  }

  /* ── La configuración del chat de cada entidad ─────────────────────────────────────────────────
   *
   * Se guarda con su hora y se reusa mientras esté fresca. La app y los chats la necesitan todo el
   * tiempo (al abrir, al cambiar de entidad, al volver a la app), y la plataforma frena los pedidos
   * POR CONEXIÓN, sumando a las tres entidades: detrás de la red de un mismo operador de celular
   * salen muchas personas con la misma dirección. Con esto hay, como mucho, un pedido de
   * configuración por entidad cada diez minutos por teléfono, la pida quien la pida.
   *
   * Se guarda tal como vino (no trae nada reservado: es lo mismo que recibe cualquier visitante),
   * para que el chat de adentro del marco pueda usarla sin volver a pedirla. Que una entidad NO
   * tenga el chat habilitado también se guarda, pero por poco tiempo: si lo habilitan, tiene que
   * verse enseguida.
   */
  var FRESCA_MS = 10 * 60 * 1000, FRESCA_NO_MS = 60 * 1000, MAX_GUARDAR = 60000;
  var enCurso = {};
  var clave = function (ent) { return PRE + 'cfg_' + ent.slug; };

  function resumir(cruda, ent) {
    var b = (cruda && cruda.branding) || {};
    // El nombre, en el mismo orden que usa el chat para su encabezado: el del asesor si lo cargaron, si no el del bot.
    var nombre = (cruda && cruda.asesor && cruda.asesor.nombre) || (cruda && cruda.nombre);
    return { bot: texto(nombre, 40), color: color(b.color), logo: logo(b.logo, plataformaDe(ent)), intenciones: intenciones(cruda && cruda.intenciones) };
  }
  // Lo último que se supo de la configuración de una entidad: { cfg, no, fresca } o null.
  function configGuardada(ent) {
    var g = leerJSON(clave(ent));
    if (!g || typeof g !== 'object') return null;
    var edad = Date.now() - (Number(g.en) || 0);
    if (g.no) return { cfg: null, no: true, fresca: edad < FRESCA_NO_MS };
    return g.cruda ? { cfg: resumir(g.cruda, ent), no: false, fresca: edad < FRESCA_MS } : null;
  }
  // La configuración tal como vino, sólo si todavía está fresca. La usa el marco del chat.
  function configFresca(ent) {
    var g = leerJSON(clave(ent));
    return g && !g.no && g.cruda && Date.now() - (Number(g.en) || 0) < FRESCA_MS ? completarConfig(ent, g.cruda) : null;
  }
  function recibirConfig(ent, cruda) {
    var s = JSON.stringify({ en: Date.now(), cruda: completarConfig(ent, cruda) });
    if (s.length <= MAX_GUARDAR) guardar(clave(ent), s);
    return resumir(cruda, ent);
  }
  function marcarNoDisponible(ent) { guardar(clave(ent), JSON.stringify({ en: Date.now(), no: true })); }

  /*
   * Devuelve una promesa con { estado, cfg }:
   *   ok      → el chat está habilitado; cfg trae el bot, el color, el logo y los botones de arranque
   *   no      → la entidad no tiene el chat habilitado para este sitio (la API contesta 400, 403 o 404)
   *   sinred  → no hubo respuesta útil; cfg es la última que se conocía, si había
   */
  function pedirConfig(ent) {
    var g = configGuardada(ent);
    if (g && g.fresca) return Promise.resolve(g.no ? { estado: 'no', cfg: null } : { estado: 'ok', cfg: g.cfg });
    if (enCurso[ent.slug]) return enCurso[ent.slug];
    var vieja = g && !g.no ? g.cfg : null;
    var p = fetch(plataformaDe(ent) + '/api/web-chat/config?key=' + encodeURIComponent(ent.clave), { headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (r.status === 400 || r.status === 403 || r.status === 404) { marcarNoDisponible(ent); return { estado: 'no', cfg: null }; }
        if (!r.ok) return { estado: 'sinred', cfg: vieja };
        return r.json().then(function (cruda) {
          if (!cruda || cruda.ok === false) return { estado: 'sinred', cfg: vieja };
          return { estado: 'ok', cfg: recibirConfig(ent, cruda) };
        });
      })
      .catch(function () { return { estado: 'sinred', cfg: vieja }; })
      .then(function (res) { delete enCurso[ent.slug]; return res; });
    enCurso[ent.slug] = p;
    return p;
  }

  // ¿Hay una conversación empezada con esta entidad en este teléfono? El chat guarda ahí su credencial.
  function hayConversacion(ent) { return !!leer('webchat_token_' + ent.clave); }

  return {
    VERSION: VERSION, PRE: PRE, grupo: G, entidad: entidad, guionDe: guionDe, plataformaDe: plataformaDe, leer: leer, guardar: guardar, borrar: borrar, leerJSON: leerJSON,
    texto: texto, norm: norm, huella: huella, tintaSobre: tintaSobre,
    configGuardada: configGuardada, configFresca: configFresca, recibirConfig: recibirConfig, completarConfig: completarConfig,
    marcarNoDisponible: marcarNoDisponible, pedirConfig: pedirConfig, hayConversacion: hayConversacion
  };
}());
