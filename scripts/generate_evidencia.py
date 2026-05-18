"""
generate_evidencia.py
Genera paginas HTML en evidencia/ desde output/analysis.md.
Ejecutar desde la raiz del proyecto: python scripts/generate_evidencia.py
"""

import json
import re
from pathlib import Path

ANALYSIS_PATH = Path(r"C:\Users\pablo\Documents\libro-uap\LeadMagnet\uap-leadmagnet\output\analysis.md")
OUTPUT_DIR = Path("evidencia")
ASSETS_DIR = Path("assets/evidencia")
CLOUDINARY_JSON = Path("scripts/cloudinary_urls.json")

# Cargar URLs de Cloudinary
_cloudinary_urls = {}
if CLOUDINARY_JSON.exists():
    _cloudinary_urls = json.loads(CLOUDINARY_JSON.read_text(encoding="utf-8"))

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
    caso["filename"] = re.sub(r"^\d+\.\s*", "", m.group(1).strip())
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

def get_media_block(caso):
    """Genera bloque HTML con archivo fuente desde Cloudinary o war.gov."""
    fname = caso["filename"]
    ext = Path(fname).suffix.lower()
    entry = _cloudinary_urls.get(fname)

    if not entry:
        return ""

    # Determinar URL y fuente
    if isinstance(entry, dict):
        url = entry["url"]
        source = entry.get("source", "")
    else:
        url = entry
        source = "cloudinary"

    # Aviso para archivos servidos desde war.gov
    war_gov_warning = ""
    if source == "war.gov":
        war_gov_warning = """<p style='font-family:JetBrains Mono; font-size:11px; color:#9a907d; margin-bottom:8px;'>
    ⚠ ESTE ARCHIVO SE SIRVE DESDE WAR.GOV/UFO. EL GOBIERNO DE EE.UU. PUEDE MODIFICAR O ELIMINAR ESTA URL EN CUALQUIER MOMENTO SIN PREVIO AVISO.
    </p>"""

    if ext == ".pdf":
        return f"""{war_gov_warning}<a href="{url}" target="_blank" download style="display:block; background:#1c1b1b; border:1px solid #ecc155; color:#ecc155; font-family:'JetBrains Mono'; padding:16px; text-align:center; text-decoration:none;">
      -> DESCARGAR PDF ORIGINAL
    </a>"""
    elif ext in (".png", ".jpg"):
        return f"""{war_gov_warning}<img src="{url}" style="width:100%; border:1px solid #4e4636;" alt="{fname}"/>
    <a href="{url}" download class="inline-block mt-3 font-metadata text-metadata text-primary uppercase hover:opacity-80 transition-opacity">DESCARGAR ARCHIVO ORIGINAL</a>"""
    elif ext == ".mp4":
        return f"""{war_gov_warning}<video controls style="width:100%; border:1px solid #4e4636;">
      <source src="{url}" type="video/mp4"/>
    </video>
    <a href="{url}" download class="inline-block mt-3 font-metadata text-metadata text-primary uppercase hover:opacity-80 transition-opacity">DESCARGAR VIDEO ORIGINAL</a>"""
    return ""

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

    # Archivo fuente desde Cloudinary
    media_block = get_media_block(caso)

    # Imagen local: solo si no hay media_block con imagen Cloudinary
    fname = caso["filename"]
    ext = Path(fname).suffix.lower()
    has_cloudinary_img = ext in (".png", ".jpg") and fname in _cloudinary_urls
    image_html = ""
    if not has_cloudinary_img:
        img_path = get_image_for_case(caso)
        if img_path:
            image_html = f"""
    <div class="mb-8 border border-outline-variant">
      <img src="/{img_path}" alt="{title_attr}" class="w-full" style="border-radius: 0px;"/>
    </div>"""
    if media_block:
        media_block = f"""
    <div class="mb-8 p-6 border border-outline-variant bg-surface-container-lowest">
{media_block}
    </div>"""

    # Bloque CTA (usado 2 veces)
    cta_block = f"""<!-- CTA -->
    <section class="max-w-4xl mx-auto px-8 py-12 border-t border-outline-variant">
      <div class="relative border border-primary bg-surface-container-lowest p-8 text-center">
        <div class="corner-bracket bracket-tl"></div>
        <div class="corner-bracket bracket-tr"></div>
        <div class="corner-bracket bracket-bl"></div>
        <div class="corner-bracket bracket-br"></div>
        <p style='font-family:JetBrains Mono; font-size:11px; color:#d1c5b0; letter-spacing:0.15em; text-transform:uppercase; margin-bottom:8px;'>ANALISIS COMPLETO DEL CORPUS PURSUE</p>
        <h2 style='font-family:Bebas Neue; font-size:32px; color:#ecc155; margin-bottom:4px;'>151 CASOS ENCONTRARON UNA EXPLICACION CONVENCIONAL.</h2>
        <h2 style='font-family:Bebas Neue; font-size:32px; color:#ecc155; margin-bottom:16px;'>7 NO.</h2>
        <p style='font-family:Inter; font-size:16px; color:#e5e2e1; line-height:1.6; margin-bottom:8px;'>Analice los 158 archivos UAP desclasificados por el gobierno e intente descartarlos utilizando errores de percepcion, meteorologia, fallas de sensores y explicaciones convencionales.</p>
        <p style='font-family:Inter; font-size:16px; color:#e5e2e1; margin-bottom:8px;'>La mayoria colapso.</p>
        <p style='font-family:Inter; font-size:16px; color:#e5e2e1; margin-bottom:24px;'>Estos siete casos resistieron el proceso de eliminacion.</p>
        <a href='https://serviciosdigitalespbt.systeme.io/f2eb8a92' target='_self' style='display:inline-block; background:#ecc155; color:#000; font-family:Bebas Neue; font-size:20px; letter-spacing:0.1em; padding:16px 32px; text-decoration:none;'>DESCARGAR EL INFORME GRATUITO</a>
      </div>
    </section>"""

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
{cta_block}

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
{media_block}
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

