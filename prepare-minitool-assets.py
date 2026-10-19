import json
import pathlib
import sys
import shutil
from PIL import Image

sys.path.insert(0, '/tmp/minitool-font-converter')

root = pathlib.Path('minitool-dist/assets')
root.mkdir(parents=True, exist_ok=True)
if not (root / 'cooper.woff').exists():
    from fontTools.ttLib import TTFont
    font = TTFont('素材包/英文字体-Corben/CooperBlackStd-3.otf')
    font.flavor = 'woff'
    font.save(root / 'cooper.woff')
assets = json.loads(pathlib.Path('/tmp/minitool-assets.json').read_text())
expected = set()
for item in assets:
    source = pathlib.Path('素材包/图片素材/贴纸素材') / item['folder'] / item['name']
    target = root / 'stickers' / item['folder'] / pathlib.Path(item['name']).with_suffix('.webp')
    target.parent.mkdir(parents=True, exist_ok=True)
    expected.add(target)
    with Image.open(source) as image:
        image = image.convert('RGBA')
        bounds = image.getchannel('A').getbbox()
        if bounds:
            image = image.crop(bounds)
        image.thumbnail((320, 320), Image.Resampling.LANCZOS)
        image.save(target, quality=85, method=6)
        browser_target = pathlib.Path('assets') / target.relative_to(root)
        browser_target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(target, browser_target)
        old = target.with_suffix('.png')
        if old.exists():
            old.unlink()
for stale in (root / 'stickers').rglob('*'):
    if stale.is_file() and stale not in expected:
        stale.unlink()
print('Converted font and', len(assets), 'stickers')
