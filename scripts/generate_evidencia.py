"""
generate_evidencia.py
Genera paginas HTML en evidencia/ desde los archivos .md de extractions.
Ejecutar desde la raiz del proyecto: python scripts/generate_evidencia.py
"""

import os
import re
from pathlib import Path

# Rutas
EXTRACTIONS_DIR = Path(r"C:\Users\pablo\Documents\libro-uap\LeadMagnet\uap-leadmagnet\output\extractions")
OUTPUT_DIR = Path("evidencia")

def slugify(filename):
    """Convierte nombre de archivo a slug URL-friendly."""
    slug = filename.replace(".md", "")
    slug = slug.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug

def md_to_html(content):
    """Convierte markdown basico a HTML."""
    lines = content.split("\n")
    html_lines = []
    for line in lines:
        if line.startswith("## "):
            html_lines.append(f'<h2 class="font-headline-md text-headline-md text-secondary mt-8 mb-4 uppercase">{line[3:]}</h2>')
        elif line.startswith("# "):
            html_lines.append(f'<h1 class="font-headline-lg text-headline-lg text-primary mb-6 uppercase">{line[2:]}</h1>')
        elif line.startswith("**") and line.endswith("**"):
            html_lines.append(f'<p class="font-body-md text-body-md font-bold mb-2">{line[2:-2]}</p>')
        elif line.strip() == "---":
            html_lines.append('<hr class="border-outline-variant my-8"/>')
        elif line.strip() == "":
            html_lines.append('<div class="mb-4"></div>')
        else:
            # Inline bold
            line = re.sub(r"\*\*(.*?)\*\*", r"<strong>\1</strong>", line)
            # Inline code
            line = re.sub(r"`(.*?)`", r'<code class="font-metadata text-metadata text-primary bg-surface-container-low px-2 py-1">\1</code>', line)
            html_lines.append(f'<p class="font-body-md text-body-md mb-3">{line}</p>')
    return "\n".join(html_lines)

def generate_page(md_path, used_slugs):
    """Genera una pagina HTML desde un archivo .md."""
    content = md_path.read_text(encoding="utf-8", errors="ignore")

    # Extraer titulo (primera linea con #)
    title = md_path.stem
    for line in content.split("\n"):
        if line.startswith("# "):
            title = line[2:].strip()
            break

    # Extraer descripcion para SEO (primeros 160 chars de contenido)
    clean_content = re.sub(r"[#*\-]", "", content)
    description = " ".join(clean_content.split())[:160]

    # Slug con deteccion de colisiones
    base_slug = slugify(md_path.name)
    slug = base_slug
    counter = 2
    while slug in used_slugs:
        slug = f"{base_slug}-{counter}"
        counter += 1
    used_slugs.add(slug)
    output_path = OUTPUT_DIR / f"{slug}.html"
    
    # Renderizar contenido
    body_content = md_to_html(content)
    
    html = f"""<!DOCTYPE html>
<html class="dark" lang="es">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>{title} | IRREDUCTIBLE</title>
<meta name="description" content="{description}"/>
<meta property="og:title" content="{title} | IRREDUCTIBLE"/>
<meta property="og:description" content="{description}"/>
<meta property="og:url" content="https://irreductible.site/evidencia/{slug}"/>
<meta property="og:type" content="article"/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet"/>
<script id="tailwind-config">
tailwind.config = {{
  darkMode: "class",
  theme: {{
    extend: {{
      colors: {{
        "background": "#131313",
        "surface": "#131313",
        "surface-container-low": "#1c1b1b",
        "surface-container-lowest": "#0e0e0e",
        "outline-variant": "#4e4636",
        "outline": "#9a907d",
        "on-background": "#e5e2e1",
        "on-surface-variant": "#d1c5b0",
        "primary": "#ecc155",
        "secondary": "#98ccf6"
      }},
      fontFamily: {{
        "headline-lg": ["Bebas Neue"],
        "headline-md": ["Bebas Neue"],
        "headline-sm": ["Bebas Neue"],
        "body-md": ["Inter"],
        "metadata": ["JetBrains Mono"]
      }},
      fontSize: {{
        "headline-lg": ["48px", {{"lineHeight": "1.1", "letterSpacing": "0.05em"}}],
        "headline-md": ["32px", {{"lineHeight": "1.2", "letterSpacing": "0.05em"}}],
        "headline-sm": ["24px", {{"lineHeight": "1.2", "letterSpacing": "0.05em"}}],
        "body-md": ["16px", {{"lineHeight": "160%"}}],
        "metadata": ["12px", {{"lineHeight": "1.4", "letterSpacing": "0.15em"}}]
      }}
    }}
  }}
}}
</script>
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{title}",
  "description": "{description}",
  "author": {{"@type": "Person", "name": "Pablo Bravo"}},
  "publisher": {{"@type": "Organization", "name": "IRREDUCTIBLE"}},
  "url": "https://irreductible.site/evidencia/{slug}"
}}
</script>
</head>
<body class="bg-background text-on-background font-body-md min-h-screen">

<!-- NAV -->
<nav class="border-b border-outline-variant px-8 py-4 flex justify-between items-center">
  <a href="/" class="font-headline-sm text-headline-sm text-primary uppercase tracking-widest">IRREDUCTIBLE</a>
  <div class="flex gap-8">
    <a href="/" class="font-metadata text-metadata text-on-surface-variant uppercase hover:text-primary transition-colors">Lead Magnet</a>
    <a href="/libro" class="font-metadata text-metadata text-on-surface-variant uppercase hover:text-primary transition-colors">El Libro</a>
  </div>
</nav>

<!-- BREADCRUMB -->
<div class="max-w-4xl mx-auto px-8 pt-8">
  <p class="font-metadata text-metadata text-on-surface-variant uppercase">
    <a href="/" class="hover:text-primary transition-colors">INICIO</a>
    <span class="mx-2">/</span>
    <a href="/evidencia" class="hover:text-primary transition-colors">EVIDENCIA</a>
    <span class="mx-2">/</span>
    <span class="text-primary">{md_path.name}</span>
  </p>
</div>

<!-- HEADER DEL DOCUMENTO -->
<header class="max-w-4xl mx-auto px-8 pt-8 pb-6 border-b border-outline-variant">
  <div class="flex items-center gap-4 mb-4">
    <span class="font-metadata text-metadata bg-surface-container-low border border-outline-variant px-3 py-1 text-primary uppercase">CORPUS PURSUE</span>
    <span class="font-metadata text-metadata text-on-surface-variant uppercase">DESCLASIFICADO 08.05.2026</span>
  </div>
  <h1 class="font-headline-lg text-headline-lg text-on-background uppercase mb-4">{title}</h1>
  <code class="font-metadata text-metadata text-primary bg-surface-container-low px-3 py-2 block break-all">{md_path.stem}</code>
</header>

<!-- CONTENIDO -->
<main class="max-w-4xl mx-auto px-8 py-12">
  {body_content}
</main>

<!-- CTA LEAD MAGNET -->
<section class="max-w-4xl mx-auto px-8 py-12 border-t border-outline-variant">
  <div class="relative border border-outline-variant bg-surface-container-lowest p-8">
    <div class="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-primary"></div>
    <div class="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-primary"></div>
    <div class="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-primary"></div>
    <div class="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-primary"></div>
    <p class="font-metadata text-metadata text-on-surface-variant uppercase mb-4">ANALISIS COMPLETO DEL CORPUS PURSUE</p>
    <h2 class="font-headline-md text-headline-md text-primary uppercase mb-4">Archivos PURSUE: Siete casos que resistieron el descarte</h2>
    <p class="font-body-md text-body-md mb-6">Analice los 158 archivos desclasificados el 8 de mayo de 2026 e intente descartarlos con explicaciones convencionales. 151 cayeron. 7 no.</p>
    <a href="/" class="inline-block bg-primary text-black font-headline-sm text-headline-sm px-8 py-4 uppercase tracking-widest hover:opacity-90 transition-opacity">RECIBIR EL INFORME GRATUITO</a>
  </div>
</section>

<!-- FOOTER -->
<footer class="border-t border-outline-variant px-8 py-8 mt-8">
  <div class="max-w-4xl mx-auto flex justify-between items-center">
    <p class="font-metadata text-metadata text-on-surface-variant uppercase">IRREDUCTIBLE &copy; 2026 PABLO BRAVO</p>
    <p class="font-metadata text-metadata text-on-surface-variant uppercase">CORPUS PURSUE &mdash; DEPARTAMENTO DE GUERRA EE.UU.</p>
  </div>
</footer>

</body>
</html>"""
    
    return output_path, html

