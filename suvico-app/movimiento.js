/*
 * Web app del grupo — el movimiento que es adorno.
 *
 * Nada de lo que hay acá hace falta para usar la app: si este archivo no carga, todo se ve y anda.
 * (El movimiento que SÍ es parte del uso —pasar de una vista a otra, la marca de la pestaña, los
 * ejemplos del campo— está en app.js.) Cada efecto se enciende desde index.html con un atributo,
 * así cada piel elige cuáles usa:
 *
 *   #app.estreno + data-estreno="2600"  la entrada de la primera vez: la clase se saca a los N ms
 *   [data-revelar]                      el bloque entra cuando llega a la pantalla al desplazar
 *   #app[data-luz="selector"]           esas piezas llevan una luz que sigue al cursor (--mx, --my)
 *   [data-cinta]                        la cinta de texto: se arma con los temas de entidades.js
 *   [data-avance]                       el encabezado se va yendo al desplazar (--avance, de 0 a 1)
 *
 * Con «menos movimiento» pedido en el teléfono o la computadora, no se enciende ninguno.
 */
(function () {
  'use strict';

  var app = document.getElementById('app'), inicio = document.getElementById('inicio');
  if (!app || !inicio) return;
  var C = window.Comun, G = window.GRUPO || { entidades: [] };
  var QUIETO = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CON_HOVER = window.matchMedia('(hover: hover)').matches;
  function cada(lista, f) { Array.prototype.forEach.call(lista, f); }
  function el(etiqueta, clase, texto) {
    var n = document.createElement(etiqueta);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  /* ── El estreno ───────────────────────────────────────────────────────────────────────────────
   * La entrada larga (el título que sube, las piezas que llegan escalonadas) se ve una sola vez,
   * al abrir. Después la clase se saca: volver al inicio desde un chat no la repite. */
  var estreno = Number(app.getAttribute('data-estreno')) || 0;
  function terminarEstreno() { app.classList.remove('estreno'); }
  if (QUIETO || !estreno) terminarEstreno(); else setTimeout(terminarEstreno, estreno);

  /* ── La cinta de texto ────────────────────────────────────────────────────────────────────────
   * Dos filas que corren en sentidos opuestos: los temas de las preguntas de ejemplo y las tres
   * entidades. Corre sola sólo si hay JavaScript, porque el botón de pausa depende de él; la
   * elección de pausarla se recuerda. */
  cada(document.querySelectorAll('[data-cinta]'), function (cinta) {
    var temas = [], hay = true, j = 0;
    while (hay) {                                   // un tema de cada entidad por vuelta, para que se mezclen
      hay = false;
      G.entidades.forEach(function (ent) {
        var propios = [];
        (ent.consultas || []).forEach(function (c) { if (c.tema && propios.indexOf(c.tema) < 0) propios.push(c.tema); });
        if (propios[j]) { hay = true; if (temas.indexOf(propios[j]) < 0) temas.push(propios[j]); }
      });
      j++;
    }
    var quienes = G.entidades.map(function (ent) { return ent.nombre + ', ' + String(ent.que || '').toLowerCase(); });
    if (!temas.length || !quienes.length) return;

    function separador() {
      var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'cinta-sep');
      p.setAttribute('d', 'M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z'); p.setAttribute('fill', 'currentColor');
      s.appendChild(p);
      return s;
    }
    function fila(textos, clase, repetir) {
      var f = el('div', 'cinta-fila' + (clase ? ' ' + clase : '')), pista = el('div', 'cinta-pista');
      for (var g = 0; g < 2; g++) {                 // dos grupos iguales: al correrse medio ancho, empalma
        var grupo = el('div', 'cinta-grupo');
        for (var r = 0; r < repetir; r++) textos.forEach(function (t) { grupo.appendChild(el('span', null, t)); grupo.appendChild(separador()); });
        pista.appendChild(grupo);
      }
      f.appendChild(pista);
      return f;
    }
    cinta.appendChild(fila(temas, '', 1));
    cinta.appendChild(fila(quienes, 'inversa', 3));
    if (QUIETO) return;
    cinta.classList.add('corre');

    var boton = cinta.parentNode.querySelector('.cinta-pausa');
    if (!boton) return;
    var CLAVE = (C && C.PRE ? C.PRE : 'grupo_') + 'cinta';
    function poner(pausada) {
      cinta.classList.toggle('pausada', pausada);
      app.classList.toggle('adorno-quieto', pausada);     // las luces de fondo y los ejemplos del campo también paran
      boton.textContent = pausada ? 'Reanudar movimiento' : 'Pausar movimiento';
    }
    poner(!!C && C.leer(CLAVE) === 'pausada');
    boton.hidden = false;
    boton.addEventListener('click', function () {
      var pausada = !cinta.classList.contains('pausada');
      poner(pausada);
      if (C) { if (pausada) C.guardar(CLAVE, 'pausada'); else C.borrar(CLAVE); }
    });
  });

  if (QUIETO) return;

  /* ── Entrar al desplazar ──────────────────────────────────────────────────────────────────────
   * Sólo se esconde lo que está debajo de la pantalla al cargar (o lo que todavía no se muestra
   * porque espera datos): nada parpadea y, si esto no corre, no queda contenido oculto. Lo que se
   * desplaza es el inicio (no la página), así que se lo vigila contra él. */
  if ('IntersectionObserver' in window) {
    var alto = window.innerHeight;
    var vigia = new IntersectionObserver(function (entradas) {
      var orden = 0;
      entradas.forEach(function (entrada) {
        if (!entrada.isIntersecting) return;
        var n = entrada.target;
        vigia.unobserve(n);
        n.style.setProperty('--demora', (orden++ * 80) + 'ms');
        n.classList.add('visto');
        n.addEventListener('transitionend', function limpiar(e) {
          if (e.target !== n || e.pseudoElement) return;
          n.removeEventListener('transitionend', limpiar);
          n.classList.remove('espera', 'visto');
          n.style.removeProperty('--demora');
        });
      });
    }, { root: inicio, rootMargin: '0px 0px -6% 0px' });
    cada(document.querySelectorAll('[data-revelar]'), function (n) {
      var sinMostrar = n.offsetParent === null;                    // escondido: espera datos
      if (!sinMostrar && n.getBoundingClientRect().top < alto) return;   // se ve al cargar: no se toca
      n.classList.add('espera');
      vigia.observe(n);
    });
  }

  /* ── La luz que sigue al cursor (sólo con mouse) ──────────────────────────────────────────── */
  var conLuz = app.getAttribute('data-luz');
  if (conLuz && CON_HOVER) {
    document.addEventListener('pointermove', function (e) {
      var pieza = e.target && e.target.closest ? e.target.closest(conLuz) : null;
      if (!pieza) return;
      var caja = pieza.getBoundingClientRect();
      pieza.style.setProperty('--mx', (e.clientX - caja.left) + 'px');
      pieza.style.setProperty('--my', (e.clientY - caja.top) + 'px');
    }, { passive: true });
  }

  /* ── El encabezado se va yendo al desplazar ───────────────────────────────────────────────── */
  if (inicio.querySelector('[data-avance]')) {
    var pedido = false;
    inicio.addEventListener('scroll', function () {
      if (pedido) return;
      pedido = true;
      requestAnimationFrame(function () {
        pedido = false;
        inicio.style.setProperty('--avance', Math.min(1, inicio.scrollTop / 320).toFixed(3));
      });
    }, { passive: true });
  }
}());
