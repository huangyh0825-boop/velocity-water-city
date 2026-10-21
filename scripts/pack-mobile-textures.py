"""Phone standard only: retain all PBR channels, cap textures at 1024px."""
import json, hashlib
from pathlib import Path
from PIL import Image
base=Path('public/models');out=base/'mobile-textures';out.mkdir(exist_ok=True)
manifest={}
for name in ['watercraft','rider']:
 data=(base/f'{name}.glb').read_bytes();g=json.loads(data[20:20+int.from_bytes(data[12:16],'little')])
 for image in g['images']:
  uri=image['uri'];source=base/uri;key=hashlib.sha256(source.read_bytes()).hexdigest()[:20];dest=out/f'{key}.webp'
  if not dest.exists():
   im=Image.open(source);im.thumbnail((1024,1024),Image.Resampling.LANCZOS);im.save(dest,lossless=True,exact=True,method=4)
  manifest[uri]=dest.relative_to(base).as_posix()
(out/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(f'{len(manifest)} phone texture references ready')
