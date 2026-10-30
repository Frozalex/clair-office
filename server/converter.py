#!/usr/bin/env python3
"""Local Office conversion companion. Python 3.11+, LibreOffice. No pip dependencies.

This service is intentionally bound to loopback. Do not expose it to the internet.
Untrusted documents should be processed in a disposable, network-isolated machine.
"""
from __future__ import annotations
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse
import zipfile

PORT = 8765
MAX_INPUT = 20_000_000
MAX_EXPANDED = 150_000_000
MAX_OUTPUT = 80_000_000
LOCK = threading.BoundedSemaphore(1)
WRITER = {"doc", "docx", "odt", "rtf"}
IMPRESS = {"ppt", "pptx", "odp"}
FILTERS = {
    "writer": {"doc": "MS Word 97", "docx": "Office Open XML Text", "odt": "writer8", "rtf": "Rich Text Format", "pdf": "writer_pdf_Export", "txt": "Text (encoded):UTF8", "html": "HTML (StarWriter)"},
    "impress": {"ppt": "MS PowerPoint 97", "pptx": "Impress MS PowerPoint 2007 XML", "odp": "impress8", "pdf": "impress_pdf_Export"},
}
MIMES = {"pdf": "application/pdf", "doc": "application/msword", "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "ppt": "application/vnd.ms-powerpoint", "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation", "odt": "application/vnd.oasis.opendocument.text", "odp": "application/vnd.oasis.opendocument.presentation", "rtf": "application/rtf", "txt": "text/plain; charset=utf-8", "html": "text/html; charset=utf-8", "zip": "application/zip"}

class ConversionError(Exception):
    pass

def executable():
    override = os.environ.get("CLAIR_SOFFICE")
    return override if override and Path(override).is_file() else shutil.which("libreoffice") or shutil.which("soffice")

def conversion_filter(extension, target):
    family = "writer" if extension in WRITER else "impress" if extension in IMPRESS else None
    if not family or target not in FILTERS[family]:
        raise ConversionError("Ce couple de formats n’est pas pris en charge.")
    return f"{target}:{FILTERS[family][target]}"

def validate_input(data, extension):
    if not data or len(data) > MAX_INPUT:
        raise ConversionError("Le fichier doit contenir entre 1 octet et 20 Mo.")
    if extension not in WRITER | IMPRESS:
        raise ConversionError("Format source non pris en charge.")
    if extension in {"doc", "ppt"}:
        if not data.startswith(bytes.fromhex("d0cf11e0a1b11ae1")):
            raise ConversionError("Ce fichier ne correspond pas à un document Office binaire.")
    elif extension == "rtf":
        if not data.lstrip().startswith(b"{\\rtf"):
            raise ConversionError("Ce fichier ne correspond pas à un document RTF.")
    else:
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                entries = archive.infolist()
                if len(entries) > 15000 or sum(i.file_size for i in entries) > MAX_EXPANDED:
                    raise ConversionError("Archive Office trop volumineuse après décompression.")
                names = set(archive.namelist())
                if any(i.flag_bits & 1 for i in entries):
                    raise ConversionError("Les fichiers chiffrés ne sont pas pris en charge.")
                required = {"docx": "word/document.xml", "pptx": "ppt/presentation.xml", "odt": "content.xml", "odp": "content.xml"}[extension]
                if required not in names:
                    raise ConversionError("Le contenu du fichier ne correspond pas à son extension.")
                # External relationships can cause network access or local-file disclosure.
                # Reject instead of rewriting the source silently. Ordinary hyperlinks are safe.
                for entry in entries:
                    if entry.filename.endswith(".rels"):
                        if entry.file_size > 2_000_000:
                            raise ConversionError("Relations Office trop volumineuses.")
                        import xml.etree.ElementTree as ET
                        root = ET.fromstring(archive.read(entry))
                        for rel in root:
                            if rel.attrib.get("TargetMode") == "External" and not rel.attrib.get("Type", "").endswith("/hyperlink"):
                                raise ConversionError("Ce fichier contient des ressources externes. Incorporez-les avant la conversion locale.")
        except (zipfile.BadZipFile, KeyError, ValueError) as exc:
            raise ConversionError("Archive Office invalide ou endommagée.") from exc

def profile_config(profile):
    user = profile / "user"
    user.mkdir(parents=True)
    (user / "registrymodifications.xcu").write_text('''<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry">
<item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop><prop oor:name="DisableMacrosExecution" oor:op="fuse"><value>true</value></prop></item>
<item oor:path="/org.openoffice.Office.Common/Load"><prop oor:name="UpdateDocMode" oor:op="fuse"><value>0</value></prop></item>
</oor:items>''', encoding="utf-8")

def convert(data, extension, target, program=None):
    filter_name = conversion_filter(extension, target)
    validate_input(data, extension)
    # Identity conversion must be byte-for-byte, without passing through LibreOffice.
    if extension == target:
        return data, target
    program = program or executable()
    if not program:
        raise ConversionError("LibreOffice n’est pas installé. Installez-le puis relancez le moteur.")
    with tempfile.TemporaryDirectory(prefix="clair-convert-") as temp:
        root = Path(temp)
        source = root / f"original.{extension}"
        output = root / "output"
        output.mkdir()
        profile = root / "profile"
        profile_config(profile)
        source.write_bytes(data)
        command = [str(program), f"-env:UserInstallation={profile.as_uri()}", "--headless", "--nologo", "--nodefault", "--nolockcheck", "--norestore", "--convert-to", filter_name, "--outdir", str(output), str(source)]
        try:
            completed = subprocess.run(command, cwd=root, capture_output=True, timeout=80, check=False)
        except subprocess.TimeoutExpired as exc:
            raise ConversionError("La conversion a dépassé 80 secondes. Essayez un fichier plus léger.") from exc
        except OSError as exc:
            raise ConversionError("Impossible de démarrer LibreOffice.") from exc
        produced = output / f"original.{target}"
        if completed.returncode != 0 or not produced.is_file() or produced.stat().st_size == 0:
            raise ConversionError("LibreOffice n’a pas pu convertir ce fichier. Vérifiez qu’il n’est ni protégé par mot de passe, ni endommagé.")
        outputs = [p for p in output.rglob("*") if p.is_file()]
        if any(p.is_symlink() for p in output.rglob("*")) or sum(p.stat().st_size for p in outputs) > MAX_OUTPUT:
            raise ConversionError("Le résultat dépasse la limite de 80 Mo ou contient un fichier inattendu.")
        if target == "html":
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
                for path in outputs:
                    archive.write(path, str(path.relative_to(output)))
            return buffer.getvalue(), "zip"
        return produced.read_bytes(), target

class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    def setup(self):
        super().setup()
        self.connection.settimeout(100)
    def allowed_origin(self):
        origin = self.headers.get("Origin")
        # Vite forwards the browser's Origin unchanged; localhost only, any dev port.
        if origin:
            parsed = urlparse(origin)
            if parsed.scheme not in {"http", "https"} or parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
                return False
        host = self.headers.get("Host", "").split(":")[0]
        return host in {"localhost", "127.0.0.1"}
    def send(self, status, data, mime="application/json", extra=None):
        body = json.dumps(data, ensure_ascii=False).encode() if isinstance(data, dict) else data
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Connection", "close")
        for key, value in (extra or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)
        self.close_connection = True
    def do_GET(self):
        if not self.allowed_origin():
            return self.send(403, {"error": "Accès local uniquement."})
        if urlparse(self.path).path != "/api/health":
            return self.send(404, {"error": "Route introuvable."})
        self.send(200, {"service": "clair-office-converter", "available": bool(executable()), "max_input_bytes": MAX_INPUT, "formats": {"document": list(FILTERS["writer"]), "presentation": list(FILTERS["impress"])}})
    def do_POST(self):
        if not self.allowed_origin():
            return self.send(403, {"error": "Accès local uniquement."})
        path = urlparse(self.path)
        if path.path != "/api/convert":
            return self.send(404, {"error": "Route introuvable."})
        if self.headers.get("Content-Type") != "application/octet-stream" or self.headers.get("Transfer-Encoding"):
            return self.send(415, {"error": "Envoyez les octets du fichier avec Content-Type: application/octet-stream."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if not 0 < length <= MAX_INPUT:
            return self.send(413, {"error": "Fichier vide ou supérieur à 20 Mo."})
        query = parse_qs(path.query)
        name = query.get("name", [""])[0]
        extension = Path(name).suffix.lower().lstrip(".")
        target = query.get("to", [""])[0].lower()
        try:
            conversion_filter(extension, target)
        except ConversionError as exc:
            return self.send(422, {"error": str(exc)})
        if not LOCK.acquire(blocking=False):
            return self.send(429, {"error": "Une conversion est déjà en cours. Réessayez dans un instant."})
        try:
            data = self.rfile.read(length)
            if len(data) != length:
                raise ConversionError("Fichier reçu incomplet.")
            converted, output = convert(data, extension, target)
            self.send(200, converted, MIMES[output], {"X-Output-Extension": output, "X-Original-SHA256": hashlib.sha256(data).hexdigest(), "Content-Disposition": f'attachment; filename="conversion.{output}"'})
        except ConversionError as exc:
            self.send(422, {"error": str(exc)})
        except Exception:
            self.send(500, {"error": "La conversion a échoué. Votre original reste intact."})
        finally:
            LOCK.release()
    def log_message(self, format, *args):
        # Do not log document names carried by request URLs.
        pass

if __name__ == "__main__":
    print(f"Clair Office · moteur local sur http://127.0.0.1:{PORT}", flush=True)
    print("LibreOffice disponible" if executable() else "LibreOffice absent : installez-le ou définissez CLAIR_SOFFICE.", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
