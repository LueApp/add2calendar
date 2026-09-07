from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'extension' / 'manifest.json').read_text())['version']
target = root / 'dist' / f'pdc-calendar-{version}.zip'
target.parent.mkdir(exist_ok=True)
with ZipFile(target, 'w', ZIP_DEFLATED) as archive:
    for file in sorted((root / 'extension').rglob('*')):
        if file.is_file():
            archive.write(file, str(file.relative_to(root / 'extension')))
    for name in ['README.md', 'README.zh-CN.md', 'PRIVACY.md', 'PRIVACY.zh-CN.md', 'VALIDATION.md', 'LICENSE']:
        archive.write(root / name, name)
    for file in sorted((root / 'docs' / 'images').rglob('*')):
        if file.is_file():
            archive.write(file, str(file.relative_to(root)))
with ZipFile(target) as archive:
    manifest = json.loads(archive.read('manifest.json'))
    required = [manifest['background']['service_worker'], manifest['options_page']]
    for entry in manifest['content_scripts']:
        required.extend(entry.get('js', []))
        required.extend(entry.get('css', []))
    missing = set(required) - set(archive.namelist())
    if missing:
        raise RuntimeError(f'Missing extension files: {sorted(missing)}')
print(target)
