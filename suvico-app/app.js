/*
 * Web app del grupo, versiones 3 y 4 — la app.
 *
 * La lógica es la de la versión 2 (ver v2/LEEME.md); acá cambian dos cosas. Una: se ve siempre una
 * cosa por vez (el inicio o un chat), también en pantalla grande, y las pestañas hacen de menú. Dos:
 * el movimiento. Pasar de una vista a otra es una transición (View Transitions donde el navegador
 * la tiene; si no, un cambio seco con entrada), la marca de la pestaña elegida se desliza y el campo
 * de consulta va mostrando ejemplos. Cómo se ve cada cosa lo decide la hoja de estilos de la piel.
 *
 * Una sola página con el inicio y los chats:
 *   ./            → inicio: escribir una consulta, elegir un tema o una conversación
 *   ./?e=<slug>   → el chat de esa entidad
 *
 * Cada chat vive en su propio marco (charla.html), que se crea la primera vez que hace falta y
 * después queda vivo aunque no se vea. Por eso pasar de un chat a otro es instantáneo y la app
 * puede avisar «te contestaron» de una conversación que no se está mirando.
 *
 * La app y los marcos se hablan con mensajes (postMessage, mismo origen):
 *   marco → app:  hola · estado (cargando|listo|no|sinred|fallo) · mensajes · enviado · sin-enviar
 *   app → marco:  activar · teclado · enviar (una consulta) · arranque (un botón del chat) · refrescar
 *
 * La app nunca lee ni copia lo que se habló con una entidad para llevarlo a otra: lo único que
 * viaja es lo que la persona escribe en el campo del inicio, y adonde ella lo manda.
 */
