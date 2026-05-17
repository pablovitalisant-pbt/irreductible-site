"""
upload_corpus.py
Sube archivos del corpus PURSUE a Cloudinary.
Lee CLOUDINARY_URL desde .env (python-dotenv).
"""

import json
import os
from pathlib import Path

import cloudinary
import cloudinary.uploader
from urllib.parse import urlparse

from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

cloud_url = os.environ["CLOUDINARY_URL"]
parsed = urlparse(cloud_url)
cloudinary.config(
    cloud_name=parsed.hostname,
    api_key=parsed.username,
    api_secret=parsed.password,
)

RELEASE_DIR = Path(r"C:\Users\pablo\Downloads\UAP released\Release_1\Release_1")
VIDEOS_DIR = Path(r"C:\Users\pablo\Downloads\UAP released\uapvideos")
OUTPUT_JSON = Path("scripts/cloudinary_urls.json")
FOLDER = "pursue-corpus"

def upload_file(filepath):
    """Sube un archivo a Cloudinary en la carpeta pursue-corpus."""
    public_id = f"{FOLDER}/{filepath.stem}"
    result = cloudinary.uploader.upload(
        str(filepath),
        public_id=public_id,
        resource_type="auto",
        overwrite=True,
    )
    return result["secure_url"]

def main():
    urls = {}

    # Cargar existentes si hay
    if OUTPUT_JSON.exists():
        urls = json.loads(OUTPUT_JSON.read_text(encoding="utf-8"))

    # Release_1
    files_r1 = sorted(RELEASE_DIR.glob("*"))
    print(f"Release_1: {len(files_r1)} archivos")
    for fp in files_r1:
        if fp.is_dir():
            continue
        if fp.name in urls:
            print(f"  SKIP: {fp.name} (ya subido)")
            continue
        try:
            url = upload_file(fp)
            urls[fp.name] = url
            print(f"  OK: {fp.name}")
        except Exception as e:
            print(f"  ERROR: {fp.name} — {e}")

    # uapvideos
    files_vid = sorted(VIDEOS_DIR.glob("*"))
    print(f"uapvideos: {len(files_vid)} archivos")
    for fp in files_vid:
        if fp.is_dir():
            continue
        if fp.name in urls:
            print(f"  SKIP: {fp.name} (ya subido)")
            continue
        try:
            url = upload_file(fp)
            urls[fp.name] = url
            print(f"  OK: {fp.name}")
        except Exception as e:
            print(f"  ERROR: {fp.name} — {e}")

    OUTPUT_JSON.write_text(json.dumps(urls, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n{len(urls)} URLs guardadas en {OUTPUT_JSON}")

if __name__ == "__main__":
    main()
