// Sitio Suvico v1 (misma base que el sitio de Mavic v3). Todo es mejora progresiva: sin JavaScript el sitio se lee y se navega igual.
// Las animaciones están al final del archivo. Las atadas al scroll usan GSAP (js/vendor), que el generador
// solo carga en las páginas que las necesitan; si no está, esas partes se saltean.

// Menú del celular: abre, cierra con Escape, al tocar afuera o al elegir un link.
(function () {
  var boton = document.querySelector('.menu-btn'), nav = document.getElementById('nav');
  if (!boton || !nav) return;
  function poner(abierto) {
    nav.classList.toggle('open', abierto);
    boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
    boton.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
  }
  boton.addEventListener('click', function () { poner(!nav.classList.contains('open')); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('open')) { poner(false); boton.focus(); }
  });
  document.addEventListener('click', function (e) {
    if (nav.classList.contains('open') && !nav.contains(e.target) && !boton.contains(e.target)) poner(false);
  });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) poner(false); });
})();

// Formulario "Quiero afiliarme": valida, arma el mensaje y abre el WhatsApp de Suvico.
(function () {
  var form = document.querySelector('form[data-wa]');
  if (!form) return;
  var dni = form.querySelector('input[name="DNI"]');
  function revisarDni() {
    if (!dni) return;
    var limpio = dni.value.replace(/\D/g, '');
    dni.setCustomValidity(limpio.length >= 7 && limpio.length <= 8 ? '' : 'Escribí tu DNI: 7 u 8 números, sin puntos.');
  }
  if (dni) dni.addEventListener('input', revisarDni);
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    revisarDni();
    if (!form.reportValidity()) return;
    var numero = form.getAttribute('data-wa');
    if (!numero) { window.location.href = form.getAttribute('data-fallback'); return; }
    var lineas = ['Hola, quiero afiliarme a Suvico.'];
    Array.prototype.forEach.call(form.querySelectorAll('input'), function (campo) {
      var valor = campo.name === 'DNI' ? campo.value.replace(/\D/g, '') : campo.value.trim();
      lineas.push(campo.name + ': ' + valor);
    });
    window.open('https://wa.me/' + numero + '?text=' + encodeURIComponent(lineas.join('\n')), '_blank', 'noopener');
  });
})();

// Preguntas frecuentes: si el link trae un ancla (preguntas.html#baja), abre esa respuesta.
(function () {
  function abrir() {
    if (!location.hash) return;
    var destino;
    try { destino = document.querySelector(location.hash); } catch (e) { return; }
    if (destino && destino.tagName === 'DETAILS') destino.open = true;
  }
  abrir();
  window.addEventListener('hashchange', abrir);
})();

// ------------------------------------------------------------------ animaciones

var MOVIMIENTO_REDUCIDO = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var CON_HOVER = window.matchMedia('(hover: hover)').matches;

// Acordeón de fotos: se abre la tajada que se toca, se enfoca o (con mouse) se señala.
(function () {
  Array.prototype.forEach.call(document.querySelectorAll('.acordeon'), function (grupo) {
    var tajadas = grupo.querySelectorAll('.tajada');
    function activar(elegida) {
      Array.prototype.forEach.call(tajadas, function (t) {
        var si = t === elegida;
        t.classList.toggle('activa', si);
        t.setAttribute('aria-pressed', si ? 'true' : 'false');
      });
    }
    Array.prototype.forEach.call(tajadas, function (t) {
      t.addEventListener('click', function () { activar(t); });
      t.addEventListener('focus', function () { activar(t); });
      if (CON_HOVER) t.addEventListener('pointerenter', function () { activar(t); });
    });
  });
})();

// Cinta de texto: botón para pausarla y reanudarla.
(function () {
  Array.prototype.forEach.call(document.querySelectorAll('.cinta-pausa'), function (boton) {
    var cinta = boton.parentNode.querySelector('.cinta');
    boton.addEventListener('click', function () {
      var pausada = cinta.classList.toggle('pausada');
      boton.textContent = pausada ? 'Reanudar movimiento' : 'Pausar movimiento';
    });
  });
})();

// Luz que sigue al cursor en las tarjetas (solo con mouse).
(function () {
  if (!CON_HOVER || MOVIMIENTO_REDUCIDO) return;
  document.addEventListener('pointermove', function (e) {
    var tarjeta = e.target.closest ? e.target.closest('.cat, .contact') : null;
    if (!tarjeta) return;
    var caja = tarjeta.getBoundingClientRect();
    tarjeta.style.setProperty('--mx', (e.clientX - caja.left) + 'px');
    tarjeta.style.setProperty('--my', (e.clientY - caja.top) + 'px');
  }, { passive: true });
})();

