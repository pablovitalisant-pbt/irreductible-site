# CONTEXT-CLAUDE-CHAT.md — irreductible-site

## Qué es este proyecto

Sitio web estático para IRREDUCTIBLE (libro de Pablo Bravo sobre UAP) y su lead magnet "Archivos PURSUE: Siete casos que resistieron el descarte".

HTML puro, sin frameworks, desplegado en Vercel con dominio `irreductible.site`.

---

## Stack

- HTML estático puro
- Python 3 para generación de páginas de evidencia
- Vercel (hosting, deploy automático desde GitHub)
- GitHub: `pablovitalisant-pbt/irreductible-site`
- Systeme.io (emails, checkout, entrega del lead magnet)

---

## Páginas del sitio

| URL | Archivo | Estado |
|-----|---------|--------|
| irreductible.site | index.html | Copia de landing_leadmagnet/code.html |
| irreductible.site/libro | libro.html | Copia de landing_libro/code.html |
| irreductible.site/evidencia/[slug] | evidencia/*.html | Generadas por script desde .md |

---

## Archivos de entrada

```
C:\Users\pablo\Documents\libro-uap\website\landing_leadmagnet\code.html
C:\Users\pablo\Documents\libro-uap\website\landing_libro\code.html
C:\Users\pablo\Documents\libro-uap\LeadMagnet\uap-leadmagnet\output\extractions\*.md (~66 archivos)
```

---

## Precios del libro

- Ebook: USD $10
- Libro físico: USD $28.50

---

## Systeme.io

- Formulario de captura: script embed en index.html y páginas de evidencia
- Checkout preventa: URL de Systeme.io linkeada desde libro.html
- Entrega del lead magnet PDF: automática post-captura en Systeme.io

---

## DNS Namecheap

```
Type: A     Host: @    Value: 76.76.21.21
Type: CNAME Host: www  Value: cname.vercel-dns.com
```

---

## Estado del backlog

### Completado
- [x] Sesión 0: PRD, CLAUDE.md, script PowerShell

### Pendiente
- [ ] Crear repo GitHub `irreductible-site`
- [ ] Copiar HTMLs existentes
- [ ] Script generate_evidencia.py + ejecución
- [ ] Push → deploy Vercel
- [ ] Conectar dominio Namecheap
- [ ] Embed Systeme.io en index.html

---

## Contexto del libro

**Título:** IRREDUCTIBLE. La Anomalía Persistente
**Autor:** Pablo Bravo
**Tema:** Auditoría histórica y forense del fenómeno UAP desde 1561 hasta las audiencias del Congreso 2023. Aplica proceso de eliminación de hipótesis convencionales.
**Lead magnet:** "Archivos PURSUE: Siete casos que resistieron el descarte" — análisis de los 158 archivos desclasificados el 8 de mayo de 2026.

---

## Cómo usar este archivo

Pega este contenido al inicio de una nueva conversación con Claude chat cuando necesites retomar decisiones de arquitectura. Actualiza "Estado del backlog" a medida que avanzas.
