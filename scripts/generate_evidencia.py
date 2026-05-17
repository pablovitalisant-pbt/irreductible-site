"""
generate_evidencia.py
Genera paginas HTML en evidencia/ desde output/analysis.md.
Ejecutar desde la raiz del proyecto: python scripts/generate_evidencia.py
"""

import re
from pathlib import Path

ANALYSIS_PATH = Path(r"C:\Users\pablo\Documents\libro-uap\LeadMagnet\uap-leadmagnet\output\analysis.md")
OUTPUT_DIR = Path("evidencia")
ASSETS_DIR = Path("assets/evidencia")

# --- Parseo ---

def parse_analysis():
    """Parsea analysis.md en una lista de entradas (dict por caso)."""
    text = ANALYSIS_PATH.read_text(encoding="utf-8", errors="ignore")
    # Partir por "---" que separa cada caso
    bloques = text.split("\n---\n")
    casos = []
    for bloque in bloques:
        bloque = bloque.strip()
        if not bloque or not bloque.startswith("## "):
            continue
        caso = parse_bloque(bloque)
        if caso:
            casos.append(caso)
    return casos

def parse_bloque(bloque):
    """Parsea un bloque de caso individual."""
    lines = bloque.split("\n")
    caso = {}
    # Header: ## FILENAME — Score X/5 (Categoría X)
    header = lines[0]
    m = re.match(r"## (.+?) — Score (\d)/5 \(Categoría (\w+)\)", header)
    if not m:
        return None
    caso["filename"] = m.group(1).strip()
    caso["score"] = int(m.group(2))
    caso["categoria"] = m.group(3)

    # Metadata
    i = 1
    while i < len(lines):
        line = lines[i]
        if line.startswith("**Fuente:**"):
            caso["fuente"] = line.replace("**Fuente:**", "").strip().strip("`")
        elif line.startswith("**Tipo:**"):
            caso["tipo"] = line.replace("**Tipo:**", "").strip()
        elif line.startswith("**Tags:**"):
            caso["tags"] = line.replace("**Tags:**", "").strip()
        elif line.startswith("### Observación"):
            i += 1
            caso["observacion"] = extract_section(lines, i)
            continue
        elif line.startswith("### Explicación intentada"):
            i += 1
            caso["explicacion"] = extract_section(lines, i)
            continue
        elif line.startswith("### Anomalía residual"):
            i += 1
            caso["anomalia"] = extract_section(lines, i)
            continue
        i += 1

    caso.setdefault("observacion", "")
    caso.setdefault("explicacion", "")
    caso.setdefault("anomalia", "")
    return caso

def extract_section(lines, start):
    """Extrae contenido de una seccion hasta el siguiente ### o --- o fin."""
    content = []
    for line in lines[start:]:
        if line.startswith("### ") or line.startswith("---"):
            break
        content.append(line)
    # Unir y limpiar exceso de whitespace
    text = "\n".join(content).strip()
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text

# --- Utilidades ---

def slugify(filename):
    """Convierte nombre de archivo a slug URL-friendly."""
    slug = filename.replace(".md", "").replace(".pdf", "").replace(".mp4", "")
    slug = slug.replace(".png", "").replace(".jpg", "")
    slug = slug.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug

def extract_agency(caso):
    """Extrae agencia desde tags o filename."""
    tags = caso.get("tags", "").upper()
    fname = caso["filename"].upper()
    for agency in ["DOW", "DOD", "FBI", "NASA", "DOS", "USPER", "AARO"]:
        if agency in tags or agency in fname:
            return agency
    return "CORPUS PURSUE"

def extract_era(caso):
    """Extrae epoca desde tags."""
    tags = caso.get("tags", "")
    # Buscar años
    years = re.findall(r"(19\d{2}|20\d{2})", tags)
    if years:
        return years[0]
    # Buscar keywords
    if "Apollo" in tags:
        m = re.search(r"Apollo[-\s]*(\d+)", tags)
        if m:
            return f"Apollo {m.group(1)} · 1969-1972"
    return "Indeterminada"

