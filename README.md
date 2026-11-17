# temacy-webs

Sitios web desarrollados por temacy.

| Carpeta | Sitio | Estado |
|---|---|---|
| [`mavic/`](mavic/) | Mavic, la mutual de los vigiladores de Córdoba | Borrador para revisión (v3) |

## Cómo se publica

Cada carpeta es un sitio estático completo: HTML, CSS, JavaScript e imágenes, sin paso de compilación. Todos los
links son relativos, así que funciona servido desde la raíz de un dominio o desde una subcarpeta.

- **GitHub Pages:** en *Settings → Pages*, elegir la rama `main` y la carpeta `/ (root)`. El `index.html` de la
  raíz lleva a `mavic/`. El archivo `.nojekyll` hace que Pages sirva los archivos tal cual.
- **Vercel o Netlify:** crear el proyecto con `mavic` como carpeta raíz ("Root Directory" o "Base directory"),
  sin comando de build.
- **Hosting con Apache (cPanel):** subir el contenido de `mavic/` a la carpeta pública del dominio. Incluye un
  `.htaccess` con caché, compresión y página de error.

## Sobre el sitio de Mavic

- La carpeta `mavic/` es **salida generada**: no se edita a mano. La fuente y el generador están en el
  repositorio del proyecto (`mavic_web`); para cambiar algo se edita ahí, se regenera y se vuelve a copiar.
- Es un borrador: las páginas piden a los buscadores que no las indexen y faltan textos que tiene que
  completar Mavic. Los botones de WhatsApp llevan a la página de contacto hasta que se cargue el número.
- La página `404.html` usa rutas desde la raíz del dominio: se ve bien solo si el sitio está en la raíz.
