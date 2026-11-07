"""Package the app's source files in Scripting's documented ZIP layout."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
source = root / "Battlefield1Stats"
destination = root / "dist" / "bf1.zip"
destination.parent.mkdir(exist_ok=True)
with ZipFile(destination, "w", ZIP_DEFLATED) as archive:
    for file in sorted(source.rglob("*")):
        if file.is_file() and file.suffix in {".ts", ".tsx", ".json", ".md"}:
            info = ZipInfo(file.relative_to(source).as_posix(), (1980, 1, 1, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, file.read_bytes())
with ZipFile(destination) as archive:
    assert archive.testzip() is None
    assert {"script.json", "index.tsx", "runtime.ts"}.issubset(archive.namelist())
print(destination)
installable = source / "Battlefield1Stats.scripting"
installable.write_bytes(destination.read_bytes())
print(installable)
