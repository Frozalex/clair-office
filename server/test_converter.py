import hashlib
import io
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch
import zipfile
from converter import convert, validate_input, conversion_filter, ConversionError, profile_config

def docx():
    out=io.BytesIO()
    with zipfile.ZipFile(out,'w') as z: z.writestr('word/document.xml','<document/>')
    return out.getvalue()

class ConversionTests(unittest.TestCase):
    def test_filter_families(self):
        self.assertIn('MS Word 97',conversion_filter('docx','doc'))
        self.assertIn('PowerPoint',conversion_filter('ppt','pptx'))
        with self.assertRaises(ConversionError): conversion_filter('pptx','docx')
        with self.assertRaises(ConversionError): conversion_filter('docx','exe')
    def test_identity_is_byte_exact(self):
        data=docx()
        result,ext=convert(data,'docx','docx')
        self.assertEqual(hashlib.sha256(data).digest(),hashlib.sha256(result).digest())
        self.assertEqual(ext,'docx')
    def test_rejects_fake_binary_and_zip(self):
        for data,ext in [(b'not office','doc'),(b'not a zip','pptx'),(docx(),'pptx')]:
            with self.assertRaises(ConversionError): validate_input(data,ext)
    def test_rejects_external_assets(self):
        out=io.BytesIO()
        with zipfile.ZipFile(out,'w') as z:
            z.writestr('word/document.xml','<doc/>')
            z.writestr('word/_rels/document.xml.rels','<Relationships><Relationship TargetMode="External" Type="image" Target="file:///private"/></Relationships>')
        with self.assertRaises(ConversionError): validate_input(out.getvalue(),'docx')
    def test_macro_profile(self):
        with tempfile.TemporaryDirectory() as d:
            profile_config(Path(d))
            text=(Path(d)/'user/registrymodifications.xcu').read_text()
            self.assertIn('DisableMacrosExecution',text)
            self.assertIn('<value>3</value>',text)
    def test_no_engine_has_clear_failure(self):
        with patch('converter.executable',return_value=None):
            with self.assertRaisesRegex(ConversionError,'LibreOffice'): convert(docx(),'docx','pdf')
    def test_subprocess_error_not_success(self):
        with patch('converter.subprocess.run') as run:
            run.return_value.returncode=1
            with self.assertRaises(ConversionError): convert(docx(),'docx','pdf','/mock/soffice')

if __name__=='__main__': unittest.main()
