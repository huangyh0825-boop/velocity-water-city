"""Lossless, relative glTF image sidecars. No resampling or geometry reduction."""
import hashlib,json,re,struct
from pathlib import Path

def external_images(path,folder):
 data=Path(path).read_bytes();length=struct.unpack_from('<I',data,12)[0]
 doc=json.loads(data[20:20+length]);binary=data[28+length:];removed=set();images=[]
 output=Path(path).parent/folder;output.mkdir(parents=True,exist_ok=True)
 for image in doc.get('images',[]):
  if 'bufferView' not in image:continue
  index=image.pop('bufferView');view=doc['bufferViews'][index];removed.add(index)
  start=view.get('byteOffset',0);payload=binary[start:start+view['byteLength']]
  name=re.sub('[^a-zA-Z0-9_-]','-',image.get('name','image'))+'-'+hashlib.sha256(payload).hexdigest()[:10]+'.png'
  (output/name).write_bytes(payload);image['uri']=folder+'/'+name;images.append({'uri':image['uri'],'bytes':len(payload)})
 rebuilt=bytearray();views=[];mapping={}
 for i,view in enumerate(doc['bufferViews']):
  if i in removed:continue
  rebuilt.extend(b'\0'*((-len(rebuilt))%4));mapping[i]=len(views)
  value=dict(view);start=value.get('byteOffset',0);value['byteOffset']=len(rebuilt)
  rebuilt.extend(binary[start:start+value['byteLength']]);views.append(value)
 def remap(value):
  if isinstance(value,dict):
   for key,item in value.items():
    if key=='bufferView':value[key]=mapping[item]
    else:remap(item)
  elif isinstance(value,list):
   for item in value:remap(item)
 remap(doc);doc['bufferViews']=views;doc['buffers'][0]['byteLength']=len(rebuilt)
 encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
 rebuilt.extend(b'\0'*((-len(rebuilt))%4))
 Path(path).write_bytes(struct.pack('<III',0x46546c67,2,28+len(encoded)+len(rebuilt))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(rebuilt),0x004e4942)+rebuilt)
 return images