def generate_title(caso):
    """Genera titulo periodistico del caso."""
    fname = caso["filename"]
    obs = caso.get("observacion", "")
    # Usar tags para contexto
    tags = caso.get("tags", "")

    # Casos especiales con titulos del corpus
    if "eight-pointed star" in obs.lower() or "estrella de 8 puntas" in obs.lower():
        return "La estrella de ocho puntas: ¿artefacto o algo más?"
    if "dos objetos" in obs.lower() and "simultáneos" in obs.lower():
        base = fname.split(".")[0]
        return f"{base}: dos objetos simultáneos en FLIR"

    # Generico: extraer primera frase significativa de la observacion
    first_sentence = obs.split(".")[0].strip()
    if len(first_sentence) > 120:
        first_sentence = first_sentence[:117] + "..."

    # Si la primera frase es muy corta, tomar dos frases
    if len(first_sentence) < 30 and "." in obs:
        parts = obs.split(".")
        if len(parts) >= 2:
            first_sentence = (parts[0] + ". " + parts[1]).strip()
            if len(first_sentence) > 120:
                first_sentence = first_sentence[:117] + "..."

    if not first_sentence:
        return fname

    return first_sentence

def get_image_for_case(caso):
    """Busca imagen asociada al caso en assets/evidencia/."""
    fname = caso["filename"]
    # Intentar coincidencia exacta
    for ext in [".png", ".jpg"]:
        base = Path(fname).stem
        img_path = ASSETS_DIR / f"{base}{ext}"
        if img_path.exists():
            return f"assets/evidencia/{base}{ext}"
    # Intentar con el nombre del archivo original (sin extension doble)
    stem = Path(fname).stem
    for ext in [".png", ".jpg"]:
        img_path = ASSETS_DIR / f"{stem}{ext}"
        if img_path.exists():
            return f"assets/evidencia/{stem}{ext}"
    return None

def score_bar(score):
    """Genera barra visual de score con bloques Unicode."""
    filled = "█" * score
    empty = "░" * (5 - score)
    return filled + empty

def md_to_html(text):
    """Convierte texto markdown basico a HTML inline."""
    if not text:
        return ""
    # Escape HTML primero
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # Bold
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    # Inline code
    text = re.sub(r"`(.+?)`", r'<code class="font-metadata text-metadata text-primary bg-surface-container-low px-1">\1</code>', text)
    # Convertir newlines a </p><p> respetando parrafos
    paragraphs = text.split("\n\n")
    html_parts = []
    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
        # Si contiene newline simple, usar <br>
        p = p.replace("\n", "<br/>")
        html_parts.append(f'<p class="font-body-md text-body-md mb-3">{p}</p>')
    return "\n".join(html_parts)

# --- Generacion HTML ---

