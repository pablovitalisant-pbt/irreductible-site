# CLAUDE.md — irreductible-site

## Propósito del proyecto

Sitio web estático para IRREDUCTIBLE. HTML puro desplegado en Vercel. Sin frameworks. Sin build steps. Lo que se sube es lo que se ve.

---

## Stack

- HTML estático puro (sin React, sin Next.js, sin nada)
- Python 3 para el script de generación de páginas de evidencia
- Vercel para hosting
- GitHub: `pablovitalisant-pbt/irreductible-site`

## Comandos

```powershell
# Generar páginas de evidencia desde .md
python scripts/generate_evidencia.py

# Verificar que se generaron correctamente
Get-ChildItem evidencia/ | Measure-Object

# Push y deploy
git add .
git commit -m "mensaje"
git push
```

---

## Rutas críticas

### Archivos de entrada (NO modificar)
```
C:\Users\pablo\Documents\libro-uap\website\landing_leadmagnet\code.html
C:\Users\pablo\Documents\libro-uap\website\landing_libro\code.html
C:\Users\pablo\Documents\libro-uap\website\landing_libro\DESIGN.md
C:\Users\pablo\Documents\libro-uap\LeadMagnet\uap-leadmagnet\output\extractions\*.md
```

### Estructura del repo
```
irreductible-site/
  index.html          ← landing lead magnet (copia exacta, sin tocar)
  libro.html          ← landing libro (copia exacta, sin tocar)
  evidencia/          ← páginas generadas por script
  assets/
  scripts/
    generate_evidencia.py
  .gitignore
  README.md
```

---

## Regla de oro — NO tocar los HTMLs existentes

`index.html` y `libro.html` son copias exactas de los HTMLs generados por Stitch. No se modifican. No se refactorizan. No se "mejoran". Si hay que agregar el script de Systeme.io, se pega en el HTML sin tocar nada más.

---

## Sistema de diseño

Ver `C:\Users\pablo\Documents\libro-uap\website\landing_libro\DESIGN.md`

Paleta principal:
- Fondo: `#131313`
- Primario/acción: `#ecc155` (dorado ámbar)
- Secundario/HUD: `#98ccf6` (azul acero)
- Texto: `#e5e2e1`
- Metadata: `#d1c5b0`
- Bordes: `#4e4636`

Tipografías: Bebas Neue (títulos) · Inter (cuerpo) · JetBrains Mono (metadata)

Border radius: 0px en todo.

---

## Script generate_evidencia.py — especificación

### Input
Todos los `.md` en:
`C:\Users\pablo\Documents\libro-uap\LeadMagnet\uap-leadmagnet\output\extractions\`

### Output
Un `.html` por cada `.md` en `evidencia/`

Naming: `FBI-Photo-B20.pdf.md` → `evidencia/fbi-photo-b20-pdf.html`
Regla: lowercase, espacios y puntos a guiones, sin extensión `.md`

### Estructura de cada página

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <!-- Google Fonts: Bebas Neue, Inter, JetBrains Mono -->
  <!-- Meta SEO: title, description, og:* -->
  <!-- Schema: Article -->
  <!-- Tailwind CDN (mismo que los HTMLs existentes) -->
</head>
<body class="bg-[#131313] text-[#e5e2e1]">
  <!-- NAV: logo + enlaces Index y Libro -->
  <!-- HEADER del documento: chip agencia, ruta fuente, título -->
  <!-- CONTENIDO: markdown renderizado como HTML -->
  <!-- CTA: bloque con enlace al lead magnet -->
  <!-- FOOTER -->
</body>
</html>
```

### SEO por página
- `<title>`: `[nombre_archivo] | IRREDUCTIBLE`
- `<meta name="description">`: primeros 160 chars del contenido del .md
- `<meta property="og:title">`, `og:description`, `og:url`
- Schema JSON-LD: `Article` con `author: "Pablo Bravo"`, `publisher: "IRREDUCTIBLE"`

---

## Naming conventions

- Páginas: kebab-case (`fbi-photo-b20-pdf.html`)
- Script: snake_case (`generate_evidencia.py`)
- Sin espacios en nombres de archivo de output

---

## Deploy en Vercel

1. Conectar repo `pablovitalisant-pbt/irreductible-site` en Vercel
2. Framework preset: **Other** (no detectar framework)
3. Build command: vacío
4. Output directory: `.` (raíz del repo)
5. Cada push a `main` despliega automáticamente

## DNS en Namecheap

```
Type: A     Host: @    Value: 76.76.21.21
Type: CNAME Host: www  Value: cname.vercel-dns.com
```

---

## Referencia

Ver PRD.md para backlog completo.
