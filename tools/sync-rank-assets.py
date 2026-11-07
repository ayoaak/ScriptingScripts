"""Download the exact BF1 rank badges from the user-supplied wiki table.

Usage: python3 tools/sync-rank-assets.py /path/to/mediawiki-parse-response.json
The input is the public action=parse, prop=text API response for
https://battlefield.fandom.com/wiki/Battlefield_1_online_ranks .
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import html
import json
import re
import sys
import urllib.request

root = Path(__file__).resolve().parents[1]
source = "https://battlefield.fandom.com/wiki/Battlefield_1_online_ranks"
markup = json.loads(Path(sys.argv[1]).read_text())["parse"]["text"]["*"]
bands = []
for row in re.findall(r"<tr[^>]*>(.*?)</tr>", markup, re.S):
    cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)
    if len(cells) < 3:
        continue
    rank = re.search(r"#(\d+)", re.sub(r"<[^>]+>", "", cells[0]))
    images = re.findall(r"<img[^>]*>", cells[1])
    if not rank or not images:
        continue
    attrs = dict(re.findall(r'([\w-]+)="([^"]*)"', images[0]))
    url = html.unescape(attrs.get("data-src", attrs.get("src", "")))
    if not url.startswith("https://static.wikia.nocookie.net/battlefield/"):
        raise ValueError("Unexpected badge source")
    value = int(rank.group(1))
    title = html.unescape(re.sub(r"<[^>]+>", "", cells[2])).strip()
    if not bands or url != bands[-1]["url"]:
        bands.append({"min": value, "max": value, "title": title, "url": url, "file": f"rank-{value:03d}.png", "sourceFile": attrs["data-image-name"]})
    else:
        bands[-1]["max"] = value
assert [(b["min"], b["max"]) for b in bands] == [(0, 0), (1, 9)] + [(v, min(v + 9, 150)) for v in range(10, 151, 10)]
destination = root / "Battlefield1Stats" / "assets" / "ranks"
destination.mkdir(parents=True, exist_ok=True)

def download(band):
    request = urllib.request.Request(band["url"] + "&format=original", headers={"User-Agent": "BF1StatsAssetPreparation/0.2"})
    with urllib.request.urlopen(request, timeout=30) as response:
        data = response.read()
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError(f"Not a PNG: {band['file']}")
    (destination / band["file"]).write_bytes(data)
    return band["file"]

with ThreadPoolExecutor(max_workers=4) as pool:
    for filename in pool.map(download, bands):
        print(filename)
(destination / "sources.json").write_text(json.dumps({"page": source, "bands": bands}, ensure_ascii=False, indent=2) + "\n")
