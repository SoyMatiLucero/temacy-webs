/*
 * El marco del chat de UNA entidad (charla.html?e=<slug>). La app (index.html) tiene un marco por
 * entidad: así los chats quedan vivos a la vez, pasar de uno a otro es instantáneo y ninguno se
 * entera del otro —cada marco es un documento aparte, con su propio chat de la plataforma adentro.
 *
 * Qué hace:
 *   · carga el chat (el script de la entidad: su `guion` y su `clave`) y lo deja abierto ocupando el marco;
 *   · le cuenta a la app qué pasa (está listo, falló, qué hay en la conversación, se va a recargar);
 *   · hace lo que la app pide (mandar una consulta, tocar un botón de arranque, ponerse al día);
 *   · cuida que un chat que NO se está viendo no moleste: no toma el foco, no habla en voz alta y
 *     no llena la red de pedidos.
 *
 * El chat no expone ninguna forma de manejarlo, así que se lo maneja como lo haría una persona
 * —por su DOM— y se mira qué le pide al servidor. Todo lo que esto sabe del chat por dentro está
 * junto, en `SEL` (sus clases) y en `mirar()` (sus respuestas): si el chat cambia, se arregla ahí.
 */
(function () {
  'use strict';

  var C = window.Comun;
  var SEL = {
    boton: '.wcw-btn',                 // el botón redondo que abre el chat
    panel: '.wcw-panel',               // la ventana del chat
    abierto: 'wcw-on',                 // clase del panel cuando está abierto
    cargando: 'wcw-loading',           // clase del panel mientras pide su configuración
    error: '.wcw-err',                 // el cartel de error que dibuja el chat
    cabeza: '.wcw-head',
    punto: '.wcw-dot',                 // con la clase «espera»: la conversación pasó a una persona
    subtitulo: '.wcw-subtxt',          // «Te atiende Ana», «Derivado al equipo»…
    cuerpo: '.wcw-body',               // la lista de mensajes
    mensaje: '.wcw-m',                 // cada mensaje (lleva data-at con su hora)
    bienvenida: 'wcw-welcome',         // el saludo, que el chat escribe solo cada vez que abre
    mio: 'visitor',                    // mensajes de la persona
    equipo: 'operator',                // mensajes de una persona del equipo de la entidad
    sistema: 'system',                 // avisos del chat (no son de nadie)
    campo: '.wcw-foot input[type="text"]',
    enviar: '.wcw-send',
    arranque: '.wcw-ctas .wcw-intent', // los botones de arranque que configuró la entidad
    tramite: '.wcw-gestion',           // un trámite a medio completar
    pregunta: '.wcw-consent-ask:not(.wcw-gestion):not(.wcw-aviso):not(.wcw-reclamo)',   // el chat espera un sí o un no
    // Cualquier cosa que la persona tenga a medias y que una recarga le haría perder: una caja con
    // campos o botones (trámite, reclamo, aviso por mail, consentimiento), una confirmación, el bot
    // escribiendo, un archivo subiendo, un audio o un dictado en curso.
    aMedias: '.wcw-consent-ask, .wcw-confirm, .wcw-typing, .wcw-adj:disabled, .wcw-rec.rec, .wcw-mic.rec',
    adjuntar: '.wcw-adj, input[type="file"]'
  };

  var slug = new URLSearchParams(location.search).get('e');
  var ent = C.entidad(slug);
  // Abierta suelta o con una entidad que no existe: esto es una pieza de la app, se va a la app.
  if (!ent || window.parent === window) { location.replace('./' + (ent ? '?e=' + ent.slug : '')); return; }

  var ORIGEN = location.origin;
  var TACTIL = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  var activo = false;           // ¿es este el chat que la persona está viendo?
  var listo = false, cerrado = false, yendose = false, panel = null, pendientes = [];
  var habiaConversacion = C.hayConversacion(ent);
  var red = { config: '', historial: false, tramite: false };   // lo que se sabe por los pedidos del chat

  function avisar(tipo, datos) {
    var m = { app: 'grupo', tipo: tipo, slug: ent.slug };
    if (datos) Object.keys(datos).forEach(function (k) { m[k] = datos[k]; });
    window.parent.postMessage(m, ORIGEN);
  }
  // Recargar este marco, avisándole antes a la app: mientras tanto acá no hay nadie que escuche, y
  // lo que la app mandara en ese rato se perdería sin que nadie se entere.
  function recargar() {
    if (yendose) return;
    yendose = true;
    avisar('adios');
    location.reload();
  }
  window.addEventListener('pagehide', function () { if (!yendose) { yendose = true; avisar('adios'); } });

  /* ── Un chat que no se está viendo no molesta ─────────────────────────────────────────────────
   *
   * FOCO. El chat le da el foco a su campo de texto solo (al abrirse, al terminar un trámite).
   * Suelto en una página está bien. Acá hay varios chats vivos a la vez, y el que cargaba DE FONDO
   * le sacaba el foco a lo que la persona estaba escribiendo en otro lado (se midió: se cortaba la
   * palabra a la mitad). `inert` en el marco no lo evita. Se resuelve en la fuente: dentro de este
   * documento, pedir el foco por programa sólo funciona si este chat es el que se ve Y el foco ya
   * está acá adentro (la persona lo está usando). En el teléfono se pide además que el foco esté
   * sobre algo del chat y no sólo «en el marco»: si no, con entrar a una conversación se abriría
   * el teclado. Así el chat sigue manejando su foco como siempre mientras se lo usa, pero no se lo
   * puede sacar a otra parte de la app. Tocar con el dedo o el mouse no pasa por acá. Cuando es la
   * app la que quiere el foco en el campo, usa `focoDeFabrica`.
   *
   * VOZ. Si la persona activó «leer las respuestas en voz alta» en un chat y pasó a otro, el
   * primero seguía leyendo lo que le llegaba. Un chat que no se ve no habla.
   */
  var focoDeFabrica = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function () {
    if (!activo || !document.hasFocus()) return;
    if (TACTIL && (!document.activeElement || document.activeElement === document.body)) return;
    return focoDeFabrica.apply(this, arguments);
  };
  try {
    if (window.SpeechSynthesis && SpeechSynthesis.prototype.speak) {
      var hablarDeFabrica = SpeechSynthesis.prototype.speak;
      SpeechSynthesis.prototype.speak = function (frase) { if (activo) return hablarDeFabrica.call(this, frase); };
    }
  } catch (e) {}
  function callar() { try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {} }
  function soltarFoco() { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); }

  /* ── Mirar lo que el chat le pide al servidor ─────────────────────────────────────────────────
   *
   * Se envuelve `fetch` ANTES de cargar el chat. No se hace ningún pedido propio: sólo se mira lo
   * que el chat ya pide, que dice cosas que su DOM no dice (si la entidad tiene el chat habilitado,
   * cuándo terminó de cargar el historial, si quedó un trámite a medias).
   *
   * Y se evitan dos pedidos que sobran:
   *   · la configuración, si la app ya la tiene fresca (ver comun.js): se le contesta con esa;
   *   · la consulta periódica de mensajes de un chat que NO se está viendo. El chat consulta cada
   *     4 segundos cuando no logra conectarse en vivo; con tres chats abiertos eso son 45 pedidos
   *     por minuto, y la plataforma frena por conexión. De fondo se espacia a una cada 20 segundos
   *     (cada 60 con la app fuera de la vista), contestándole mientras tanto con lo último que
   *     vino. El chat que se está viendo consulta a su ritmo.
   */
  var fetchDeFabrica = window.fetch;
  var ultimaLista = null;        // la última respuesta de la consulta de mensajes: { en, status, cuerpo }
  var ultimoCambio = 0;          // cuándo cambió por última vez lo que hay en pantalla
  var ultimaConsulta = 0;        // cuándo consultó el chat por última vez (de verdad o contestada de la copia)
  var deLaCopia = false;         // alguna consulta se contestó con lo último que había
  function respuesta(status, cuerpo) { return new Response(cuerpo, { status: status, headers: { 'Content-Type': 'application/json' } }); }

  window.fetch = function (recurso, opciones) {
    var que = '';
    try {
      var url = typeof recurso === 'string' ? recurso : (recurso && recurso.url) || '';
      var metodo = String((opciones && opciones.method) || (recurso && recurso.method) || 'GET').toUpperCase();
      que = (/\/api\/web-chat\/(config|messages|message|gestion)(?=[\/?]|$)/.exec(url) || [])[1] || '';
      if (que === 'config' && metodo === 'GET') {
        var fresca = C.configFresca(ent);
        if (fresca) { red.config = 'ok'; setTimeout(decidir, 0); return Promise.resolve(respuesta(200, JSON.stringify(fresca))); }
      }
      if (que === 'messages' && metodo === 'GET') {
        ultimaConsulta = Date.now();
        if (ultimaLista && (!activo || document.hidden)) {
          var espera = document.hidden ? 60000 : 20000;
          // Sólo se repite lo último si la pantalla no cambió después por otra vía (un mensaje en vivo):
          // repetir una lista más vieja que la pantalla haría desaparecer mensajes por un rato.
          if (Date.now() - ultimaLista.en < espera && ultimoCambio <= ultimaLista.en + 5000) {
            deLaCopia = true;
            return Promise.resolve(respuesta(ultimaLista.status, ultimaLista.cuerpo));
          }
        }
      }
    } catch (e) { que = ''; }
    var promesa = fetchDeFabrica.apply(this, arguments);
    // Con el chat cargado desde el sitio de la plataforma, a su configuración se le completan las
    // rutas que la plataforma manda sin sitio (logo, aviso de privacidad): ver comun.js.
    if (que === 'config' && C.plataformaDe(ent)) {
      promesa = promesa.then(function (r) {
        if (r.status !== 200) return r;
        return r.clone().json().then(function (cruda) { return respuesta(200, JSON.stringify(C.completarConfig(ent, cruda))); }, function () { return r; });
      });
    }
    if (que) promesa.then(function (r) { mirar(que, r.status, r.clone()); }, function () { mirar(que, 0, null); });
    return promesa;
  };
  /* Lo que cuesta espaciar: si en ese hueco llega una respuesta y justo después el chat logra
   * conectarse en vivo, deja de consultar y NO vuelve a pedir lo que llegó en el medio (es un
   * defecto del chat, que suelto en una página tiene el mismo hueco, de 4 segundos). Por eso, si a
   * este chat se le contestó de la copia y después dejó de consultar, se lo recarga: trae todo de
   * nuevo y no se pierde nada. */
  setInterval(function () {
    if (deLaCopia && Date.now() - ultimaConsulta > 9000) { deLaCopia = false; refrescar(); }
  }, 5000);

  function mirar(que, status, copia) {
    try {
      if (que === 'config') {
        if (status === 400 || status === 403 || status === 404) { red.config = 'no'; C.marcarNoDisponible(ent); return decidir(); }
        if (status !== 200 || !copia) { red.config = 'falla'; return decidir(); }
        return void copia.json().then(function (cruda) {
          if (!cruda || cruda.ok === false) red.config = 'falla';
          else { red.config = 'ok'; C.recibirConfig(ent, cruda); }
          decidir();
        }, function () { red.config = 'falla'; decidir(); });
      }
      if (!copia) return;
      if (que === 'messages') {
        var en = Date.now();
        return void copia.text().then(function (cuerpo) {
          ultimaLista = { en: en, status: status, cuerpo: cuerpo };
          deLaCopia = false;                 // ésta vino de la red: lo que hay en pantalla está al día
          red.historial = true;              // con cualquier respuesta: si la credencial venció, no hay nada que esperar
          if (status === 200) { try { var lista = JSON.parse(cuerpo); if (lista && typeof lista === 'object') red.tramite = !!lista.gestion; } catch (e) {} }
          programarConteo();
        }, function () {});
      }
      // Mandar un mensaje o avanzar un trámite: ¿quedó un trámite a medias? El servidor lo dice de
      // varias formas según por dónde se llegó (escribiendo o con el formulario del trámite).
      copia.json().then(function (b) {
        if (!b || typeof b !== 'object') return;
        if (b.completa || b.ya || b.gestion_completa || b.gestion_cancelada) red.tramite = false;
        else if (b.gestion || b.paso) red.tramite = true;
      }, function () {});
    } catch (e) {}
  }

  /* ── Lo que se ve mientras carga o si no se pudo ──────────────────────────────────────────── */
  var estadoEl = document.getElementById('estado');
  var estadoTxt = document.getElementById('estado-texto');
  var reintentar = document.getElementById('reintentar');
  var limite = 0;
  var relojEstado = 0;
  function mostrarEstado(estado, msj, conReintento) {
    // Listo: la cortina de carga se va con un fundido (lo hace la hoja de estilos) y recién después
    // se saca del todo. Mientras se funde ya no tapa los toques.
    clearTimeout(relojEstado);
    if (estado === 'listo') relojEstado = setTimeout(function () { estadoEl.hidden = true; }, 450);
    else estadoEl.hidden = false;
    estadoEl.setAttribute('data-estado', estado);
    estadoTxt.textContent = msj || '';
    reintentar.hidden = !conReintento;
    avisar('estado', { estado: estado });
  }
  // No se pudo abrir el chat. Lo que la app había pedido mandar no se mandó: se lo dice.
  function terminar(estado, msj, conReintento) {
    cerrado = true;
    clearTimeout(limite);
    mostrarEstado(estado, msj, conReintento);
    pendientes.splice(0).forEach(function (p) { if (p.envio) avisar('sin-enviar', { motivo: 'fallo', escrito: false }); });
  }
  reintentar.onclick = recargar;
  window.addEventListener('online', function () { if (!listo) recargar(); });

  // El color de la entidad, para que el esqueleto de carga ya sea «el de ella».
  var guardada = C.configGuardada(ent);
  var colorMarca = (guardada && guardada.cfg && guardada.cfg.color) || ent.color;
  document.documentElement.style.setProperty('--marca', colorMarca);
  document.documentElement.style.setProperty('--marca-tinta', C.tintaSobre(colorMarca));
  mostrarEstado('cargando', 'Abriendo el chat de ' + ent.nombre + '…');

  /* ── Cargar el chat y dejarlo abierto ─────────────────────────────────────────────────────────
   *
   * El chat pide su configuración apenas carga, sin esperar a que lo abran. Abrirlo ANTES de que
   * esa respuesta llegue hace que la pida otra vez, y con dos respuestas quedan dos oyentes en sus
   * botones de voz y de micrófono (el de voz deja de andar y el micrófono graba doble). Por eso se
   * espera a que termine: recién ahí se lo abre.
   */
  var vigia = new MutationObserver(function () { decidir(); });
  var vigiaPanel = null;
  vigia.observe(document.body, { childList: true });
  limite = setTimeout(function () { if (!listo && !cerrado) terminar('fallo', 'No pudimos abrir el chat.', true); }, 15000);

  var guion = document.createElement('script');
  guion.src = C.guionDe(ent);          // el script del chat de esta entidad (ver comun.js, «Dónde está el chat»)
  guion.async = true;
  guion.setAttribute('data-key', ent.clave);
  guion.onerror = function () { if (!listo) terminar('sinred', 'No pudimos cargar el chat. Revisá tu conexión.', true); };
  document.body.appendChild(guion);

  function decidir() {
    if (listo || cerrado) return;
    if (red.config === 'no') return terminar('no', 'El chat de ' + ent.nombre + ' no está disponible en este momento.', false);
    if (red.config === 'falla') return terminar('sinred', 'No pudimos conectar. Revisá tu conexión.', true);
    var p = document.querySelector(SEL.panel), b = document.querySelector(SEL.boton);
    if (!p || !b) return;
    if (!vigiaPanel) {          // el panel avisa cuando deja de estar «cargando»
      vigiaPanel = new MutationObserver(function () { decidir(); });
      vigiaPanel.observe(p, { attributes: true, attributeFilter: ['class'] });
    }
    if (red.config !== 'ok' || p.classList.contains(SEL.cargando)) return;
    if (p.querySelector(SEL.error)) return terminar('sinred', 'No pudimos conectar. Revisá tu conexión.', true);
    preparar(p, b);
  }

  function preparar(p, boton) {
    panel = p;
    vigia.disconnect();
    vigiaPanel.disconnect();
    clearTimeout(limite);

    var abrir = function () { if (!panel.classList.contains(SEL.abierto)) boton.click(); };
    abrir();
    // Acá el chat es la pantalla: si algo lo cierra, se vuelve a abrir. (La cruz está escondida.)
    new MutationObserver(abrir).observe(panel, { attributes: true, attributeFilter: ['class'] });

    var cuerpo = panel.querySelector(SEL.cuerpo), cabeza = panel.querySelector(SEL.cabeza);
    if (cuerpo) new MutationObserver(function () { ultimoCambio = Date.now(); programarConteo(); })
      .observe(cuerpo, { childList: true, subtree: true, characterData: true });
    if (cabeza) new MutationObserver(programarConteo)
      .observe(cabeza, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
    // Tocar «adjuntar» abre el selector de archivos o la cámara, que tapan la app un buen rato.
    panel.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest(SEL.adjuntar)) eligiendoArchivo = Date.now();
    }, true);

    listo = true;
    mostrarEstado('listo');
    // Si había una conversación, el chat todavía la está trayendo. Si en diez segundos no llegó
    // (mala señal), se cuenta lo que haya: mejor eso que quedarse callado para siempre.
    setTimeout(function () { if (!red.historial) { red.historial = true; contar(); } }, 10000);
    contar();
    pendientes.splice(0).forEach(function (p2) { p2.hacer(); });
  }

  /* ── Qué hay en la conversación ───────────────────────────────────────────────────────────────
   *
   * Se mira cómo QUEDÓ la pantalla, no cada cambio: el chat mueve y vuelve a crear sus mensajes
   * (al cargar el historial los borra todos y los pinta de nuevo), y una respuesta larga del bot
   * sale en varias burbujas que después, en el historial, son una sola.
   *
   * Mientras el chat está trayendo una conversación que ya existía no se le cuenta nada a la app:
   * todavía no está en pantalla, y decir «no hay nada» le haría borrar lo que ya sabía (y avisar
   * dos veces por el mismo mensaje cuando por fin llega).
   */
  var relojConteo = 0;
  function programarConteo() { clearTimeout(relojConteo); relojConteo = setTimeout(contar, 300); }

  function textoDe(nodo) {
    var t = C.texto(nodo.innerText || nodo.textContent || '', 4000);
    return t || (nodo.querySelector('img, video, audio, a') ? 'Archivo adjunto' : '');
  }
  // ¿La conversación pasó a una persona del equipo? El chat lo dice en su encabezado.
  function caso() {
    var punto = panel.querySelector(SEL.punto), sub = panel.querySelector(SEL.subtitulo);
    var t = C.texto(sub ? sub.textContent : '', 60);
    if (punto && punto.classList.contains('espera')) return t || 'Derivado al equipo';
    return /^Te atiende /i.test(t) ? t : '';
  }
  function contar() {
    if (!listo || (habiaConversacion && !red.historial)) return;
    var nodos = panel.querySelectorAll(SEL.cuerpo + ' ' + SEL.mensaje);
    var ultimo = null, deEllos = null, corrida = '';
    for (var i = 0; i < nodos.length; i++) {
      var n = nodos[i], cl = n.classList;
      if (cl.contains(SEL.bienvenida) || cl.contains(SEL.sistema)) continue;   // el saludo y los avisos no son de nadie
      var t = textoDe(n);
      if (!t) continue;
      var rol = cl.contains(SEL.mio) ? 'yo' : cl.contains(SEL.equipo) ? 'equipo' : 'bot';
      var at = n.getAttribute('data-at') || '';
      ultimo = { rol: rol, texto: t.slice(0, 160), at: at };
      if (rol === 'yo') { corrida = ''; continue; }
      // La huella se saca de TODO lo que dijeron de corrido, no de la última burbuja: así da lo
      // mismo que la respuesta esté partida en tres burbujas (en vivo) o venga en una (al recargar).
      // Y lo que repite el final de lo ya dicho no se suma: cuando el chat no logra conectarse en
      // vivo, muestra dos veces la misma respuesta (una al recibirla y otra al consultar).
      var limpio = C.norm(t).replace(/\s+/g, '');
      if (corrida.slice(-limpio.length) !== limpio) corrida += limpio;
      deEllos = { rol: rol, at: at, huella: C.huella(corrida) };
    }
    avisar('mensajes', { ultimo: ultimo, deEllos: deEllos, caso: caso() });
  }

  /* ── Lo que pide la app ───────────────────────────────────────────────────────────────────── */
  function cuandoListo(hacer, envio) {
    if (listo) hacer();
    else if (!cerrado) pendientes.push({ hacer: hacer, envio: !!envio });
    else if (envio) avisar('sin-enviar', { motivo: 'fallo', escrito: false });
  }

  // Mandar un texto escrito fuera del chat es delicado: si hay un trámite a medias, el servidor lo
  // toma como la respuesta al paso pendiente. En ese caso (y si el chat está esperando un sí o un
  // no) NO se manda: se deja escrito en el campo, para que la persona decida.
  function traba() {
    if (red.tramite || panel.querySelector(SEL.tramite)) return 'tramite';
    if (panel.querySelector(SEL.pregunta)) return 'pregunta';
    return '';
  }
  function noEnviado(texto, motivo) {
    var campo = panel.querySelector(SEL.campo), escrito = false;
    if (campo) {
      if (!campo.value.trim()) { campo.value = texto; campo.dispatchEvent(new Event('input', { bubbles: true })); }
      escrito = campo.value === texto;
    }
    avisar('sin-enviar', { motivo: motivo, escrito: escrito });
  }
  function mandar(texto, vuelta) {
    if (yendose) return;
    var campo = panel.querySelector(SEL.campo), boton = panel.querySelector(SEL.enviar);
    if (!campo || !boton) return noEnviado(texto, 'fallo');
    var motivo = traba();
    if (motivo) return noEnviado(texto, motivo);
    if (campo.value.trim() && campo.value !== texto) return noEnviado(texto, 'borrador');   // lo que la persona tenía escrito no se pisa
    if (boton.disabled) {       // el chat está mandando otra cosa: no encola, hay que esperarlo
      if ((vuelta || 0) < 60) return void setTimeout(function () { mandar(texto, (vuelta || 0) + 1); }, 250);
      return noEnviado(texto, 'ocupado');
    }
    campo.value = texto;
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    boton.click();
    if (campo.value === '') avisar('enviado'); else noEnviado(texto, 'fallo');   // al mandar, el chat vacía el campo
  }
  // Un botón de arranque: si el chat lo está mostrando, se toca el del chat (que sabe abrir el
  // trámite que corresponda). Si no —la conversación ya empezó y el chat los sacó— se manda su
  // texto, que es lo mismo que hace el chat en el primer contacto.
  function tocarArranque(etiqueta, texto, vuelta) {
    if (yendose) return;
    var botones = panel.querySelectorAll(SEL.arranque);
    for (var i = 0; i < botones.length; i++) {
      if (C.texto(botones[i].textContent, 60) === etiqueta && botones[i].offsetParent !== null) { botones[i].click(); return avisar('enviado'); }
    }
    // Conversación sin empezar: los botones aparecen un momento después del saludo. Se los espera un poco.
    if (!panel.querySelector(SEL.cuerpo + ' .' + SEL.mio) && (vuelta || 0) < 8) {
      return void setTimeout(function () { tocarArranque(etiqueta, texto, (vuelta || 0) + 1); }, 250);
    }
    mandar(texto);
  }

  /* Ponerse al día: al volver a la app después de un rato, o cuando hubo consultas contestadas de
   * la copia. El chat no vuelve a pedir lo que llegó mientras estaba desconectado, así que se lo
   * recarga. NUNCA si la persona tiene algo a medias, porque el chat, al recargar, no lo vuelve a
   * dibujar: un formulario de reclamo a medio llenar, un archivo subiendo, un audio grabándose, el
   * selector de archivos o la cámara abiertos (por eso se recuerda cuándo tocó «adjuntar»). */
  var eligiendoArchivo = 0;
  function aMedias() {
    var campo = panel.querySelector(SEL.campo), boton = panel.querySelector(SEL.enviar);
    if ((campo && campo.value.trim()) || (boton && boton.disabled)) return true;
    if (panel.querySelector(SEL.aMedias)) return true;
    if (Date.now() - eligiendoArchivo < 5 * 60000) return true;
    var campos = panel.querySelectorAll('input:not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="hidden"]), textarea, select');
    for (var i = 0; i < campos.length; i++) if (String(campos[i].value || '').trim()) return true;
    return false;
  }
  function refrescar() {
    if (!listo || yendose || !C.hayConversacion(ent) || aMedias()) return;
    recargar();
  }

  // La app pide el foco en el campo (pantalla ancha, al elegir una conversación). Recién abierto,
  // el chat todavía no deja enfocar su campo: se insiste unas pocas veces, y se suelta si en el
  // medio este chat dejó de ser el que se ve.
  function darFoco(vuelta) {
    var campo = panel.querySelector(SEL.campo);
    if (!campo || !activo) return;
    focoDeFabrica.call(campo, { preventScroll: true });
    if (document.activeElement !== campo && vuelta < 5) setTimeout(function () { darFoco(vuelta + 1); }, 80);
  }

  window.addEventListener('message', function (e) {
    if (e.origin !== ORIGEN || e.source !== window.parent || yendose) return;
    var m = e.data;
    if (!m || m.app !== 'grupo') return;
    if (m.tipo === 'activar') {
      activo = !!m.activo;
      if (!activo) { soltarFoco(); callar(); return; }
      if (m.foco) cuandoListo(function () { darFoco(0); });
    } else if (m.tipo === 'teclado') {
      document.documentElement.classList.toggle('teclado', !!m.abierto);
    } else if (m.tipo === 'enviar' && typeof m.texto === 'string') {
      var t = C.texto(m.texto, 2000);
      if (t) cuandoListo(function () { mandar(t); }, true);
    } else if (m.tipo === 'arranque' && typeof m.etiqueta === 'string') {
      var etiqueta = C.texto(m.etiqueta, 60), texto = C.texto(typeof m.texto === 'string' ? m.texto : '', 200) || etiqueta;
      if (etiqueta) cuandoListo(function () { tocarArranque(etiqueta, texto); }, true);
    } else if (m.tipo === 'refrescar') {
      refrescar();
    }
  });

  avisar('hola', { version: C.VERSION });   // ya se puede hablar con este marco: la app contesta dónde está parado
}());