{cta_block}

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


# --- Eventos Agrupados ---

# Config: evento -> {"lead": filename, "name": nombre, "frames": [lista ordenada],
#           "phases": [{"label": ..., "frames": [desde, hasta]}]}
EVENTS = {
    "FBI-Photo-B20.pdf": {
        "name": "FBI FLIR — Nochevieja 1999",
        "frames": [f"FBI-Photo-B{i}.pdf" for i in range(1, 25)],
        "desc": "24 fotogramas FLIR capturados por el FBI entre las 18:10:00 y las 18:22:12 del 31 de diciembre de 1999. Una secuencia de 12 minutos que muestra la evolucion de un objeto — desde una morfologia estructurada identificable hasta la aparicion de dos objetos simultaneos que resisten el descarte convencional.",
        "agency": "FBI", "era": "31/12/1999", "frames_label": "24 (B1–B24)",
        "phases": [
            {"label": "FASE 1 — OBJETO ESTRUCTURADO (18:10:00–18:10:06)", "range": (1, 2)},
            {"label": "FASE 2 — PUNTO ÚNICO, TRACKING ACTIVO (18:10:12–18:11:12)", "range": (3, 12)},
            {"label": "FASE 3 — DOS OBJETOS SIMULTÁNEOS (18:18:53–18:22:12)", "range": (13, 24)},
        ],
    },
    "FBI-Photo-A7.png": {
        "name": "FBI — Cámara de Seguimiento Aérea",
        "frames": [f"FBI-Photo-A{i}.png" for i in range(1, 9)],
        "desc": "8 fotogramas de camara de seguimiento aerea (optica o IR) con telemetria completamente redactada. La secuencia muestra un punto oscuro rastreado por el sistema, que en A7 cambia a punto claro — la anomalia mas notable del grupo.",
        "agency": "FBI", "era": "Indeterminada", "frames_label": "8 (A1–A8)",
        "phases": [
            {"label": "SECUENCIA COMPLETA — 8 FOTOGRAMAS", "range": (1, 8)},
        ],
    },
    "NASA-UAP-VM4-Apollo-12-1969.jpg": {
        "name": "Apollo 12 — Superficie Lunar 1969",
        "frames": [f"NASA-UAP-VM{i}-Apollo-12-1969.jpg" for i in range(1, 6)],
        "desc": "5 fotografias tomadas desde el modulo de comando del Apollo 12 durante su mision a la superficie lunar en noviembre de 1969. La camara Hasselblad capturo objetos anomalos que no han recibido explicacion oficial de la NASA.",
        "agency": "NASA", "era": "Noviembre 1969", "frames_label": "5 (VM1–VM5)",
        "phases": [
            {"label": "SECUENCIA COMPLETA — 5 FOTOGRAFIAS", "range": (1, 5)},
        ],
    },
    "65_HS1-834228961_62-HQ-83894_SUB_A.pdf": {
        "name": "HQ-83894 — Expediente Completo",
        "frames": [
            "65_HS1-834228961_62-HQ-83894_Section_1.pdf",
            "65_HS1-834228961_62-HQ-83894_Section_2.pdf",
            "65_HS1-834228961_62-HQ-83894_Section_3.pdf",
            "65_HS1-834228961_62-HQ-83894_Section_4.pdf",
            "65_HS1-834228961_62-HQ-83894_Section_5.pdf",
            "65_HS1-834228961_62-HQ-83894_Section_6.pdf",
            "65_HS1-834228961_62-HQ-83894_Section_7.pdf",
            "65_HS1-834228961_62-HQ-83894_Section_8.pdf",
            "65_HS1-834228961_62-HQ-83894_Section_9.pdf",
            "65_HS1-834228961_62-HQ-83894_Section_10.pdf",
            "65_HS1-834228961_62-HQ-83894_Serial_130.pdf",
            "65_HS1-834228961_62-HQ-83894_Serial_153.pdf",
            "65_HS1-834228961_62-HQ-83894_Serial_164.pdf",
            "65_HS1-834228961_62-HQ-83894_Serial_220.pdf",
            "65_HS1-834228961_62-HQ-83894_Serial_403.pdf",
            "65_HS1-834228961_62-HQ-83894_Serial_438.pdf",
            "65_HS1-834228961_62-HQ-83894_Serial_449.pdf",
            "65_HS1-834228961_62-HQ-83894_SUB_A.pdf",
        ],
        "desc": "Expediente completo HQ-83894. 18 archivos que componen un unico documento del Departamento de Guerra desclasificado en el corpus PURSUE. Incluye 10 secciones principales, 7 seriales anexos y un sub-anexo.",
        "agency": "DOW", "era": "1948–1955", "frames_label": "18 archivos",
        "phases": [
            {"label": "SECCIONES PRINCIPALES (1-10)", "range": (1, 10)},
            {"label": "SERIALES ANEXOS", "range": (11, 17)},
            {"label": "SUB-ANEXO A", "range": (18, 18)},
        ],
    },
    "38_143685_box7_Incident_Summaries_173-233.pdf": {
        "name": "Incident Summaries — Box 7",
        "frames": [
            "38_143685_box7_Incident_Summaries_1-100.pdf",
            "38_143685_box7_Incident_Summaries_101-172.pdf",
            "38_143685_box7_Incident_Summaries_173-233.pdf",
        ],
        "desc": "Informe completo de resumenes de incidentes (Box 7). 233 casos documentados en 3 volumenes consecutivos del archivo militar.",
        "agency": "DOW", "era": "Indeterminada", "frames_label": "3 volumenes",
        "phases": [
            {"label": "VOLUMEN 1 — INCIDENTES 1–100", "range": (1, 1)},
            {"label": "VOLUMEN 2 — INCIDENTES 101–172", "range": (2, 2)},
            {"label": "VOLUMEN 3 — INCIDENTES 173–233", "range": (3, 3)},
        ],
    },
}

