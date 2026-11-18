// Sitio Suvico v2. Mejora progresiva: sin JavaScript el sitio se lee y se navega igual.

// Menú del celular: abre, cierra con Escape, al tocar afuera o al elegir un link.
(function () {
  var boton = document.querySelector('.menu-btn'), nav = document.getElementById('nav');
  if (!boton || !nav) return;
  var rotulo = boton.querySelector('span');
  function poner(abierto) {
    nav.classList.toggle('open', abierto);
    boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
    if (rotulo) rotulo.textContent = abierto ? 'Cerrar' : 'Menú';
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

// Filete rojo bajo la cabecera que avanza con la lectura de la página.
(function () {
  var cab = document.querySelector('.cabeza');
  if (!cab) return;
  var pendiente = false;
  function medir() {
    pendiente = false;
    var total = document.documentElement.scrollHeight - window.innerHeight;
    cab.style.setProperty('--avance', total > 0 ? Math.min(1, window.scrollY / total).toFixed(4) : 0);
  }
  window.addEventListener('scroll', function () { if (!pendiente) { pendiente = true; requestAnimationFrame(medir); } }, { passive: true });
  medir();
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
    var lineas = ['Hola, quiero afiliarme a Suvico.'];
    Array.prototype.forEach.call(form.querySelectorAll('input'), function (campo) {
      var valor = campo.name === 'DNI' ? campo.value.replace(/\D/g, '') : campo.value.trim();
      lineas.push(campo.name + ': ' + valor);
    });
    window.open('https://wa.me/' + form.getAttribute('data-wa') + '?text=' + encodeURIComponent(lineas.join('\n')), '_blank', 'noopener');
  });
})();

// Preguntas frecuentes: si el link trae un ancla (preguntas.html#convenio), abre esa respuesta.
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

// Aparición al scrollear: las fotos se destapan de arriba hacia abajo y los bloques suben.
// Solo se esconde lo que está debajo de la pantalla al cargar; si el script no corre, no queda nada oculto.
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  var SELECTOR = '.enc, .indice li, .doc, .pieza figure, .pieza .tx, .org, .principal, .titulares li, .pasos li, ' +
    '.cifra, .llamado, .valor, .tira figure, .carta-sg > *, .tabla tr, .grupo-faq, .caja, .ficha, .texto, .form, .foto-corte, .galeria figure';
  var alto = window.innerHeight;
  var vigia = new IntersectionObserver(function (entradas) {
    var orden = 0;
    entradas.forEach(function (entrada) {
      if (!entrada.isIntersecting) return;
      var el = entrada.target;
      vigia.unobserve(el);
      el.style.setProperty('--demora', (orden++ * 90) + 'ms');
      el.classList.add('visto');
      el.addEventListener('transitionend', function limpiar(e) {
        if (e.target !== el) return;
        el.removeEventListener('transitionend', limpiar);
        el.classList.remove('espera', 'visto');
        el.style.removeProperty('--demora');
      });
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  Array.prototype.forEach.call(document.querySelectorAll(SELECTOR), function (el) {
    if (el.closest('.espera')) return;
    if (el.getBoundingClientRect().top < alto) return;
    el.classList.add('espera');
    vigia.observe(el);
  });
})();