(function () {
  'use strict';

  var C = window.Comun, G = C.grupo, ORIGEN = location.origin;
  var $ = function (id) { return document.getElementById(id); };
  var app = $('app');
  // Pantalla cómoda (escritorio): al entrar a un chat, el foco va derecho a su campo de texto. En el
  // teléfono no, porque eso abriría el teclado sin que nadie lo pida.
  var COMODA = window.matchMedia('(min-width: 900px)');
  var QUIETO = window.matchMedia('(prefers-reduced-motion: reduce)');   // la persona pidió menos movimiento
  // Cada conversación que nace acá va marcada, para que se pueda saber que llegó por la app.
  // (Hoy la plataforma no guarda esa marca para estas tres entidades: ver LEEME.)
  var PROCEDENCIA = '&utm_source=app_grupo&utm_medium=pwa';

  /* ── Estado ───────────────────────────────────────────────────────────────────────────────── */
  var E = G.entidades.map(function (ent) {
    var g = C.configGuardada(ent), v = C.leerJSON(C.PRE + 'visto_' + ent.slug);
    return {
      ent: ent,
      cfg: (g && g.cfg) || null,
      disponible: g && g.no && g.fresca ? false : null,     // null = todavía no se sabe
      marco: null, conectado: false, cola: [], focoPendiente: false, estadoMarco: '',
      enVuelo: null,      // lo último que se le pidió mandar al marco y todavía no confirmó
      ultimo: null,       // el último mensaje de la conversación: { rol, texto, at }
      deEllos: null,      // el último que NO es de la persona: { rol, at, huella }
      caso: '',           // «Derivado al equipo», «Te atiende Ana»: la conversación pasó a una persona
      novedad: false, anunciada: false,
      visto: { t: Number(v && v.t) || 0, h: String((v && v.h) || '') },
      dom: {}
    };
  });
  var vista = 'inicio';
  var teclado = false;
  var enLinea = navigator.onLine !== false;
  var consulta = { texto: '', enviadaA: [], situacion: '' };

  function porSlug(slug) { for (var i = 0; i < E.length; i++) if (E[i].ent.slug === slug) return E[i]; return null; }
  function algunaConversacion() { return E.some(function (e) { return C.hayConversacion(e.ent); }); }
  function el(etiqueta, clase, texto) {
    var n = document.createElement(etiqueta);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }
  function svg(d, lado) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', lado || 22); s.setAttribute('height', lado || 22); s.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d); p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '2');
    p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
    s.appendChild(p);
    return s;
  }
  // La flecha de «ir» la elige la piel: corta (un ángulo) o larga (una flecha entera).
  var FLECHA = app.getAttribute('data-flecha') === 'larga' ? 'M5 12h14M13 6l6 6-6 6' : 'M9 5l7 7-7 7';
  var CASA = 'M4 11l8-7 8 7M6 10v9h12v-9', AVION = 'M4 12l16-7-6 16-3-7-7-2z';
  // Un dibujo por tema del inicio (los «id» de «situaciones» en entidades.js). Un tema nuevo sin
  // dibujo lleva el genérico.
  var ICONOS = {
    trabajo: 'M4 8h16v11H4zM9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M4 13h16',
    salud: 'M10.5 20.5l10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7zM8.5 8.5l7 7',
    familia: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.2a3.5 3.5 0 0 1 0 6.6',
    beneficios: 'M22 10L12 5 2 10l10 5 10-5zM6 12v5c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-5',
    afiliacion: 'M3 6h18v12H3zM8.5 12.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5.5 15.8c.5-1.4 1.6-2.1 3-2.1s2.5.7 3 2.1M14.5 10h4M14.5 13.5h4',
    otro: 'M5 6h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7l-4 3v-3H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z'
  };
  function flecha(d) { var f = el('span', 'fila-flecha'); f.appendChild(svg(d || FLECHA)); return f; }
  function enumerar(nombres) {
    return nombres.length < 2 ? nombres.join('') : nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1];
  }

  // El logo de la entidad (o su inicial) y su color.
  function ponerAvatar(nodo, e) {
    var c = (e.cfg && e.cfg.color) || e.ent.color;
    nodo.style.setProperty('--marca', c);
    nodo.style.setProperty('--marca-tinta', C.tintaSobre(c));
    var logo = (e.cfg && e.cfg.logo) || '';
    if (nodo.getAttribute('data-logo') === logo) return;
    nodo.setAttribute('data-logo', logo);
    nodo.textContent = '';
    nodo.classList.toggle('con-logo', !!logo);
    if (!logo) { nodo.textContent = e.ent.nombre.charAt(0); return; }
    var img = new Image();
    img.alt = '';
    img.onerror = function () { nodo.textContent = e.ent.nombre.charAt(0); nodo.classList.remove('con-logo'); };
    img.src = logo;
    nodo.appendChild(img);
  }
  function avatar(e, clase) {
    var n = el('span', 'avatar' + (clase ? ' ' + clase : ''));
    n.setAttribute('aria-hidden', 'true');
    ponerAvatar(n, e);
    return n;
  }
  // «SUVICO · Tu sueldo», con el logo chiquito adelante: de quién es una pregunta.
  function deQuien(e, detalle) {
    var n = el('span', 'fila-previa');
    n.appendChild(avatar(e, 'minimo'));
    n.appendChild(el('span', null, e.ent.nombre + ' · ' + detalle));
    return n;
  }

  function hora(ms) {
    var d = new Date(ms), hoy = new Date(), ayer = new Date(hoy);
    ayer.setDate(hoy.getDate() - 1);
    if (d.toDateString() === hoy.toDateString()) return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
    if (d.toDateString() === ayer.toDateString()) return 'ayer';
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  }
  // El punto de «hay algo nuevo», con su frase para el lector de pantalla.
  function ponerPunto(caja, si) {
    caja.textContent = '';
    if (!si) return;
    var p = el('span', 'punto');
    p.setAttribute('aria-hidden', 'true');
    caja.appendChild(p);
    caja.appendChild(el('span', 'solo-lector', 'Mensaje nuevo'));
  }

  /* ── Inicio: las conversaciones ───────────────────────────────────────────────────────────── */
  function armarConversaciones() {
    var ul = $('conversaciones');
    E.forEach(function (e, i) {
      var li = el('li'), a = el('a', 'fila');
      li.style.setProperty('--i', i);        // su turno al entrar: la hoja de estilos escalona con esto
      a.addEventListener('click', function (ev) {
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button) return;   // abrir en otra pestaña: que funcione
        ev.preventDefault();
        if (a.getAttribute('aria-disabled') !== 'true') navegar(e.ent.slug);
      });
      var av = avatar(e);
      var txt = el('span', 'fila-texto'), nombre = el('span', 'fila-nombre'), que = el('span', 'fila-que'), previa = el('span', 'fila-previa');
      nombre.appendChild(el('span', null, e.ent.nombre));
      nombre.appendChild(que);
      txt.appendChild(nombre); txt.appendChild(previa);
      var meta = el('span', 'fila-meta'), cuando = el('span'), punto = el('span'), fl = flecha();
      meta.appendChild(cuando); meta.appendChild(punto); meta.appendChild(fl);
      a.appendChild(av); a.appendChild(txt); a.appendChild(meta);
      li.appendChild(a); ul.appendChild(li);
      e.dom.fila = a; e.dom.avatar = av; e.dom.que = que; e.dom.previa = previa; e.dom.cuando = cuando; e.dom.punto = punto; e.dom.flecha = fl;
      pintarFila(e);
    });
  }

  function pintarFila(e) {
    var d = e.dom;
    var sinChat = !e.marco || e.estadoMarco !== 'listo';       // sin conexión sólo sirve un chat que ya estaba abierto
    var apagada = e.disponible === false || (!enLinea && sinChat);
    ponerAvatar(d.avatar, e);
    d.fila.style.setProperty('--marca', (e.cfg && e.cfg.color) || e.ent.color);   // la fila entera toma el color de la entidad
    d.que.textContent = e.caso || e.ent.que;
    var linea;
    if (e.disponible === false) linea = 'No disponible por ahora';
    else if (!enLinea && sinChat) linea = 'Sin conexión';
    else if (e.ultimo && e.ent.reservada) linea = e.ultimo.rol === 'yo' ? 'Escribiste vos' : e.ultimo.rol === 'equipo' ? 'Te contestó una persona del equipo' : 'Te contestaron';
    else if (e.ultimo) linea = (e.ultimo.rol === 'yo' ? 'Vos: ' : '') + e.ultimo.texto;
    else if (C.hayConversacion(e.ent)) linea = 'Seguir la conversación';
    else linea = e.ent.temas;
    d.previa.textContent = linea;
    d.cuando.textContent = e.ultimo && e.ultimo.at && !apagada ? hora(e.ultimo.at) : '';
    ponerPunto(d.punto, e.novedad);
    d.flecha.hidden = e.novedad || apagada;
    d.fila.classList.toggle('con-novedad', e.novedad);
    if (apagada) { d.fila.setAttribute('aria-disabled', 'true'); d.fila.removeAttribute('href'); }
    else { d.fila.removeAttribute('aria-disabled'); d.fila.href = '?e=' + e.ent.slug; }
    if (vista === e.ent.slug) d.fila.setAttribute('aria-current', 'true'); else d.fila.removeAttribute('aria-current');
  }

  /* ── Inicio: lo más pedido y los temas ────────────────────────────────────────────────────── */
  // «Lo más pedido» son los botones de arranque que cada entidad ya tiene en su chat. Se rehacen
  // sólo si cambiaron: rehacerlos con cada mensaje le sacaría el foco a quien navega con teclado.
  var firmaPedidos = null;
  function pintarPedidos() {
    var items = [];
    E.forEach(function (e) {
      if (e.disponible === false || !e.cfg) return;
      e.cfg.intenciones.slice(0, 4).forEach(function (i) { items.push({ e: e, i: i }); });   // hasta cuatro por entidad: que ninguna tape a las otras
    });
    var firma = JSON.stringify(items.map(function (x) { return [x.e.ent.slug, x.i.etiqueta, x.e.cfg.logo, x.e.cfg.color]; }));
    if (firma === firmaPedidos) return;
    firmaPedidos = firma;
    var cont = $('pedidos-lista'), renglon = null, de = '';
    cont.textContent = '';
    items.forEach(function (x, i) {
      // Un renglón por entidad. En el teléfono cada renglón se desliza de costado (doce botones
      // apilados eran una pantalla entera); en pantalla grande la piel los junta de nuevo.
      if (x.e.ent.slug !== de) {
        de = x.e.ent.slug;
        renglon = el('div', 'temas-fila');
        renglon.setAttribute('role', 'group');
        renglon.setAttribute('aria-label', x.e.ent.nombre);
        cont.appendChild(renglon);
      }
      var b = el('button', 'tema');
      b.type = 'button';
      b.style.setProperty('--i', i);
      b.appendChild(avatar(x.e, 'minimo'));
      b.appendChild(el('span', null, x.i.etiqueta));
      b.appendChild(el('span', 'solo-lector', ', ' + x.e.ent.nombre));
      b.addEventListener('click', function () { arrancar(x.e, x.i); });
      renglon.appendChild(b);
    });
    $('pedidos').hidden = !items.length;
  }

  // «Por tema»: las situaciones de entidades.js que tengan alguna pregunta de una entidad disponible.
  var firmaSituaciones = null;
  function pintarSituaciones() {
    var filas = (G.situaciones || []).map(function (s) {
      return { s: s, quienes: E.filter(function (e) { return e.disponible !== false && (e.ent.consultas || []).some(function (c) { return c.sit === s.id; }); }) };
    }).filter(function (x) { return x.quienes.length; });
    var firma = JSON.stringify(filas.map(function (x) { return [x.s.id, x.quienes.map(function (e) { return e.ent.slug; })]; }));
    if (firma === firmaSituaciones) return;
    firmaSituaciones = firma;
    var ul = $('situaciones-lista');
    ul.textContent = '';
    filas.forEach(function (x, i) {
      var li = el('li'), b = el('button', 'fila fila-situacion');
      b.type = 'button';
      li.style.setProperty('--i', i);
      var ic = el('span', 'fila-ic');
      ic.setAttribute('aria-hidden', 'true');
      ic.appendChild(svg(ICONOS[x.s.id] || ICONOS.otro, 22));
      b.appendChild(ic);
      var txt = el('span', 'fila-texto');
      txt.appendChild(el('span', 'fila-nombre', x.s.nombre));
      txt.appendChild(el('span', 'fila-previa', enumerar(x.quienes.map(function (e) { return e.ent.nombre; }))));
      b.appendChild(txt); b.appendChild(flecha());
      b.addEventListener('click', function () { abrirSituacion(x.s.id); });
      li.appendChild(b); ul.appendChild(li);
    });
    $('situaciones').hidden = !filas.length;
  }

  function pintarPortada() {
    var alguna = algunaConversacion();
    $('conv-rotulo').textContent = alguna ? 'Tus conversaciones' : 'Con quién hablar';
    $('conv-nota').hidden = !alguna;
    $('olvidar').hidden = !alguna;
    if (!alguna) $('olvidar-caja').hidden = true;
    ofrecerInstalar();
  }

  /* ── Pestañas (teléfono) ──────────────────────────────────────────────────────────────────── */
  var pestanaInicio = null;
  // La marca de la pestaña elegida es una pieza suelta (la «luz») que se desliza de una pestaña a
  // otra. Acá se le dice dónde va y de qué tamaño; cómo se ve y cómo se mueve lo decide la piel.
  var luz = null;
  function ubicarLuz() {
    if (!luz) return;
    var nav = $('pestanas'), actual = nav.querySelector('.pestana[aria-current="page"]');
    if (!actual || !actual.offsetWidth) return;          // con el teclado abierto las pestañas no están
    nav.style.setProperty('--luz-x', actual.offsetLeft + 'px');
    nav.style.setProperty('--luz-y', actual.offsetTop + 'px');
    nav.style.setProperty('--luz-w', actual.offsetWidth + 'px');
    nav.style.setProperty('--luz-h', actual.offsetHeight + 'px');
    nav.classList.add('con-luz');
  }
  function armarPestanas() {
    var nav = $('pestanas');
    luz = el('span', 'pestanas-luz');
    luz.setAttribute('aria-hidden', 'true');
    nav.appendChild(luz);
    pestanaInicio = el('a', 'pestana');
    pestanaInicio.href = './';
    var ico = el('span', 'icono'); ico.appendChild(svg(CASA, 24));
    pestanaInicio.appendChild(ico); pestanaInicio.appendChild(el('span', 'nombre', 'Inicio'));
    pestanaInicio.addEventListener('click', function (ev) { ev.preventDefault(); navegar('inicio'); });
    nav.appendChild(pestanaInicio);
    E.forEach(function (e) {
      var a = el('a', 'pestana'), icono = el('span', 'icono'), av = avatar(e, 'chico'), punto = el('span');
      icono.appendChild(av);
      a.appendChild(icono); a.appendChild(el('span', 'nombre', e.ent.nombre)); a.appendChild(punto);
      a.addEventListener('click', function (ev) { ev.preventDefault(); if (a.getAttribute('aria-disabled') !== 'true') navegar(e.ent.slug); });
      nav.appendChild(a);
      e.dom.pestana = a; e.dom.pestanaAvatar = av; e.dom.pestanaPunto = punto;
    });
    pintarPestanas();
  }
  function pintarPestanas() {
    if (vista === 'inicio') pestanaInicio.setAttribute('aria-current', 'page'); else pestanaInicio.removeAttribute('aria-current');
    E.forEach(function (e) {
      var d = e.dom, apagada = e.disponible === false || (!enLinea && (!e.marco || e.estadoMarco !== 'listo'));
      ponerAvatar(d.pestanaAvatar, e);
      d.pestana.style.setProperty('--marca', (e.cfg && e.cfg.color) || e.ent.color);
      if (vista === e.ent.slug) d.pestana.setAttribute('aria-current', 'page'); else d.pestana.removeAttribute('aria-current');
      if (apagada) { d.pestana.setAttribute('aria-disabled', 'true'); d.pestana.removeAttribute('href'); }
      else { d.pestana.removeAttribute('aria-disabled'); d.pestana.href = '?e=' + e.ent.slug; }
      ponerPunto(d.pestanaPunto, e.novedad);
    });
    ubicarLuz();
  }

  // Cuántas conversaciones tienen algo nuevo: en el título de la pestaña y en el ícono de la app instalada.
  function pintarTitulo() {
    var total = E.filter(function (e) { return e.novedad; }).length;
    var actual = vista === 'inicio' ? null : porSlug(vista);
    document.title = (total ? '(' + total + ') ' : '') + (actual ? actual.ent.nombre + ' · ' : '') + G.nombre;
    try {
      if (total && navigator.setAppBadge) navigator.setAppBadge(total);
      else if (!total && navigator.clearAppBadge) navigator.clearAppBadge();
    } catch (err) {}
  }

  // Los logos de las tres entidades, sueltos, donde la piel los pida (un elemento con «data-quienes»):
  // es un adorno que dice quiénes contestan. La piel que no lo pide no lleva nada.
  var quienes = [];
  function armarQuienes() {
    var caja = document.querySelector('[data-quienes]');
    if (!caja) return;
    E.forEach(function (e, i) {
      var n = avatar(e);
      n.style.setProperty('--i', i);
      caja.appendChild(n);
      quienes.push({ e: e, nodo: n });
    });
  }
  function pintarQuienes() { quienes.forEach(function (q) { ponerAvatar(q.nodo, q.e); }); }

  function pintar(e) { pintarFila(e); pintarPestanas(); pintarPedidos(); pintarSituaciones(); pintarPortada(); pintarQuienes(); pintarTitulo(); }
  function pintarTodo() { E.forEach(pintarFila); pintarPestanas(); pintarPedidos(); pintarSituaciones(); pintarPortada(); pintarQuienes(); pintarTitulo(); }

  /* ── Los marcos de los chats ──────────────────────────────────────────────────────────────── */
  function asegurarMarco(e) {
    if (e.marco || e.disponible === false) return;
    var f = document.createElement('iframe');
    f.className = 'marco';
    f.title = 'Chat con ' + e.ent.nombre;
    f.setAttribute('allow', 'microphone; autoplay; fullscreen; picture-in-picture; encrypted-media');
    f.setAttribute('aria-hidden', 'true');
    f.setAttribute('inert', '');
    f.tabIndex = -1;
    f.src = 'charla.html?e=' + encodeURIComponent(e.ent.slug) + PROCEDENCIA;
    $('marcos').appendChild(f);
    e.marco = f;
  }
  function decir(e, m) {
    if (!e.marco) return;
    m.app = 'grupo';
    var esEnvio = m.tipo === 'enviar' || m.tipo === 'arranque';
    if (esEnvio) e.enVuelo = m;      // hasta que el marco diga «enviado» o «sin-enviar»
    // Antes de que el marco salude (o mientras se recarga) no escucha. Lo que la persona pidió
    // mandar se guarda; lo demás (dónde está parado, el teclado) se le cuenta cuando salude.
    if (!e.conectado) { if (esEnvio && e.cola.indexOf(m) < 0) e.cola.push(m); return; }
    try { e.marco.contentWindow.postMessage(m, ORIGEN); } catch (err) {}
  }
  // Lo que hay que decirle a un marco cuando cambia la vista: si es el que se está viendo, si se
  // le da el foco (sólo en pantalla cómoda: en el teléfono eso abriría el teclado) y cómo está el
  // teclado. Esto es lógica y se hace en el momento.
  function avisarSitio(e, conFoco, focoDespues) {
    if (!e.marco) return;
    var si = vista === e.ent.slug;
    if (si && conFoco && !e.conectado) e.focoPendiente = true;
    // «focoDespues»: el foco se pide aparte, cuando el marco ya se ve (ver «mostrar»). Pedírselo
    // antes es pedírselo a un marco todavía inerte, y sólo lo salvaban los reintentos.
    decir(e, { tipo: 'activar', activo: si, foco: si && !!conFoco && !focoDespues && COMODA.matches });
    if (si) decir(e, { tipo: 'teclado', abierto: teclado });
  }
  // Y lo que se ve: cuál de los marcos está a la vista. Va aparte porque, cuando el cambio de
  // vista lleva transición, esto se hace adentro de ella (ver «conMovimiento»).
  function pintarSitio(e) {
    if (!e.marco) return;
    var si = vista === e.ent.slug;
    e.marco.classList.toggle('activo', si);
    if (si) { e.marco.removeAttribute('inert'); e.marco.removeAttribute('aria-hidden'); e.marco.tabIndex = 0; }
    else { e.marco.setAttribute('inert', ''); e.marco.setAttribute('aria-hidden', 'true'); e.marco.tabIndex = -1; }
  }
  function situar(e, conFoco) { avisarSitio(e, conFoco); pintarSitio(e); }

  window.addEventListener('message', function (ev) {
    if (ev.origin !== ORIGEN) return;
    var m = ev.data;
    if (!m || m.app !== 'grupo' || typeof m.slug !== 'string') return;
    var e = porSlug(m.slug);
    if (!e || !e.marco || ev.source !== e.marco.contentWindow) return;

    if (m.tipo === 'hola') {            // el marco (re)cargó y ya escucha: se le dice dónde está parado
      // Recién publicada una versión puede cargar un marco nuevo dentro de la app vieja (o al revés).
      // Si no hablan lo mismo, la app se recarga una vez para quedar pareja.
      var yaRecargo = true;
      try { yaRecargo = !!sessionStorage.getItem(C.PRE + 'recargada'); if (m.version !== C.VERSION) sessionStorage.setItem(C.PRE + 'recargada', '1'); } catch (err) {}
      if (m.version !== C.VERSION && !yaRecargo) { location.reload(); return; }
      e.conectado = true;
      var conFoco = e.focoPendiente;
      e.focoPendiente = false;
      situar(e, conFoco);
      e.cola.splice(0).forEach(function (p) { decir(e, p); });
    } else if (m.tipo === 'adios') {    // el marco se está recargando: hasta que salude de nuevo no escucha
      e.conectado = false;
      // Lo que se le había pedido mandar y no llegó a confirmar se le vuelve a pedir cuando salude.
      if (e.enVuelo && e.cola.indexOf(e.enVuelo) < 0) e.cola.push(e.enVuelo);
    } else if (m.tipo === 'estado') {
      e.estadoMarco = String(m.estado || '');
      if (m.estado === 'no') { e.disponible = false; e.ultimo = null; e.deEllos = null; e.caso = ''; e.novedad = false; }
      pintar(e);
    } else if (m.tipo === 'mensajes') {
      recibirMensajes(e, m);
    } else if (m.tipo === 'enviado') {
      // Recién ahora se sabe que la consulta escrita en el inicio salió: se la marca como enviada.
      var hecho = e.enVuelo;
      e.enVuelo = null;
      if (hecho && hecho.deInicio && hecho.texto === consulta.texto.trim() && consulta.enviadaA.indexOf(e.ent.slug) < 0) {
        consulta.enviadaA.push(e.ent.slug);
        recordarConsulta();
        pintarResultados();
      }
    } else if (m.tipo === 'sin-enviar') {
      e.enVuelo = null;
      notar(porQueNoSeEnvio(e, m));
    }
  });

  function rolDe(r) { return r === 'yo' ? 'yo' : r === 'equipo' ? 'equipo' : 'bot'; }
  function recibirMensajes(e, m) {
    var u = m.ultimo, d = m.deEllos;
    e.ultimo = u && typeof u === 'object' ? { rol: rolDe(u.rol), texto: C.texto(String(u.texto || ''), 160), at: Date.parse(u.at) || 0 } : null;
    e.deEllos = d && typeof d === 'object' ? { rol: rolDe(d.rol), at: Date.parse(d.at) || 0, huella: String(d.huella || '').slice(0, 16) } : null;
    e.caso = C.texto(typeof m.caso === 'string' ? m.caso : '', 60);
    contarNovedad(e);
    // Se avisa una sola vez por novedad. (El marco no cuenta nada hasta terminar de traer lo que
    // había de antes, así que lo que llega acá ya es el estado de verdad.)
    if (e.novedad && !e.anunciada) { e.anunciada = true; anunciar(e); }
    pintar(e);
  }

  /* ── ¿Hay algo nuevo? ─────────────────────────────────────────────────────────────────────────
   *
   * Se guarda, por entidad, una huella de lo último que dijeron ellos y que la persona ya vio (la
   * huella, no el texto) y la hora de ese mensaje. Hay novedad si lo último que dijeron es OTRA
   * cosa: se decide por la huella y no por la hora.
   *
   * No se puede decidir por la hora porque el chat mezcla dos relojes: a las respuestas del bot les
   * pone la hora del TELÉFONO cuando las pinta, y a las de una persona del equipo y a todo lo que
   * vuelve a traer al recargar, la del SERVIDOR. Con el reloj del teléfono adelantado, la respuesta
   * de una persona podía quedar «antes» de lo ya visto y no avisarse nunca.
   *
   * La hora queda sólo para un caso: que vuelvan a decir exactamente lo mismo bastante después.
   */
  function seEstaViendo(e) { return vista === e.ent.slug && document.visibilityState === 'visible'; }
  function contarNovedad(e) {
    var d = e.deEllos;
    if (d && seEstaViendo(e) && (d.huella !== e.visto.h || d.at !== e.visto.t)) {
      e.visto = { t: d.at, h: d.huella };
      C.guardar(C.PRE + 'visto_' + e.ent.slug, JSON.stringify(e.visto));
    }
    e.novedad = !!d && (d.huella !== e.visto.h || d.at - e.visto.t > 3 * 60000);
    if (!e.novedad) e.anunciada = false;
  }

  // Al arrancar se abren de fondo los chats que ya tienen una conversación, de a uno, para poder
  // mostrar el último mensaje y si hay algo nuevo. Los demás se abren recién cuando se los elige.
  // Con el ahorro de datos del teléfono activado no se abre ninguno de fondo.
  function precargar() {
    if (!enLinea || (navigator.connection && navigator.connection.saveData)) return;
    var faltan = E.filter(function (e) { return !e.marco && e.disponible !== false && C.hayConversacion(e.ent); });
    (function siguiente() {
      var e = faltan.shift();
      if (!e) return;
      asegurarMarco(e);
      setTimeout(siguiente, 1200);
    }());
  }

  /* ── Ir de una vista a otra ───────────────────────────────────────────────────────────────────
   *
   * Cambiar de vista tiene dos mitades. La LÓGICA (cuál es la vista, crear el marco, avisarles a
   * los chats, dar por vista una novedad) se hace siempre en el momento: lo que sigue —mandar la
   * consulta al chat recién elegido, por ejemplo— cuenta con que ya pasó. Lo que SE VE (qué está
   * a la vista, qué pestaña está marcada) puede ir adentro de una transición.
   *
   * La transición usa View Transitions: el navegador saca una foto de cómo estaba, aplica el
   * cambio y funde una cosa con la otra como diga la hoja de estilos («data-ir» en <html> le dice
   * hacia dónde se va: entrar, volver, der o izq). Donde no existe, o si la persona pidió menos
   * movimiento, el cambio es seco. No se usa al abrir la app ni en los cambios que no pidió nadie.
   */
  var CON_VT = typeof document.startViewTransition === 'function';
  var arrancado = false, turno = 0;
  if (CON_VT) document.documentElement.classList.add('con-vt');
  function sentido(desde, hacia) {
    if (desde === 'inicio') return 'entrar';
    if (hacia === 'inicio') return 'volver';
    var a = -1, b = -1;
    E.forEach(function (e, i) { if (e.ent.slug === desde) a = i; if (e.ent.slug === hacia) b = i; });
    return b > a ? 'der' : 'izq';
  }
  function conMovimiento(desde, hacia, pintarVista) {
    var raiz = document.documentElement;
    if (!CON_VT || !arrancado || QUIETO.matches || desde === hacia || document.visibilityState !== 'visible') { pintarVista(); return; }
    var mio = ++turno, t = null;
    raiz.setAttribute('data-ir', sentido(desde, hacia));
    try { t = document.startViewTransition(pintarVista); } catch (err) { t = null; }
    if (!t) { raiz.removeAttribute('data-ir'); pintarVista(); return; }
    var soltar = function () { if (mio === turno) raiz.removeAttribute('data-ir'); };
    t.finished.then(soltar, soltar);
  }
  // Pinta la vista ACTUAL (no la que se pidió cuando se armó la transición: si en el medio hubo
  // otro cambio, vale el último).
  function pintarVista() {
    app.setAttribute('data-vista', vista);
    E.forEach(pintarSitio);
    E.forEach(pintarFila);
    pintarPestanas();
  }
  function mostrar(v, conFoco, animada, alTerminar) {
    var e = v === 'inicio' ? null : porSlug(v);
    if (!e || e.disponible === false) { v = 'inicio'; e = null; }
    var desde = vista;
    vista = v;
    if (e) asegurarMarco(e);
    E.forEach(function (x) { avisarSitio(x, conFoco, true); });
    if (e) { contarNovedad(e); ocultarNovedad(e); }
    pintarTitulo();
    var pintarYSeguir = function () {
      pintarVista();
      var actual = vista === 'inicio' ? null : porSlug(vista);
      if (actual && conFoco && COMODA.matches) decir(actual, { tipo: 'activar', activo: true, foco: true });
      if (alTerminar) alTerminar();
    };
    if (animada) conMovimiento(desde, v, pintarYSeguir); else pintarYSeguir();
  }
  // Un toque de la persona. Entrar a un chat desde el inicio apila una entrada en el historial, así
  // «atrás» vuelve al inicio; pasar de un chat a otro no apila nada.
  function navegar(v) {
    if (v === vista) return;
    var desde = vista, apilado = !!(history.state && history.state.apilado);
    if (v === 'inicio') {
      if (apilado) { history.back(); return; }      // sigue en «popstate»
      history.replaceState({ v: 'inicio' }, '', './');
    } else if (vista === 'inicio') {
      history.pushState({ v: v, apilado: true }, '', '?e=' + v);
    } else {
      history.replaceState({ v: v, apilado: apilado }, '', '?e=' + v);
    }
    mostrar(v, true, true, function () { acomodarFoco(desde, vista); });
  }
  // Al cambiar de vista, lo que tenía el foco queda escondido. Se lo lleva a lo que se ve ahora:
  // al marco del chat (al marco, no a su campo: eso abriría el teclado) o, al volver, a la fila de
  // donde se salió. En pantalla cómoda, al entrar a un chat el foco lo toma su campo (ver «avisarSitio»).
  function acomodarFoco(desde, hacia) {
    var e = hacia === 'inicio' ? porSlug(desde) : porSlug(hacia), destino = null;
    if (!e) return;
    // En pantalla cómoda, con el chat ya listo, el foco lo toma su campo. Si todavía carga (o no
    // pudo abrir), se lo lleva al marco: si no quedaría en el inicio, que ya no se ve.
    if (hacia !== 'inicio') { if (COMODA.matches && e.conectado && e.estadoMarco === 'listo') return; destino = e.marco; }
    else destino = $('portada').hidden ? $('consulta-borrar') : e.dom.fila;
    try { if (destino) destino.focus({ preventScroll: true }); } catch (err) {}
  }
  function vistaDeLaUrl() {
    var e = C.entidad(new URLSearchParams(location.search).get('e'));
    return e ? e.slug : 'inicio';
  }
  // «Atrás» y «adelante». Si el navegador ya hizo su propia animación (el gesto de deslizar en el
  // iPhone), no se le suma otra encima.
  window.addEventListener('popstate', function (ev) {
    var desde = vista;
    mostrar(vistaDeLaUrl(), false, !(ev && ev.hasUAVisualTransition), function () { acomodarFoco(desde, vista); });
  });

  /* ── Mandar algo a un chat ────────────────────────────────────────────────────────────────── */
  function haySalida() {
    if (enLinea) return true;
    notar('Sin conexión. Probá de nuevo cuando vuelva.');
    return false;
  }
  // Lo que la persona escribió en el inicio, a quien ella elige. El texto queda en el campo: si no
  // era para esa entidad, vuelve al inicio y se lo manda a otra sin escribirlo de nuevo.
  function preguntar(e, texto) {
    if (!haySalida()) return;
    // A una entidad reservada (la obra social) la consulta no queda escrita en el inicio.
    if (e.ent.reservada) limpiarConsulta();
    navegar(e.ent.slug);
    decir(e, { tipo: 'enviar', texto: texto, deInicio: !e.ent.reservada });   // «enviada» se marca cuando el marco confirma
  }
  // Una pregunta de ejemplo de la entidad (del buscador o de un tema).
  function consultar(e, texto) {
    if (!haySalida()) return;
    limpiarConsulta();
    navegar(e.ent.slug);
    decir(e, { tipo: 'enviar', texto: texto });
  }
  // Un botón de arranque del chat de la entidad.
  function arrancar(e, intencion) {
    if (intencion.enlace) { window.open(intencion.enlace, '_blank', 'noopener,noreferrer'); return; }
    if (!haySalida()) return;
    limpiarConsulta();
    navegar(e.ent.slug);
    decir(e, { tipo: 'arranque', etiqueta: intencion.etiqueta, texto: intencion.texto });
  }
  function porQueNoSeEnvio(e, m) {
    var quedo = m.escrito ? ' Tu consulta quedó escrita abajo: mandala cuando quieras.' : ' Tu consulta no se mandó.';
    if (m.motivo === 'tramite') return 'Tenés un trámite sin terminar con ' + e.ent.nombre + '.' + quedo;
    if (m.motivo === 'pregunta') return e.ent.nombre + ' te hizo una pregunta y espera tu respuesta.' + quedo;
    if (m.motivo === 'borrador') return 'Ya tenías algo escrito en este chat y no lo pisamos. Tu consulta no se mandó.';
    if (m.motivo === 'fallo' && !m.escrito) return 'No pudimos abrir el chat de ' + e.ent.nombre + '. Tu consulta no se mandó: probá de nuevo.';
    return 'No pudimos mandar tu consulta.' + (m.escrito ? ' Quedó escrita abajo: tocá enviar.' : ' Probá de nuevo.');
  }

  /* ── El campo de consulta ─────────────────────────────────────────────────────────────────────
   *
   * Busca entre lo que cada entidad ya ofrece: los botones de arranque de su chat y las preguntas
   * de ejemplo de su página. No interpreta ni decide: muestra coincidencias, dice de quién es cada
   * una, y la persona elige. Si nada coincide, ella elige igual a quién mandarle lo que escribió.
   */
  var VACIAS = ' que como para por con sin una uno unos unas los las del mis tus sus hay soy estoy esta este esto eso esa tengo tiene quiero quisiera necesito puedo puede hacer hago saber donde cuando cuanto cual porque pero muy mas les nos hola buenas buen dia tardes noches gracias favor consulta consultar sobre algo alguien ';
  function palabrasDe(q) {
    return C.norm(q).split(/[^a-z0-9]+/).filter(function (p) { return p.length >= 3 && VACIAS.indexOf(' ' + p + ' ') < 0; })
      .map(function (p) { return p.length > 4 && p.charAt(p.length - 1) === 's' ? p.slice(0, -1) : p; });   // «medicamentos» encuentra «medicamento»
  }
  function recordarConsulta() { try { sessionStorage.setItem(C.PRE + 'consulta', JSON.stringify(consulta)); } catch (err) {} }

  function buscar(q) {
    var palabras = palabrasDe(q), hallados = [], cercanas = {};
    if (!palabras.length) return { temas: [], cercanas: cercanas };
    var minimo = Math.ceil(palabras.length / 2);
    function aciertos(donde) { return palabras.filter(function (p) { return donde.indexOf(p) >= 0; }).length; }
    E.forEach(function (e) {
      if (e.disponible === false) return;
      var vistos = {};
      ((e.cfg && e.cfg.intenciones) || []).forEach(function (i) {
        var n = aciertos(C.norm(i.etiqueta + ' ' + i.texto));
        vistos[C.norm(i.texto)] = true;
        if (n >= minimo) hallados.push({ e: e, i: i, n: n + 0.5 });      // a igual coincidencia, primero los botones del chat
      });
      (e.ent.consultas || []).forEach(function (c) {
        if (vistos[C.norm(c.texto)]) return;                            // ya está como botón del chat
        var n = aciertos(C.norm(c.texto + ' ' + c.tema));
        if (n >= minimo) hallados.push({ e: e, c: c, n: n });
      });
      if (aciertos(C.norm(e.ent.nombre + ' ' + e.ent.que + ' ' + e.ent.temas))) cercanas[e.ent.slug] = true;
    });
    hallados.sort(function (a, b) { return b.n - a.n; });
    hallados = hallados.slice(0, 8);
    hallados.forEach(function (h) { cercanas[h.e.ent.slug] = true; });
    return { temas: hallados, cercanas: cercanas };
  }

  function filaPregunta(titulo, e, detalle, alTocar) {
    var li = el('li'), b = el('button', 'fila fila-pregunta');
    b.type = 'button';
    var txt = el('span', 'fila-texto');
    txt.appendChild(el('span', 'fila-nombre', titulo));
    txt.appendChild(deQuien(e, detalle));
    b.appendChild(txt); b.appendChild(flecha());
    b.addEventListener('click', alTocar);
    li.appendChild(b);
    return li;
  }

  function pintarResultados() {
    var q = consulta.texto.trim(), sit = consulta.situacion, hay = !!q || !!sit;
    $('consulta').classList.toggle('con-texto', !!$('consulta-campo').value);   // con algo escrito, el ejemplo que rota se va
    app.classList.toggle('buscando', hay);
    $('resultados').hidden = !hay;
    $('portada').hidden = hay;
    $('consulta-borrar').hidden = !hay;
    if (!hay) return;

    var ulT = $('res-temas-lista');
    ulT.textContent = '';
    if (sit) {                 // un tema del inicio: todas sus preguntas, de las entidades disponibles
      var nombreSit = '';
      (G.situaciones || []).forEach(function (s) { if (s.id === sit) nombreSit = s.nombre; });
      $('res-temas-rotulo').textContent = nombreSit;
      E.forEach(function (e) {
        if (e.disponible === false) return;
        (e.ent.consultas || []).forEach(function (c) {
          if (c.sit === sit) ulT.appendChild(filaPregunta(c.texto, e, c.tema, function () { consultar(e, c.texto); }));
        });
      });
      $('res-temas').hidden = !ulT.children.length;
      $('res-enviar').hidden = true;
      $('res-corta').hidden = true;
      return;
    }

    var r = buscar(q);
    $('res-temas-rotulo').textContent = 'Temas';
    r.temas.forEach(function (t) {
      if (t.i) ulT.appendChild(filaPregunta(t.i.etiqueta, t.e, t.e.ent.que, function () { arrancar(t.e, t.i); }));
      else ulT.appendChild(filaPregunta(t.c.texto, t.e, t.c.tema, function () { consultar(t.e, t.c.texto); }));
    });
    $('res-temas').hidden = !r.temas.length;

    // A quién mandarle lo escrito. Primero las entidades que tienen que ver con lo escrito.
    var puede = q.length >= 3;
    var ulE = $('res-enviar-lista');
    ulE.textContent = '';
    var orden = E.filter(function (e) { return e.disponible !== false; }).sort(function (a, b) {
      return (r.cercanas[b.ent.slug] ? 1 : 0) - (r.cercanas[a.ent.slug] ? 1 : 0);
    });
    orden.forEach(function (e) {
      var ya = consulta.enviadaA.indexOf(e.ent.slug) >= 0;
      var li = el('li'), b = el('button', 'fila');
      b.type = 'button';
      b.style.setProperty('--marca', (e.cfg && e.cfg.color) || e.ent.color);
      b.setAttribute('aria-label', (ya ? 'Ver la conversación con ' : 'Mandarle tu consulta a ') + e.ent.nombre + ', ' + e.ent.que.toLowerCase());
      var txt = el('span', 'fila-texto'), nombre = el('span', 'fila-nombre');
      nombre.appendChild(el('span', null, e.ent.nombre));
      nombre.appendChild(el('span', 'fila-que', e.ent.que));
      txt.appendChild(nombre);
      txt.appendChild(el('span', 'fila-previa', ya ? 'Ya se la mandaste. Tocá para ver la respuesta.'
        : (e.cfg && e.cfg.bot ? 'Responde ' + e.cfg.bot + ', asistente virtual' : e.ent.temas)));
      var meta = el('span', 'fila-meta');
      if (ya) meta.appendChild(el('span', 'enviada', 'Enviada')); else meta.appendChild(flecha(AVION));
      b.appendChild(avatar(e)); b.appendChild(txt); b.appendChild(meta);
      b.addEventListener('click', function () { if (ya) navegar(e.ent.slug); else preguntar(e, q); });
      li.appendChild(b); ulE.appendChild(li);
    });
    $('res-enviar').hidden = !puede || !orden.length;
    $('res-enviar-rotulo').textContent = consulta.enviadaA.length ? '¿Era para otro? Mandásela también a' : 'Mandarle tu consulta a';
    $('res-corta').hidden = puede || r.temas.length > 0;
  }

  function limpiarConsulta() {
    consulta = { texto: '', enviadaA: [], situacion: '' };
    $('consulta-campo').value = '';
    recordarConsulta();
    pintarResultados();
  }
  function abrirSituacion(id) {
    consulta = { texto: '', enviadaA: [], situacion: id };
    $('consulta-campo').value = '';
    recordarConsulta();
    pintarResultados();
    $('inicio').scrollTop = 0;
    $('consulta-borrar').focus();     // el lector de pantalla queda al lado de la lista, con la forma de volver
  }

  function prepararConsulta() {
    var campo = $('consulta-campo');
    try {
      var g = JSON.parse(sessionStorage.getItem(C.PRE + 'consulta') || 'null');
      if (g && typeof g.texto === 'string') {
        consulta = {
          texto: g.texto.slice(0, 500),
          enviadaA: Array.isArray(g.enviadaA) ? g.enviadaA.filter(porSlug) : [],
          situacion: (G.situaciones || []).some(function (s) { return s.id === g.situacion; }) ? g.situacion : ''
        };
        campo.value = consulta.texto;
      }
    } catch (err) {}
    campo.addEventListener('input', function () {
      // Texto nuevo: nadie lo recibió todavía, y deja de mirarse un tema.
      if (campo.value !== consulta.texto || consulta.situacion) consulta = { texto: campo.value, enviadaA: [], situacion: '' };
      recordarConsulta();
      pintarResultados();
    });
    // «Buscar» en el teclado del teléfono: lo baja, para que se vea a quién mandarle la consulta.
    $('consulta').addEventListener('submit', function (ev) { ev.preventDefault(); campo.blur(); });
    $('consulta-borrar').addEventListener('click', function () { limpiarConsulta(); if (COMODA.matches) campo.focus(); });
    pintarResultados();
  }

  /* ── Ejemplos en el campo de consulta ─────────────────────────────────────────────────────────
   * Con el campo vacío, donde iría el texto de ayuda van pasando preguntas de ejemplo de las tres
   * entidades (las de entidades.js: no se inventa ninguna). Muestran qué se puede preguntar. Son
   * sólo para la vista: el lector de pantalla lee la etiqueta del campo. Con menos movimiento
   * pedido queda una sola, fija.
   */
  function prepararEjemplos() {
    var caja = $('consulta-ejemplo'), campo = $('consulta-campo');
    if (!caja) return;
    var porEntidad = E.map(function (e) {
      return (e.ent.consultas || []).map(function (c) { return c.texto; }).filter(function (t) { return t.length <= 44; });
    });
    var frases = [], i, j;
    for (j = 0; j < 4; j++) for (i = 0; i < porEntidad.length; i++) if (porEntidad[i][j]) frases.push(porEntidad[i][j]);
    if (!frases.length) return;
    campo.setAttribute('placeholder', '');          // el texto de ayuda lo reemplaza el ejemplo
    var cual = 0;
    function poner() {
      caja.textContent = '';
      caja.appendChild(el('span', null, frases[cual % frases.length]));
      cual++;
    }
    poner();
    if (QUIETO.matches) return;
    setInterval(function () {
      if (document.visibilityState !== 'visible' || vista !== 'inicio' || campo.value || app.classList.contains('adorno-quieto')) return;
      poner();
    }, 3600);
  }

  /* ── Avisos que aparecen arriba un momento ────────────────────────────────────────────────── */
  var relojNovedad = 0, relojNota = 0;
  // «Te contestaron» en una conversación que no se está mirando. Se toca para ir.
  function anunciar(e) {
    if (seEstaViendo(e)) return;
    var quien = (e.deEllos && e.deEllos.rol === 'equipo' ? 'Una persona de ' + e.ent.nombre : e.ent.nombre) + ' te contestó';
    $('anuncio').textContent = quien;                 // para el lector de pantalla
    var b = $('novedad');
    b.textContent = '';
    b.appendChild(avatar(e, 'chico'));
    b.appendChild(el('span', null, quien));
    b.setAttribute('data-slug', e.ent.slug);
    $('nota-app').hidden = true;
    b.hidden = false;
    clearTimeout(relojNovedad);
    relojNovedad = setTimeout(function () { b.hidden = true; }, 7000);
  }
  function ocultarNovedad(e) {
    var b = $('novedad');
    if (b.getAttribute('data-slug') === e.ent.slug) { b.hidden = true; clearTimeout(relojNovedad); }
  }
  $('novedad').addEventListener('click', function () {
    var e = porSlug($('novedad').getAttribute('data-slug'));
    if (e) navegar(e.ent.slug);
  });
  // Una nota de la app (no se pudo mandar, sin conexión…). Se va sola o al tocarla.
  function notar(texto) {
    var n = $('nota-app');
    $('anuncio').textContent = texto;                // para el lector de pantalla
    n.textContent = texto;
    $('novedad').hidden = true;
    n.hidden = false;
    clearTimeout(relojNota);
    relojNota = setTimeout(function () { n.hidden = true; }, 9000);
  }
  $('nota-app').addEventListener('click', function () { $('nota-app').hidden = true; });

  /* ── El teclado del teléfono ──────────────────────────────────────────────────────────────────
   *
   * Al abrirse, el navegador no achica la página: dibuja el teclado encima, y lo de abajo (el campo
   * de escribir) queda tapado. `visualViewport` dice cuánta pantalla queda de verdad a la vista; con
   * eso la app se achica a ese alto y el chat sube con el teclado. Es la misma cuenta que hace el
   * chat de la plataforma cuando está suelto en una página (acá, adentro de un marco, el chat no
   * puede hacerla: ve el alto del marco, no el de la pantalla).
   *
   * Esto no se puede probar en una computadora: hace falta un teléfono. `?depurar=1` dibuja los
   * números arriba para poder mandar una captura.
   */
  var vv = window.visualViewport, depurador = null;
  function alternarDepurador() {
    if (depurador) { depurador.remove(); depurador = null; return; }
    depurador = el('div');
    depurador.style.cssText = 'position:absolute;top:env(safe-area-inset-top);left:0;right:0;z-index:99;padding:2px 6px;background:#000;color:#0f0;font:11px monospace;pointer-events:none';
    app.appendChild(depurador);
    if (vv) ajustarAlto();
  }
  // Anclada al inicio del teléfono no hay dónde escribir `?depurar=1`: cinco toques seguidos en el
  // nombre de la app (arriba de todo) prenden y apagan los números.
  (function () {
    var rotulo = document.querySelector('[data-app-nombre]'), toques = 0, reloj = 0;
    if (!rotulo) return;
    rotulo.addEventListener('click', function () {
      toques++;
      clearTimeout(reloj);
      reloj = setTimeout(function () { toques = 0; }, 1500);
      if (toques >= 5) { toques = 0; alternarDepurador(); }
    });
  }());

  /* iPhone, con la app anclada al inicio. Ahí la app se dibuja también detrás de la barra de estado
   * (la hora, la batería), y iOS le informa un alto de pantalla MÁS CORTO que el real: le descuenta
   * esa barra, pero igual dibuja la página desde arriba de todo. Como la app se ajusta al alto que
   * le informan, quedaba corta: las pestañas flotando sobre el contenido y un hueco abajo (se vio
   * el 18-11-2026 en un iPhone, ya publicada). Se lo reconoce por su firma: la app está anclada, no
   * hay teclado, y lo que falta para llenar la pantalla es justo el alto de la barra de estado. En
   * ese caso se suma lo que falta. En cualquier otro, no se toca nada.
   */
  var sonda = null;
  function barraDeEstado() {
    if (!sonda) {
      sonda = el('div');
      sonda.style.cssText = 'position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top);visibility:hidden;pointer-events:none';
      document.body.appendChild(sonda);
    }
    return sonda.getBoundingClientRect().height;
  }
  function faltaAbajo() {
    if (navigator.standalone !== true) return 0;       // sólo existe en iOS, y sólo es `true` con la app anclada
    var vertical = window.innerHeight >= window.innerWidth;
    var pantalla = vertical ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
    var falta = pantalla - vv.height, barra = barraDeEstado();
    return barra > 0 && Math.abs(falta - barra) <= 3 ? falta : 0;
  }

  function ajustarAlto() {
    // Con zoom de pellizco lo visible también se achica, y no es el teclado: no se toca nada.
    var conZoom = Math.abs((vv.scale || 1) - 1) > 0.01;
    var abierto = !conZoom && vv.height < window.innerHeight * 0.78;
    var sumado = conZoom || abierto ? 0 : faltaAbajo();
    if (conZoom) { app.style.removeProperty('--alto'); app.style.transform = ''; }
    else {
      app.style.setProperty('--alto', Math.round(vv.height + sumado) + 'px');
      app.style.transform = vv.offsetTop ? 'translateY(' + Math.round(vv.offsetTop) + 'px)' : '';
    }
    if (abierto !== teclado) {
      teclado = abierto;
      app.classList.toggle('teclado', teclado);
      if (!teclado) ubicarLuz();
      E.forEach(function (e) { decir(e, { tipo: 'teclado', abierto: teclado }); });
    }
    if (depurador) {
      depurador.textContent = 'visible ' + Math.round(vv.height) + ' · ventana ' + window.innerWidth + '×' + window.innerHeight +
        ' · pantalla ' + screen.width + '×' + screen.height + ' · barra ' + Math.round(barraDeEstado()) + ' · sumado ' + Math.round(sumado) +
        ' · anclada ' + (navigator.standalone === true ? 'sí' : navigator.standalone === false ? 'no' : '—') +
        ' · corrida ' + Math.round(vv.offsetTop) + ' · zoom ' + (vv.scale || 1).toFixed(2) + ' · teclado ' + (teclado ? 'sí' : 'no');
    }
  }
  if (/[?&]depurar=1/.test(location.search)) alternarDepurador();
  if (vv) {
    var pendiente = false;
    var diferir = function () { if (pendiente) return; pendiente = true; requestAnimationFrame(function () { pendiente = false; ajustarAlto(); }); };
    vv.addEventListener('resize', diferir);
    vv.addEventListener('scroll', diferir);
    ajustarAlto();
  }

  /* ── Conexión y volver a la app ───────────────────────────────────────────────────────────── */
  function vigilarConexion() {
    function alCambiar() {
      enLinea = navigator.onLine !== false;
      $('sin-red').hidden = enLinea;
      $('anuncio').textContent = enLinea ? 'Volvió la conexión.' : 'Sin conexión. Vas a poder escribir cuando vuelva.';
      pintarTodo();
      if (enLinea) E.forEach(cargarConfig);
    }
    window.addEventListener('online', alCambiar);
    window.addEventListener('offline', alCambiar);
    $('sin-red').hidden = enLinea;
  }
  // Al volver a la app: lo que está en pantalla pasa a estar visto y, si estuvo un rato fuera de la
  // vista, cada chat se pone al día (el chat no vuelve a pedir lo que llegó mientras estaba
  // desconectado; el marco se recarga solo si la persona no tenía nada a medio escribir).
  var ocultaDesde = 0;
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') { ocultaDesde = Date.now(); return; }
    var unRato = ocultaDesde && Date.now() - ocultaDesde > 60000;
    ocultaDesde = 0;
    if (unRato && enLinea) E.forEach(function (e) { decir(e, { tipo: 'refrescar' }); });
    var e = vista === 'inicio' ? null : porSlug(vista);
    if (e) { contarNovedad(e); pintar(e); }
  });

  /* ── Instalar ─────────────────────────────────────────────────────────────────────────────────
   * Se ofrece una sola vez y recién cuando la persona ya usó la app (tiene una conversación): antes
   * no sabe para qué la querría. En Android el navegador da un botón; en iPhone hay que explicar el
   * camino, porque Safari no avisa ni deja instalar con un toque.
   */
  var pedidoInstalar = null, instalable = false;
  function ofrecerInstalar() {
    var caja = $('instalar');
    if (!instalable || C.leer(C.PRE + 'instalar') === 'no' || !algunaConversacion()) { caja.hidden = true; return; }
    caja.hidden = false;
  }
  function prepararInstalacion() {
    var instalada = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    if (instalada) return;
    var texto = $('instalar-texto'), ok = $('instalar-ok');
    $('instalar-no').addEventListener('click', function () { C.guardar(C.PRE + 'instalar', 'no'); ofrecerInstalar(); });
    window.addEventListener('beforeinstallprompt', function (ev) {
      ev.preventDefault();
      pedidoInstalar = ev;
      instalable = true;
      texto.textContent = '¿La querés tener como app? Queda en la pantalla del teléfono, como cualquier otra.';
      ok.hidden = false;
      ofrecerInstalar();
    });
    ok.addEventListener('click', function () {
      if (!pedidoInstalar) return;
      pedidoInstalar.prompt();
      pedidoInstalar.userChoice.then(function () { pedidoInstalar = null; instalable = false; ofrecerInstalar(); });
    });
    window.addEventListener('appinstalled', function () { instalable = false; ofrecerInstalar(); });
    var ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
      instalable = true;
      texto.textContent = '¿La querés tener como app en el iPhone? Tocá Compartir y elegí «Agregar a inicio».';
    }
  }

  /* ── Borrar las conversaciones de este teléfono ───────────────────────────────────────────────
   * Para el teléfono compartido (con la familia, en el puesto). Se olvida la credencial de cada
   * chat, que es lo que permite volver a ver la conversación desde acá. No borra nada en la
   * entidad, y por eso se dice con todas las letras antes de hacerlo.
   */
  // Suelta, EN ESTA VENTANA, la conversación con una entidad: saca su chat y lo que la app sabía de ella.
  function soltar(e) {
    if (e.marco) e.marco.remove();
    e.marco = null; e.conectado = false; e.cola = []; e.enVuelo = null; e.focoPendiente = false; e.estadoMarco = '';
    e.ultimo = null; e.deEllos = null; e.caso = ''; e.novedad = false; e.anunciada = false;
    e.visto = { t: 0, h: '' };
  }
  function soltarTodo() {
    E.forEach(soltar);
    $('olvidar-caja').hidden = true;
    consulta = { texto: '', enviadaA: [], situacion: '' };
    $('consulta-campo').value = '';
    recordarConsulta();
    pintarResultados();
    history.replaceState({ v: 'inicio' }, '', './');
    mostrar('inicio', false);
    pintarTodo();
  }
  function prepararOlvido() {
    var caja = $('olvidar-caja');
    $('olvidar-abrir').addEventListener('click', function () { caja.hidden = !caja.hidden; if (!caja.hidden) $('olvidar-no').focus(); });
    $('olvidar-no').addEventListener('click', function () { caja.hidden = true; $('olvidar-abrir').focus(); });
    $('olvidar-ok').addEventListener('click', function () {
      E.forEach(function (e) {
        ['webchat_token_', 'webchat_consent_', 'webchat_origen_'].forEach(function (p) { C.borrar(p + e.ent.clave); });
        C.borrar(C.PRE + 'visto_' + e.ent.slug);
      });
      C.guardar(C.PRE + 'olvido', String(Date.now()));     // les avisa a las otras ventanas de la app
      soltarTodo();
      notar('Listo. Acá ya no queda ninguna conversación.');
    });
    // La app puede estar abierta en dos ventanas (instalada y en una pestaña). Si en la otra se
    // borraron las conversaciones, o un chat empezó de nuevo, acá también se sueltan: si no, esta
    // ventana seguiría mostrando la conversación, y al escribir volvería a guardar su credencial.
    window.addEventListener('storage', function (ev) {
      if (ev.key === C.PRE + 'olvido') { soltarTodo(); return; }
      if (!ev.key || ev.newValue !== null || ev.key.indexOf('webchat_token_') !== 0) return;
      E.forEach(function (e) {
        if (ev.key !== 'webchat_token_' + e.ent.clave) return;
        var eraLaVista = vista === e.ent.slug;
        soltar(e);
        if (eraLaVista) { history.replaceState({ v: 'inicio' }, '', './'); mostrar('inicio', false); }
        pintar(e);
      });
    });
  }

  /* ── Arranque ─────────────────────────────────────────────────────────────────────────────── */
  function cargarConfig(e) {
    return C.pedirConfig(e.ent).then(function (r) {
      if (r.estado === 'ok') { e.cfg = r.cfg; e.disponible = true; }
      else if (r.estado === 'no') { e.cfg = null; e.disponible = false; if (vista === e.ent.slug) mostrar('inicio', false); }
      else if (r.cfg) e.cfg = r.cfg;
      pintar(e);
      if (consulta.texto || consulta.situacion) pintarResultados();   // cambió qué temas hay o quién está disponible
    });
  }

  document.querySelectorAll('[data-app-nombre]').forEach(function (n) { n.textContent = G.nombre; });
  armarConversaciones();
  armarQuienes();
  armarPestanas();
  pintarPedidos();
  pintarSituaciones();
  prepararConsulta();
  prepararEjemplos();
  vigilarConexion();
  prepararInstalacion();
  prepararOlvido();
  pintarPortada();

  // Al recargar dentro de un chat al que se entró desde el inicio, el historial conserva esa entrada: se respeta.
  history.replaceState({ v: vistaDeLaUrl(), apilado: !!(history.state && history.state.apilado) }, '', location.href);
  mostrar(vistaDeLaUrl(), false);
  // Recién después de la primera pintada los cambios de vista llevan transición y la luz de las
  // pestañas se desliza: lo que se arma al abrir aparece puesto, no moviéndose.
  requestAnimationFrame(function () { requestAnimationFrame(function () { arrancado = true; $('pestanas').classList.add('asentada'); }); });
  window.addEventListener('resize', ubicarLuz);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(ubicarLuz);

  Promise.all(E.map(cargarConfig)).then(function () { setTimeout(precargar, 600); });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
}());