def get_event_lead(filename):
    """Si el archivo es lead de un evento, devuelve la config del evento."""
    return EVENTS.get(filename)

def get_event_for_frame(filename):
    """Si el archivo pertenece a un evento, devuelve (lead, config)."""
    for lead, cfg in EVENTS.items():
        if filename in cfg["frames"]:
            return lead, cfg
    return None, None

def generate_event_page(lead_caso, all_casos, event_cfg, index, used_slugs):
    """Genera pagina HTML agrupada para un evento con timeline y todos los frames."""
    slug = slugify(lead_caso["filename"])
    used_slugs.add(slug)

    # Buscar todos los casos del evento en all_casos
    casos_map = {c["filename"]: c for c in all_casos}
    frames_casos = []
    for fname in event_cfg["frames"]:
        if fname in casos_map:
            frames_casos.append(casos_map[fname])
        else:
            frames_casos.append({"filename": fname, "score": 0, "categoria": "?", "fuente": "", "tipo": "", "tags": "", "observacion": "", "explicacion": "", "anomalia": ""})

    # SEO
    desc_raw = lead_caso.get("observacion", "")[:160].replace('"', '&quot;')
    title_raw = f"{event_cfg['name']} — Análisis de 24 fotogramas"

    score_labels = {1: "CONVENCIONAL", 2: "PROBABLE CONVENCIONAL", 3: "INTERMEDIO", 4: "ANÓMALO", 5: "ALTAMENTE ANÓMALO"}

    # Timeline HTML
    timeline_html = ""
    for ph in event_cfg["phases"]:
        r = ph["range"]
        timeline_html += f"""
        <div class="mb-6 p-4 border border-outline-variant bg-surface-container-low">
          <p class="font-headline-sm text-headline-sm text-primary uppercase mb-3">{ph['label']}</p>
          <div class="flex flex-wrap gap-2">"""
        for i in range(r[0], r[1] + 1):
            fname = f"FBI-Photo-B{i}.pdf"
            score = casos_map.get(fname, {}).get("score", 0)
            color = {5: "text-primary", 4: "text-primary", 3: "text-secondary", 2: "text-on-surface-variant", 1: "text-on-surface-variant", 0: "text-on-surface-variant"}.get(score, "text-on-surface-variant")
            border = "border-primary" if score >= 4 else "border-outline-variant"
            timeline_html += f"""
            <a href="#frame-b{i}" class="font-metadata text-metadata-sm {color} border {border} px-2 py-1 hover:bg-surface-container-high transition-colors">B{i} █{score}/5</a>"""
        timeline_html += """
          </div>
        </div>"""

    # Frames HTML
    frames_html = ""
    for fc in frames_casos:
        num = fc["filename"].replace("FBI-Photo-B", "").replace(".pdf", "")
        score = fc.get("score", 0)
        obs = md_to_html(fc.get("observacion", ""))
        expl = md_to_html(fc.get("explicacion", ""))
        anomalia = md_to_html(fc.get("anomalia", ""))
        img_path = get_image_for_case(fc) or ""
        cloud_url = _cloudinary_urls.get(fc["filename"], "")
        if isinstance(cloud_url, dict):
            cloud_url = cloud_url.get("url", "")
        img_html = ""
        # Solo imagenes, no PDFs ni videos
        fc_ext = Path(fc["filename"]).suffix.lower()
        if img_path and fc_ext in (".png", ".jpg"):
            img_html = f'<img src="/{img_path}" alt="B{num}" class="w-full border border-outline-variant mb-4"/>'
        elif cloud_url and fc_ext in (".png", ".jpg"):
            img_html = f'<img src="{cloud_url}" alt="B{num}" class="w-full border border-outline-variant mb-4"/>'

        frames_html += f"""
      <section id="frame-b{num}" class="border border-outline-variant bg-surface-container-lowest p-6 mb-4">
        <div class="flex justify-between items-start mb-4">
          <h4 class="font-headline-sm text-headline-sm text-primary uppercase">Fotograma B{num}</h4>
          <span class="font-metadata text-metadata text-secondary">{score_labels.get(score, "?")} — {fc.get("categoria", "?")}</span>
        </div>
        <p class="font-metadata text-metadata-sm text-on-surface-variant mb-2">FUENTE: {fc.get("fuente", "")}</p>
        {img_html}
        <div class="space-y-4">
          <div>
            <h6 class="font-headline-sm text-headline-sm text-secondary mb-2 uppercase">Observacion</h6>
            {obs}
          </div>
          <div>
            <h6 class="font-headline-sm text-headline-sm text-error mb-2 uppercase">Explicacion intentada</h6>
            {expl}
          </div>
          <div>
            <h6 class="font-headline-sm text-headline-sm text-primary mb-2 uppercase">Anomalia residual</h6>
            {anomalia}
          </div>
        </div>
      </section>"""

    # CTA block (same as regular pages)
    cta_block = """<!-- CTA -->
    <section class="max-w-4xl mx-auto px-8 py-12 border-t border-outline-variant">
      <div class="relative border border-primary bg-surface-container-lowest p-8 text-center">
        <div class="corner-bracket bracket-tl"></div>
        <div class="corner-bracket bracket-tr"></div>
        <div class="corner-bracket bracket-bl"></div>
        <div class="corner-bracket bracket-br"></div>
        <p style='font-family:JetBrains Mono; font-size:11px; color:#d1c5b0; letter-spacing:0.15em; text-transform:uppercase; margin-bottom:8px;'>ANALISIS COMPLETO DEL CORPUS PURSUE</p>
        <h2 style='font-family:Bebas Neue; font-size:32px; color:#ecc155; margin-bottom:4px;'>151 CASOS ENCONTRARON UNA EXPLICACION CONVENCIONAL.</h2>
        <h2 style='font-family:Bebas Neue; font-size:32px; color:#ecc155; margin-bottom:16px;'>7 NO.</h2>
        <p style='font-family:Inter; font-size:16px; color:#e5e2e1; line-height:1.6; margin-bottom:8px;'>Analice los 158 archivos UAP desclasificados por el gobierno e intente descartarlos utilizando errores de percepcion, meteorologia, fallas de sensores y explicaciones convencionales.</p>
        <p style='font-family:Inter; font-size:16px; color:#e5e2e1; margin-bottom:8px;'>La mayoria colapso.</p>
        <p style='font-family:Inter; font-size:16px; color:#e5e2e1; margin-bottom:24px;'>Estos siete casos resistieron el proceso de eliminacion.</p>
        <a href='https://serviciosdigitalespbt.systeme.io/f2eb8a92' target='_self' style='display:inline-block; background:#ecc155; color:#000; font-family:Bebas Neue; font-size:20px; letter-spacing:0.1em; padding:16px 32px; text-decoration:none;'>DESCARGAR EL INFORME GRATUITO</a>
      </div>
    </section>"""

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
        "background": "#131313", "surface": "#131313", "surface-container-low": "#1c1b1b",
        "surface-container-lowest": "#0e0e0e", "surface-container-high": "#2a2a2a",
        "outline-variant": "#4e4636", "outline": "#9a907d", "on-background": "#e5e2e1",
        "on-surface": "#e5e2e1", "on-surface-variant": "#d1c5b0",
        "primary": "#ecc155", "primary-container": "#ecc155", "on-primary": "#3e2e00",
        "secondary": "#98ccf6", "error": "#ffb4ab"
      }},
      fontFamily: {{
        "headline-lg": ["Bebas Neue"], "headline-md": ["Bebas Neue"], "headline-sm": ["Bebas Neue"],
        "body-md": ["Inter"], "body-lg": ["Inter"], "metadata": ["JetBrains Mono"], "metadata-sm": ["JetBrains Mono"]
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
</head>
<body class="bg-background text-on-background font-body-md min-h-screen">

<nav class="border-b border-outline-variant px-8 py-4 flex justify-between items-center">
  <a href="/" class="font-headline-sm text-headline-sm text-primary uppercase tracking-widest">IRREDUCTIBLE</a>
</nav>

<div class="max-w-4xl mx-auto px-8 pt-8">
  <p class="font-metadata text-metadata text-on-surface-variant uppercase">
    <a href="/" class="hover:text-primary transition-colors">INICIO</a>
    <span class="mx-2">/</span>
    <a href="/evidencia" class="hover:text-primary transition-colors">EVIDENCIA</a>
    <span class="mx-2">/</span>
    <span class="text-primary">{lead_caso["filename"]}</span>
  </p>
</div>

<section class="max-w-4xl mx-auto px-8 pt-8">
  <div class="mb-8">
    <h5 class="font-metadata text-metadata text-primary uppercase mb-1">// DOSSIER CASE_{index:02d} — EVENTO AGRUPADO</h5>
    <h1 class="font-headline-lg text-headline-lg text-on-background uppercase">{event_cfg["name"]}</h1>
    <p class="font-body-lg text-body-lg text-on-surface-variant mt-4">{event_cfg["desc"]}</p>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
    <div class="bg-surface-container-low border border-outline-variant p-4">
      <p class="font-metadata text-metadata-sm text-on-surface-variant uppercase">Agencia</p>
      <p class="font-metadata text-metadata text-primary">{event_cfg.get("agency", "?")}</p>
    </div>
    <div class="bg-surface-container-low border border-outline-variant p-4">
      <p class="font-metadata text-metadata-sm text-on-surface-variant uppercase">Epoca</p>
      <p class="font-metadata text-metadata text-primary">{event_cfg.get("era", "?")}</p>
    </div>
    <div class="bg-surface-container-low border border-outline-variant p-4">
      <p class="font-metadata text-metadata-sm text-on-surface-variant uppercase">Archivos</p>
      <p class="font-metadata text-metadata text-primary">{event_cfg.get("frames_label", str(len(event_cfg["frames"])))}</p>
    </div>
  </div>
</section>

{cta_block}

<section class="max-w-4xl mx-auto px-8 py-12">
  <h2 class="font-headline-md text-headline-md text-primary uppercase mb-8">Linea de tiempo — 3 fases</h2>
  {timeline_html}
</section>

<section class="max-w-4xl mx-auto px-8 pb-12">
  <h2 class="font-headline-md text-headline-md text-primary uppercase mb-8">Analisis fotograma por fotograma</h2>
  {frames_html}
</section>

{cta_block}

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
    dossier_index = 0

    # Primero: generar las 158 paginas individuales
    for i, caso in enumerate(casos):
        try:
            dossier_index += 1
            output_path, html = generate_page(caso, dossier_index, used_slugs)
            output_path.write_text(html, encoding="utf-8")
            generated += 1
            print(f"  OK: {caso['filename']} -> {output_path.name}")
        except Exception as e:
            print(f"  ERROR: {caso['filename']} — {e}")

    # Luego: generar las paginas de evento agrupadas (slugs con sufijo -evento)
    for lead_fname, event_cfg in EVENTS.items():
        try:
            lead_caso = next((c for c in casos if c["filename"] == lead_fname), None)
            if not lead_caso:
                print(f"  SKIP EVENTO {event_cfg['name']}: lead {lead_fname} no encontrado")
                continue
            base_slug = slugify(lead_fname)
            event_slug = f"{base_slug}-evento"
            used_slugs.add(event_slug)
            output_path, html = generate_event_page(lead_caso, casos, event_cfg, 0, used_slugs)
            # Corregir slug en el HTML (generate_event_page usa slugify normal)
            html = html.replace(f'/{base_slug}"', f'/{event_slug}"')
            html = html.replace(f'/{base_slug}\'', f'/{event_slug}\'')
            output_path = OUTPUT_DIR / f"{event_slug}.html"
            output_path.write_text(html, encoding="utf-8")
            generated += 1
            print(f"  OK: {lead_fname} -> {output_path.name} (EVENTO: {event_cfg['name']})")
        except Exception as e:
            print(f"  ERROR EVENTO {lead_fname} — {e}")

    print(f"\nGeneradas {generated}/{len(casos)} paginas en evidencia/")

    # Sitemap + robots
    slugs = sorted(used_slugs)
    generate_sitemap(slugs)
    generate_robots()

if __name__ == "__main__":
    main()
