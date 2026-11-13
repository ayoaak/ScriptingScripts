"""Package CF Usage in Scripting's flat ZIP source layout."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
source = root / 'CFUsage'
destination = source / 'CFUsage.scripting'
with ZipFile(destination, 'w', ZIP_DEFLATED) as archive:
    for file in sorted(source.rglob('*')):
        if file.is_file() and file.suffix in {'.ts', '.tsx', '.json', '.md'}:
            archive.write(file, file.relative_to(source).as_posix())
with ZipFile(destination) as archive:
    assert archive.testzip() is None
    assert {'script.json', 'index.tsx', 'widget.tsx', 'd1.ts', 'components/D1Ring.tsx'}.issubset(archive.namelist())
print(destination)