def generate_page(caso, index, used_slugs):
    """Genera una pagina HTML para un caso."""
    title_raw = generate_title(caso)
    title_attr = title_raw.replace('"', '&quot;')

    # Slug
    base_slug = slugify(caso["filename"])
    slug = base_slug
    counter = 2
    while slug in used_slugs:
        slug = f"{base_slug}-{counter}"
        counter += 1
    used_slugs.add(slug)

    # Metadata
    agency = extract_agency(caso)
    era = extract_era(caso)
    fuente = caso.get("fuente", caso["filename"])
    score = caso["score"]
    categoria = caso["categoria"]

    # SEO description
    desc_raw = caso.get("observacion", "")[:160].replace('"', '&quot;')

    # Contenido
    observacion_html = md_to_html(caso.get("observacion", ""))
    explicacion_html = md_to_html(caso.get("explicacion", ""))
    anomalia_html = md_to_html(caso.get("anomalia", ""))

    # Imagen
    img_path = get_image_for_case(caso)
    image_html = ""
    if img_path:
        image_html = f"""
    <div class="mb-8 border border-outline-variant">
      <img src="/{img_path}" alt="{title_attr}" class="w-full" style="border-radius: 0px;"/>
    </div>"""

    # Score label
    score_labels = {1: "CONVENCIONAL", 2: "PROBABLE CONVENCIONAL", 3: "INTERMEDIO", 4: "ANÓMALO", 5: "ALTAMENTE ANÓMALO"}

    html = f"""<!DOCTYPE html>
<html class="dark" lang="es">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>{title_raw} | IRREDUCTIBLE</title>
<meta name="description" content="{desc_raw}"/>
<meta property="og:title" content="{title_raw} | IRREDUCTIBLE"/>
<meta property="og:description" content="{desc_raw}"/>
<meta property="og:url" content="https://irreductible.site/evidencia/{slug}"/>
<meta property="og:type" content="article"/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;700&family=JetBrains+Mono:wght@400;700&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
<style>
  .corner-bracket {{ position: absolute; width: 12px; height: 12px; border-color: #ecc155; z-index: 10; }}
  .bracket-tl {{ top: -1px; left: -1px; border-top: 2px solid; border-left: 2px solid; }}
  .bracket-tr {{ top: -1px; right: -1px; border-top: 2px solid; border-right: 2px solid; }}
  .bracket-bl {{ bottom: -1px; left: -1px; border-bottom: 2px solid; border-left: 2px solid; }}
  .bracket-br {{ bottom: -1px; right: -1px; border-bottom: 2px solid; border-right: 2px solid; }}
</style>
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
        "on-surface": "#e5e2e1",
        "on-surface-variant": "#d1c5b0",
        "primary": "#ecc155",
        "primary-container": "#ecc155",
        "on-primary": "#3e2e00",
        "secondary": "#98ccf6",
        "error": "#ffb4ab"
      }},
      fontFamily: {{
        "headline-lg": ["Bebas Neue"],
        "headline-md": ["Bebas Neue"],
        "headline-sm": ["Bebas Neue"],
        "body-md": ["Inter"],
        "body-lg": ["Inter"],
        "metadata": ["JetBrains Mono"],
        "metadata-sm": ["JetBrains Mono"]
      }},
      fontSize: {{
        "headline-lg": ["48px", {{"lineHeight": "1.1", "letterSpacing": "0.05em"}}],
        "headline-md": ["32px", {{"lineHeight": "1.2", "letterSpacing": "0.05em"}}],
        "headline-sm": ["24px", {{"lineHeight": "1.2", "letterSpacing": "0.05em"}}],
        "body-lg": ["18px", {{"lineHeight": "160%"}}],
        "body-md": ["16px", {{"lineHeight": "160%"}}],
        "metadata": ["12px", {{"lineHeight": "1.4", "letterSpacing": "0.15em"}}],
        "metadata-sm": ["10px", {{"lineHeight": "1.4", "letterSpacing": "0.15em"}}]
      }},
      borderRadius: {{ "DEFAULT": "0px" }}
    }}
  }}
}}
</script>
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{title_raw}",
  "description": "{desc_raw}",
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
    <span class="text-primary">{caso["filename"]}</span>
  </p>
</div>

<!-- CASO -->
<section class="max-w-4xl mx-auto px-8 pt-8 pb-12">
  <div class="flex justify-between items-start mb-8">
    <div>
      <h5 class="font-metadata text-metadata text-primary uppercase mb-1">// DOSSIER CASE_{index:02d}</h5>
      <h1 class="font-headline-lg text-headline-lg text-on-background uppercase">{title_raw}</h1>
    </div>
    <div class="text-right">
      <span class="font-metadata text-metadata text-secondary uppercase">ANOMALY_SCORE</span>
      <span class="block font-metadata text-metadata-sm text-on-surface-variant">{score_labels.get(score, "SIN CLASIFICAR")}</span>
      <div class="text-primary tracking-tighter text-xl mt-1">{score_bar(score)}</div>
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
    <div class="bg-surface-container-low border border-outline-variant p-4">
      <p class="font-metadata text-metadata-sm text-on-surface-variant uppercase">Agencia</p>
      <p class="font-metadata text-metadata text-primary">{agency}</p>
    </div>
    <div class="bg-surface-container-low border border-outline-variant p-4">
      <p class="font-metadata text-metadata-sm text-on-surface-variant uppercase">Época</p>
      <p class="font-metadata text-metadata text-primary">{era}</p>
    </div>
    <div class="bg-surface-container-low border border-outline-variant p-4">
      <p class="font-metadata text-metadata-sm text-on-surface-variant uppercase">Source Path</p>
      <p class="font-metadata text-metadata text-primary break-all">{fuente}</p>
    </div>
  </div>
{image_html}
  <div class="space-y-8">
    <div class="relative p-6 border border-outline-variant bg-surface-container-lowest">
      <div class="corner-bracket bracket-tl"></div>
      <div class="corner-bracket bracket-br"></div>
      <h6 class="font-headline-sm text-headline-sm text-secondary mb-4 uppercase">Lo que muestran los datos</h6>
{observacion_html}
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="p-6 border border-outline-variant">
        <h6 class="font-headline-sm text-headline-sm text-error mb-4 uppercase">El intento de descarte</h6>
{explicacion_html}
      </div>
      <div class="p-6 border border-primary bg-primary/5">
        <h6 class="font-headline-sm text-headline-sm text-primary mb-4 uppercase">Lo que queda sin explicar</h6>
{anomalia_html}
      </div>
    </div>
  </div>
</section>

<!-- CTA -->
<section class="max-w-4xl mx-auto px-8 py-12 border-t border-outline-variant">
  <div class="relative border border-outline-variant bg-surface-container-lowest p-8">
    <div class="corner-bracket bracket-tl"></div>
    <div class="corner-bracket bracket-tr"></div>
    <div class="corner-bracket bracket-bl"></div>
    <div class="corner-bracket bracket-br"></div>
    <p class="font-metadata text-metadata text-on-surface-variant uppercase mb-4">ANÁLISIS COMPLETO DEL CORPUS PURSUE</p>
    <h2 class="font-headline-md text-headline-md text-primary uppercase mb-4">Archivos PURSUE: Siete casos que resistieron el descarte</h2>
    <p class="font-body-md text-body-md mb-6">Analicé los 158 archivos desclasificados el 8 de mayo de 2026 e intenté descartarlos con explicaciones convencionales. 151 cayeron. 7 no.</p>
    <a href="https://serviciosdigitalespbt.systeme.io/f2eb8a92" class="inline-block bg-primary text-black font-headline-sm text-headline-sm px-8 py-4 uppercase tracking-widest hover:opacity-90 transition-opacity">RECIBIR EL INFORME GRATUITO</a>
  </div>
</section>

<!-- FOOTER -->
<footer class="border-t border-outline-variant px-8 py-8 mt-8">
  <div class="max-w-4xl mx-auto flex justify-between items-center">
    <p class="font-metadata text-metadata text-on-surface-variant uppercase">IRREDUCTIBLE &copy; 2026 PABLO BRAVO</p>
    <p class="font-metadata text-metadata text-on-surface-variant uppercase">CORPUS PURSUE — DEPARTAMENTO DE GUERRA EE.UU.</p>
  </div>
</footer>

</body>
</html>"""

    return OUTPUT_DIR / f"{slug}.html", html


