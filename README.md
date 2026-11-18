# temacy-webs

Sitios de clientes de temacy en borrador, para revisión. Se publican en `https://web.temacy.com/`, cada uno en
su carpeta.

| Carpeta | Sitio | Dirección | Estado |
|---|---|---|---|
| [`mavic/`](mavic/) | Mavic, la mutual de los vigiladores de Córdoba | https://web.temacy.com/mavic/ | Borrador para revisión (v3) |
| [`suvico/`](suvico/) | Suvico, el sindicato de los vigiladores de Córdoba | https://web.temacy.com/suvico/ | Propuesta (v3) |

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

- Identidad propia, distinta de Mavic: fondo papel claro, títulos Hanken Grotesk, rojo del logo y fotos a color.
  Movimiento al scrollear con GSAP (parallax, cifras que cuentan, documentos que se reparten, cita palabra por palabra).
- La carpeta `suvico/` también es **salida generada**. La fuente (`_fuente/build.py`) está en la carpeta del proyecto
  `sitio-suvico/`; se edita ahí, se regenera y se copia acá.
- Generado para `https://web.temacy.com/suvico` (canónica, vista previa y `suvico/404.html` dependen de eso).
