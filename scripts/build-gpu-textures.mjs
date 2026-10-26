import {readFile,writeFile,mkdir,copyFile,access} from 'node:fs/promises';import {createHash} from 'node:crypto';import {Worker} from 'node:worker_threads';import {existsSync} from 'node:fs';
// Offline authoring only. The isolated encoder is ktx2-encoder 0.6.0, npm
// SHA512 gEWkw2YUlhKO4hXhqVLQQWJ+fGJObsXIwz0pGjJMclnQ4MQU3SAtN1MzutjFxO3ejWvxHyvFk5kr8+RtLmHiTA==.
// It does not add a runtime dependency or replace original source images.
const out='public/models/gpu-textures',scratch='.qa/texture-sources';await mkdir(out,{recursive:true});await mkdir(scratch,{recursive:true});await mkdir('src/generated',{recursive:true});await mkdir('work/resource-quality',{recursive:true});
const manifest={byURI:{},byHash:{}},jobs=new Map(),legacy=JSON.parse(await readFile('public/models/runtime-textures/manifest.json','utf8'));
for(const name of['watercraft','rider',...['waterfront','waterfront-low','city-modules','city-modules-low','city-services','public-citizens'].map(n=>'city-sample/'+n)]){
 const data=await readFile(`public/models/${name}.glb`),jsonLength=data.readUInt32LE(12),g=JSON.parse(data.subarray(20,20+jsonLength).toString()),bin=data.subarray(28+jsonLength),folder=name.includes('/')?'city-sample/':'';
 const role=new Map();const mark=(t,color,normal=false)=>{if(t===undefined)return;const texture=g.textures[t],i=texture.source??texture.extensions?.EXT_texture_webp?.source;const list=role.get(i)??new Set();list.add(color?'color':normal?'normal':'data');role.set(i,list);};
 for(const m of g.materials??[]){mark(m.pbrMetallicRoughness?.baseColorTexture?.index,true);mark(m.emissiveTexture?.index,true);mark(m.normalTexture?.index,false,true);mark(m.pbrMetallicRoughness?.metallicRoughnessTexture?.index,false);mark(m.occlusionTexture?.index,false);for(const ext of Object.values(m.extensions??{}))for(const[k,v]of Object.entries(ext))if(k.endsWith('Texture')&&typeof v==='object')mark(v.index,false,/normal/i.test(k));}
 for(const[i,image]of(g.images??[]).entries()){
  let bytes;if(image.uri)bytes=await readFile('public/models/'+folder+image.uri);else{const view=g.bufferViews[image.bufferView];bytes=bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);}
  if(bytes.readUInt32BE(0)!==0x89504e47)continue;const hash=createHash('sha256').update(bytes).digest('hex'),roles=role.get(i)??new Set(['data']),srgb=roles.has('color');
  const current=jobs.get(hash);if(current&&current.srgb!==srgb){current.conflict=true;continue;}
  const job=current??{hash,srgb,normal:roles.has('normal'),source:`${scratch}/${hash}.png`,target:`${out}/${hash.slice(0,24)}.ktx2`,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),references:[]};job.references.push({model:name,image:image.name??image.uri??i,uri:image.uri?folder+image.uri:null});jobs.set(hash,job);await writeFile(job.source,bytes);
 }
}
const pending=[...jobs.values()].filter(j=>!j.conflict&&j.width>=256&&j.height>=256);await writeFile('work/resource-quality/texture-jobs.json',JSON.stringify(pending,null,2));
let cursor=0,done=0;const results=[];
async function worker(){while(cursor<pending.length){const job=pending[cursor++];let result;if(existsSync(job.target)){result={...job,existing:true,bytes:(await readFile(job.target)).length};}else result=await new Promise((resolve,reject)=>{const w=new Worker(new URL('./encode-gpu-texture.mjs',import.meta.url),{workerData:job,stdout:true,stderr:true});w.stdout.resume();w.stderr.resume();w.once('message',resolve);w.once('error',reject);w.once('exit',code=>{if(code)reject(Error(`Encoder exit ${code}: ${job.hash}`));});});results.push(result);console.log(`${++done}/${pending.length} ${job.normal?'normal':job.srgb?'color':'data'} ${job.width} ${result.bytes} bytes`);}}
await Promise.all(Array.from({length:Math.min(3,pending.length)},worker));
for(const job of pending){const entry={path:'gpu-textures/'+job.hash.slice(0,24)+'.ktx2',srgb:job.srgb,width:job.width,height:job.height};manifest.byHash[job.hash]=entry;for(const ref of job.references){const uri=ref.uri??`city-textures/${job.hash}.png`;manifest.byURI[uri]=entry;if(legacy[uri])manifest.byURI[legacy[uri]]=entry;}}
await writeFile('src/generated/gpuTextures.ts','// Offline UASTC lookup. Original images remain the fallback.\nexport const gpuTextures='+JSON.stringify(manifest)+';\n');await writeFile(`${out}/manifest.json`,JSON.stringify(manifest));
await mkdir('public/decoders/basis',{recursive:true});for(const file of['basis_transcoder.js','basis_transcoder.wasm','README.md'])await copyFile(`node_modules/three/examples/jsm/libs/basis/${file}`,`public/decoders/basis/${file}`);
await writeFile('work/resource-quality/gpu-textures.json',JSON.stringify({encoder:'ktx2-encoder 0.6.0 / Basis Universal UASTC LDR 4x4 level 3, no RDO, full-resolution, complete mip chains; originals preserved',jobs:results,conflicts:[...jobs.values()].filter(j=>j.conflict)},null,2));
