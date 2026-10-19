import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';

// Lossless transport encoding only: no quantization, simplification, index
// rotation, vertex reordering, material edits or texture resampling.
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const size={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
const width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};
const report=[];
for(const name of ['watercraft','rider']){
 const source=readFileSync(`public/models/${name}.glb`),jsonBytes=source.readUInt32LE(12);
 const g=JSON.parse(source.subarray(20,20+jsonBytes)),bin=source.subarray(28+jsonBytes);
 const manifestPath='public/models/runtime-textures/manifest.json';
 if(!existsSync(manifestPath))throw Error('Run scripts/pack-runtime-textures.py first (Python + Pillow).');
 {
  const textures=JSON.parse(readFileSync(manifestPath,'utf8'));
  for(const image of g.images){if(!textures[image.uri])throw Error(`Missing texture ${image.uri}`);image.uri=textures[image.uri];image.mimeType='image/webp';}
  for(const texture of g.textures){texture.extensions={...texture.extensions,EXT_texture_webp:{source:texture.source}};delete texture.source;}
  g.extensionsUsed=[...(g.extensionsUsed??[]),'EXT_texture_webp'];g.extensionsRequired=[...(g.extensionsRequired??[]),'EXT_texture_webp'];
 }
 const chunks=[],encoded=new Map();let offset=0;
 const indices=new Set(g.meshes.flatMap(m=>m.primitives.map(p=>p.indices)));
 for(const [i,v] of g.bufferViews.entries()){
  const accessor=g.accessors.find(a=>a.bufferView===i);
  if(!accessor||g.accessors.some(a=>a.bufferView===i&&(a.byteOffset||0)!==0))throw Error('Unsupported buffer layout');
  const stride=v.byteStride??size[accessor.componentType]*width[accessor.type];
  const count=v.byteLength/stride,mode=indices.has(g.accessors.indexOf(accessor))?'INDICES':'ATTRIBUTES';
  const raw=bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength);
  const packed=MeshoptEncoder.encodeGltfBuffer(raw,count,stride,mode),decoded=new Uint8Array(raw.length);
  MeshoptDecoder.decodeGltfBuffer(decoded,count,stride,packed,mode);
  if(!Buffer.from(decoded).equals(raw))throw Error(`Non-lossless codec at ${name}/${i}`);
  const key=createHash('sha256').update(raw).update(`${stride}:${mode}`).digest('hex');
  let location=encoded.get(key);
  if(!location){location={byteOffset:offset,byteLength:packed.length};encoded.set(key,location);chunks.push(packed);offset+=packed.length;const padding=(4-offset%4)%4;chunks.push(Buffer.alloc(padding));offset+=padding;}
  v.buffer=1;
  v.extensions={...v.extensions,EXT_meshopt_compression:{buffer:0,...location,byteStride:stride,count,mode,filter:'NONE'}};
 }
 g.extensionsUsed=[...new Set([...(g.extensionsUsed??[]),'EXT_meshopt_compression'])];
 g.extensionsRequired=[...new Set([...(g.extensionsRequired??[]),'EXT_meshopt_compression'])];
 g.buffers=[{byteLength:offset},{byteLength:bin.length,extensions:{EXT_meshopt_compression:{fallback:true}}}];
 const json=Buffer.from(JSON.stringify(g)),padding=(4-json.length%4)%4,jsonChunk=Buffer.concat([json,Buffer.alloc(padding,32)]),binary=Buffer.concat(chunks);
 const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+jsonChunk.length+binary.length,8);header.writeUInt32LE(jsonChunk.length,12);header.writeUInt32LE(0x4e4f534a,16);
 const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length);binHeader.writeUInt32LE(0x004e4942,4);
 const result=Buffer.concat([header,jsonChunk,binHeader,binary]),transport=gzipSync(result,{level:9});writeFileSync(`public/models/${name}-packed.glb.gz`,transport);
 report.push({name,sourceBytes:source.length,packedBytes:result.length,transportBytes:transport.length,bufferViews:g.bufferViews.length,uniqueBuffers:encoded.size,verified:'Every decoded buffer byte equals the source; indices use INDICES to preserve triangle order exactly.',sourceSHA256:createHash('sha256').update(source).digest('hex'),packedSHA256:createHash('sha256').update(result).digest('hex')});
}
mkdirSync('docs/startup-performance',{recursive:true});writeFileSync('docs/startup-performance/lossless-models.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
