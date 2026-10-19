"""Lossless WebP with decoded RGBA equality, unchanged resolution and ICC."""
import hashlib,json
from pathlib import Path
from PIL import Image

base=Path('public/models');out=base/'runtime-textures';out.mkdir(exist_ok=True)
manifest={};report=[];seen={}
for name in ['watercraft','rider']:
    data=(base/f'{name}.glb').read_bytes();g=json.loads(data[20:20+int.from_bytes(data[12:16],'little')])
    for image in g['images']:
        uri=image['uri'];source=base/uri;raw=source.read_bytes();key=hashlib.sha256(raw).hexdigest()
        if key not in seen:
            dest=out/f'{key[:20]}.webp';im=Image.open(source)
            if im.info.get('gamma') or im.getexif().get(274,1)!=1:raise ValueError(f'Unconverted color/orientation metadata: {uri}')
            options={'lossless':True,'exact':True,'method':6}
            if im.info.get('icc_profile'):options['icc_profile']=im.info['icc_profile']
            im.save(dest,**options)
            decoded=Image.open(dest)
            if im.size!=decoded.size or im.convert('RGBA').tobytes()!=decoded.convert('RGBA').tobytes():raise ValueError(f'Pixel mismatch: {uri}')
            seen[key]=dest.relative_to(base).as_posix()
            report.append({'source':uri,'runtime':seen[key],'width':im.width,'height':im.height,'sourceBytes':len(raw),'runtimeBytes':dest.stat().st_size,'decodedRGBA':'identical'})
        manifest[uri]=seen[key]
(out/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
Path('docs/startup-performance/lossless-textures.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({'references':len(manifest),'uniqueImages':len(seen),'uniquePNGBytes':sum(r['sourceBytes'] for r in report),'webpBytes':sum(r['runtimeBytes'] for r in report)}))
