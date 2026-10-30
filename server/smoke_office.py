"""Integration smoke test against a real LibreOffice binary.
Run npm test first to generate /tmp/clair-office-fixtures.
"""
import hashlib
import json
from pathlib import Path
import sys
import zipfile
import io
from converter import convert

fixtures=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/clair-office-fixtures')
output=fixtures/'converted'
output.mkdir(exist_ok=True)
results=[]
for source, targets in [('document.docx',['doc','odt','rtf','txt','html','pdf']),('presentation.pptx',['ppt','odp','pdf'])]:
    path=fixtures/source
    original=path.read_bytes()
    digest=hashlib.sha256(original).hexdigest()
    extension=path.suffix[1:]
    for target in targets:
        result,ext=convert(original,extension,target)
        (output/f'{path.stem}.{ext}').write_bytes(result)
        assert result, target
        if ext=='pdf': assert result.startswith(b'%PDF-'),target
        if target in ('doc','ppt'):
            restored,restored_ext=convert(result,target,extension)
            (output/f'{path.stem}-roundtrip.{restored_ext}').write_bytes(restored)
            with zipfile.ZipFile(io.BytesIO(restored)) as z:
                if extension=='docx':
                    assert 'Une idée'.encode() in z.read('word/document.xml')
                else:
                    slides=[n for n in z.namelist() if n.startswith('ppt/slides/slide') and n.endswith('.xml')]
                    assert len(slides)==3
        assert hashlib.sha256(path.read_bytes()).hexdigest()==digest
        results.append({'source':source,'target':target,'output_extension':ext,'bytes':len(result),'original_unchanged':True})
print(json.dumps(results,indent=2))