// Entrada al scrollear. Solo se esconde lo que está debajo de la pantalla al cargar, así nada parpadea
// y, si este script no corre, no queda contenido oculto.
(function () {
  if (MOVIMIENTO_REDUCIDO || !('IntersectionObserver' in window)) return;
  var SELECTOR = '.sec-head, .sec-row > .btn, .task, .cat, .cuota-card, .join > .stack, .benefits li, .cta, ' +
    '.ficha, .prose, .aside > *, .more a, .steps li, .join-form, .contact, .faq-group, .split > *, .chips, ' +
    '.market-note, .other-orgs, .foot-top > *, .nov, .cita, .galeria, .foto-ancha';
  var alto = window.innerHeight;

  var vigia = new IntersectionObserver(function (entradas) {
    var orden = 0;
    entradas.forEach(function (entrada) {
      if (!entrada.isIntersecting) return;
      var el = entrada.target;
      vigia.unobserve(el);
      el.style.setProperty('--demora', (orden++ * 80) + 'ms');
      el.classList.add('visto');
      el.addEventListener('transitionend', function limpiar(e) {
        if (e.target !== el || e.pseudoElement) return;   // no cuenta la luz (::before) de la tarjeta
        el.removeEventListener('transitionend', limpiar);
        el.classList.remove('espera', 'visto');
        el.style.removeProperty('--demora');
      });
    });
  }, { rootMargin: '0px 0px -6% 0px' });

  Array.prototype.forEach.call(document.querySelectorAll(SELECTOR), function (el) {
    if (el.closest('.espera')) return;               // ya entra con su contenedor
    if (el.getBoundingClientRect().top < alto) return; // se ve al cargar: no se toca
    el.classList.add('espera');
    vigia.observe(el);
  });
})();

// Efectos atados al scroll (GSAP + ScrollTrigger).
(function () {
  if (MOVIMIENTO_REDUCIDO || !window.gsap || !window.ScrollTrigger) return;
  var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);

  // Portada: la foto baja más lento que la página y el texto se va antes.
  var hero = document.querySelector('.hero');
  if (hero) {
    gsap.to('.hero-bg', { yPercent: 16, scale: 1.1, ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero-in', { yPercent: -16, opacity: 0, ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: '70% top', scrub: true } });
  }

  // Cinta: además de correr sola, las dos filas se desplazan con el scroll.
  gsap.utils.toArray('.cinta-fila').forEach(function (fila, i) {
    gsap.fromTo(fila, { xPercent: i ? -4 : 4 }, { xPercent: i ? 4 : -4, ease: 'none',
      scrollTrigger: { trigger: fila, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // Fotos que crecen al entrar y se apagan al salir.
  // Lo que ya se ve al cargar la página no crece: arranca entero y solo se apaga al salir.
  gsap.utils.toArray('[data-escala]').forEach(function (el) {
    var linea = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
    if (el.getBoundingClientRect().top >= window.innerHeight) {
      linea.fromTo(el, { scale: 0.8, opacity: 0.35 }, { scale: 1, opacity: 1, ease: 'none', duration: 0.34 });
    }
    linea.to(el, { opacity: 0.3, ease: 'none', duration: 0.14 }, 0.86);
  });

  // Foto de la tarjeta del Parque: se mueve apenas dentro de su marco.
  gsap.utils.toArray('[data-zoom] img').forEach(function (img) {
    gsap.fromTo(img, { yPercent: -8 }, { yPercent: 8, ease: 'none',
      scrollTrigger: { trigger: img.parentNode, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // Packs apilados: la posición la resuelve CSS (sticky); acá cada tarjeta se achica
  // a medida que la siguiente la tapa.
  // Mismo criterio que el CSS: sin pegado (pantallas bajas) no hay nada que achicar.
  var cartas = window.matchMedia('(min-height: 620px)').matches ? gsap.utils.toArray('.apila .carta') : [];
  cartas.forEach(function (carta, i) {
    var siguiente = cartas[i + 1];
    if (!siguiente) return;
    gsap.to(carta, { scale: 1 - (cartas.length - 1 - i) * 0.045, ease: 'none',
      scrollTrigger: { trigger: siguiente, start: 'top 80%', end: 'top 20%', scrub: true } });
  });

  // El número grande (1974, 3 requisitos) crece al aparecer.
  gsap.utils.toArray('.big-price').forEach(function (el) {
    gsap.fromTo(el, { scale: 0.55, transformOrigin: '0 100%' }, { scale: 1, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top bottom', end: 'top 45%', scrub: true } });
  });

  // Las tipografías cambian las medidas al cargar: se recalculan los puntos de disparo.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
})();
