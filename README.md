# temacy-webs

Sitios de clientes de temacy en borrador, para revisión. Se publican en `https://web.temacy.com/`, cada uno en
su carpeta.

| Carpeta | Sitio | Dirección | Estado |
|---|---|---|---|
| [`mavic/`](mavic/) | Mavic, la mutual de los vigiladores de Córdoba | https://web.temacy.com/mavic/ | Borrador para revisión (v3) |
| [`suvico/`](suvico/) | Suvico, el sindicato de los vigiladores de Córdoba | https://web.temacy.com/suvico/ | Propuesta (v2) |
| [`tramasandinas/`](tramasandinas/) | Tramas Andinas, apart hotel en Salta | https://web.temacy.com/tramasandinas/ | Borrador para revisión |
| [`tramasredes/`](tramasredes/) | Tramas Andinas: propuesta de redes (estrategia, feed simulado, reels) | https://web.temacy.com/tramasredes/ | Propuesta (v1) |
| [`multicarrier/`](multicarrier/) | Multicarrier Services, transporte internacional de cargas en Córdoba | https://web.temacy.com/multicarrier/ | Propuesta de rediseño (v1) |

## Cómo se publica

Cada carpeta es un sitio estático completo: HTML, CSS, JavaScript e imágenes, sin paso de compilación. El
contenido de este repositorio se copia tal cual a la carpeta pública de `web.temacy.com` (deploy por Git del
hosting), y cada sitio queda en `web.temacy.com/<carpeta>/`.

En la raíz, `.htaccess` y `robots.txt` piden a los buscadores que no indexen nada del subdominio.

## Sobre el sitio de Mavic

- La carpeta `mavic/` es **salida generada**: no se edita a mano. La fuente y el generador están en el
  repositorio del proyecto (`mavic_web`); para cambiar algo se edita ahí, se regenera y se vuelve a copiar acá.
- Está generado para la dirección `https://web.temacy.com/mavic`: la vista previa de los links, la dirección
  canónica y la página de error (`mavic/404.html`, con rutas `/mavic/…`) dependen de eso. Si el sitio se muda a
  otro dominio hay que regenerarlo con la dirección nueva.
- Es un borrador: faltan textos que tiene que completar Mavic, y los botones de WhatsApp llevan a la página de
  contacto hasta que se cargue el número.

## Sobre el sitio de Suvico

- Identidad propia, distinta de Mavic: fondo papel, títulos Big Shoulders Display en mayúscula, rojo del logo y fotos
  en blanco y negro con viraje rojo. CSS y JavaScript propios, sin GSAP.
- La carpeta `suvico/` también es **salida generada**. La fuente (`_fuente/build.py`) está en la carpeta del proyecto
  `sitio-suvico/`; se edita ahí, se regenera y se copia acá.
- Generado para `https://web.temacy.com/suvico` (canónica, vista previa y `suvico/404.html` dependen de eso).

## Sobre el sitio de Tramas Andinas

- Paleta sobria (ciruela y piedra sobre neutros), títulos en Fraunces y texto en Manrope. Movimiento con GSAP y Lenis,
  empaquetados en `tramasandinas/assets/`.
- La carpeta `tramasandinas/` también es **salida generada** (Astro). La fuente está en la carpeta del proyecto
  `tramas-andinas-web/sitio/`: se edita ahí, se corre `npm run build`, y se copia `dist/` acá cambiando las rutas
  `/assets/` por `assets/`.
- Generado para `https://web.temacy.com/tramasandinas/` (canónica y vista previa de links dependen de eso).
- El buscador de fechas abre WhatsApp hasta que se elija motor de reservas.

## Sobre el sitio de Multicarrier

- Propuesta de rediseño. Concepto "manifiesto de carga": títulos Big Shoulders Display, códigos de puerto en IBM Plex
  Mono, azul mar con naranja contenedor. HTML, CSS y JavaScript en un solo archivo, sin dependencias.
- Esta carpeta es la fuente: se edita directo acá.
- El cotizador arma el mensaje y abre WhatsApp. El formulario de contacto todavía no envía (es un prototipo).
- Faltan logo oficial, cifras y logos de clientes. Las rutas del tablero son ejemplos.