def main():
    if not EXTRACTIONS_DIR.exists():
        print(f"ERROR: No se encontro el directorio de extractions: {EXTRACTIONS_DIR}")
        return
    
    # Limpiar output previo
    if OUTPUT_DIR.exists():
        for f in OUTPUT_DIR.glob("*.html"):
            f.unlink()
    OUTPUT_DIR.mkdir(exist_ok=True)

    md_files = sorted(EXTRACTIONS_DIR.glob("*.md"))
    print(f"Encontrados {len(md_files)} archivos .md")

    used_slugs = set()
    generated = 0
    for md_path in md_files:
        try:
            output_path, html = generate_page(md_path, used_slugs)
            output_path.write_text(html, encoding="utf-8")
            generated += 1
            print(f"  OK: {md_path.name} -> {output_path.name}")
        except Exception as e:
            print(f"  ERROR: {md_path.name} — {e}")
    
    print(f"\nGeneradas {generated}/{len(md_files)} paginas en evidencia/")

    # Generar sitemap y robots
    slugs = sorted(used_slugs)
    generate_sitemap(slugs)
    generate_robots()

def generate_sitemap(slugs):
    """Genera sitemap.xml en la raiz del proyecto."""
    urls = [
        ("", "monthly", "1.0"),
        ("libro", "monthly", "0.9"),
    ]
    urls += [(f"evidencia/{s}", "monthly", "0.7") for s in slugs]

    xml = ['<?xml version="1.0" encoding="UTF-8"?>']
    xml.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    for path, freq, prio in urls:
        xml.append("  <url>")
        xml.append(f"    <loc>https://irreductible.site/{path}</loc>")
        xml.append(f"    <changefreq>{freq}</changefreq>")
        xml.append(f"    <priority>{prio}</priority>")
        xml.append("  </url>")
    xml.append("</urlset>")

    sitemap_path = Path("sitemap.xml")
    sitemap_path.write_text("\n".join(xml) + "\n", encoding="utf-8")
    print(f"Sitemap generado: {sitemap_path} ({len(urls)} URLs)")

def generate_robots():
    """Genera robots.txt en la raiz del proyecto."""
    robots = """User-agent: *
Allow: /
Sitemap: https://irreductible.site/sitemap.xml
"""
    robots_path = Path("robots.txt")
    robots_path.write_text(robots, encoding="utf-8")
    print(f"Robots generado: {robots_path}")

if __name__ == "__main__":
    main()