# --- Sitemap y Robots ---

def generate_sitemap(slugs):
    urls = [
        ("", "monthly", "1.0"),
        ("libro", "monthly", "0.9"),
    ]
    urls += [(f"evidencia/{s}", "monthly", "0.7") for s in sorted(slugs)]

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
    robots = """User-agent: *
Allow: /
Sitemap: https://irreductible.site/sitemap.xml
"""
    robots_path = Path("robots.txt")
    robots_path.write_text(robots, encoding="utf-8")
    print(f"Robots generado: {robots_path}")


# --- Main ---

def main():
    if not ANALYSIS_PATH.exists():
        print(f"ERROR: No se encontro analysis.md: {ANALYSIS_PATH}")
        return

    casos = parse_analysis()
    print(f"Encontrados {len(casos)} casos en analysis.md")

    # Limpiar output previo
    if OUTPUT_DIR.exists():
        for f in OUTPUT_DIR.glob("*.html"):
            f.unlink()
    OUTPUT_DIR.mkdir(exist_ok=True)

    used_slugs = set()
    generated = 0
    for i, caso in enumerate(casos):
        try:
            output_path, html = generate_page(caso, i + 1, used_slugs)
            output_path.write_text(html, encoding="utf-8")
            generated += 1
            print(f"  OK: {caso['filename']} -> {output_path.name}")
        except Exception as e:
            print(f"  ERROR: {caso['filename']} — {e}")

    print(f"\nGeneradas {generated}/{len(casos)} paginas en evidencia/")

    # Sitemap + robots
    slugs = sorted(used_slugs)
    generate_sitemap(slugs)
    generate_robots()

if __name__ == "__main__":
    main()
