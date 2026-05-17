# PRD — irreductible-site

## Descripción del proyecto

Sitio web estático para el lanzamiento del libro IRREDUCTIBLE y su lead magnet "Archivos PURSUE: Siete casos que resistieron el descarte". El sitio aloja las páginas HTML generadas por Stitch sin modificación, añade ~66 páginas de evidencia generadas automáticamente desde archivos Markdown, y se despliega en Vercel con dominio personalizado irreductible.site.

---

## Usuarios

- **Visitante:** llega desde redes sociales, lee el lead magnet, deja su email, conoce el libro, compra en preventa.
- **Pablo (propietario):** actualiza contenido añadiendo archivos `.md` al repositorio y haciendo push.

---

## MVP — Lo que debe funcionar

1. Index del sitio = landing del lead magnet (`code.html` existente)
2. Landing del libro con precios de preventa (ebook USD $10, físico USD $28.50) (`code.html` existente)
3. ~66 páginas de evidencia generadas automáticamente desde `output/extractions/*.md`
4. Formulario de captura de emails conectado a Systeme.io
5. Dominio `irreductible.site` funcionando en Vercel con HTTPS

## Qué NO es parte del MVP

- Panel de administración
- Blog
- Sistema de comentarios
- Versión en inglés
- Buscador interno

---

## Archivos de entrada

### HTMLs existentes (no modificar el diseño)
- Landing lead magnet: `C:\Users\pablo\Documents\libro-uap\website\landing_leadmagnet\code.html`
- Landing libro: `C:\Users\pablo\Documents\libro-uap\website\landing_libro\code.html`
- Sistema de diseño: `C:\Users\pablo\Documents\libro-uap\website\landing_libro\DESIGN.md`

### Archivos Markdown de evidencia
- Extractions: `C:\Users\pablo\Documents\libro-uap\LeadMagnet\uap-leadmagnet\output\extractions\*.md`
- Aproximadamente 66 archivos `.md`

---

## Stack

- **HTML estático puro** — sin frameworks, sin build steps
- **Vercel** — hosting, deploy automático desde GitHub, HTTPS, dominio custom
- **GitHub** — repositorio `pablovitalisant-pbt/irreductible-site`
- **Systeme.io** — captura de emails, secuencia automática, entrega del lead magnet PDF, checkout de preventa

---

## Estructura de carpetas del proyecto

```
irreductible-site/
  index.html                    ← copia de landing_leadmagnet/code.html
  libro.html                    ← copia de landing_libro/code.html
  evidencia/
    [nombre-archivo].html       ← ~66 páginas generadas desde .md
  assets/
    lead-magnet-final.pdf       ← PDF del lead magnet (para Systeme.io)
  scripts/
    generate_evidencia.py       ← genera las páginas de evidencia desde .md
  .gitignore
  README.md
```

---

## Páginas de evidencia — especificación

Cada página en `evidencia/` se genera desde un `.md` de extractions con este formato de URL:

`irreductible.site/evidencia/[nombre-archivo-sin-extension]`

Ejemplo: `FBI-Photo-B20.pdf.md` → `evidencia/fbi-photo-b20-pdf.html`

### Estructura de cada página de evidencia

- Header con navegación (enlace a index y a libro)
- Chip de agencia y tipo de archivo
- Título del documento (nombre del archivo fuente)
- Ruta exacta del archivo fuente en el corpus PURSUE
- Contenido completo del `.md` renderizado
- Sección "¿Qué significa esto?" — contexto en lenguaje simple
- CTA al lead magnet (embed de Systeme.io)
- Footer

### SEO por página

- `<title>`: nombre del documento + "| IRREDUCTIBLE"
- `<meta description>`: primeras 160 caracteres del contenido
- `<meta og:*>` para redes sociales
- Schema markup: `Article` con `datePublished`, `author`, `about`

---

## Integración Systeme.io

- Formulario de captura: script embed pegado en `index.html` y en cada página de evidencia
- Checkout preventa libro: URL de Systeme.io linkeada desde `libro.html`
- El PDF del lead magnet se sube a Systeme.io para entrega automática post-captura

---

## Dominio y DNS

En Namecheap, agregar dos registros:
```
Type: A     Host: @    Value: 76.76.21.21
Type: CNAME Host: www  Value: cname.vercel-dns.com
```

---

## Backlog priorizado

### Fase 1 — MVP
1. Crear repo GitHub `irreductible-site`
2. Copiar HTMLs existentes sin modificar
3. Script `generate_evidencia.py` — genera ~66 páginas desde `.md`
4. Ejecutar script, verificar output
5. Push a GitHub → deploy en Vercel
6. Conectar dominio en Namecheap

### Fase 2 — Post-MVP
7. Conectar Systeme.io (embed formulario + URL checkout)
8. Páginas de evidencia con imágenes incrustadas (FBI-Photo, NASA-UAP-VM)
9. Sitemap.xml generado automáticamente
10. robots.txt

---

## Criterio de éxito

`irreductible.site` carga el lead magnet, `irreductible.site/libro` muestra la preventa, y cada archivo del corpus PURSUE tiene su propia URL indexable en `irreductible.site/evidencia/`.
