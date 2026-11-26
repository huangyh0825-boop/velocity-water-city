import {readFileSync,writeFileSync,copyFileSync,mkdirSync,statSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {brotliCompressSync, brotliDecompressSync, constants, gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

/** Publish only assets reachable from the actual runtime entries. Editable and
 * historical originals stay in public/ and assets/ for rebuilding and rollback. */
export function runtimeAssets(){
 let destination,files=[],revision,parts={},brotliModels=new Map();
 return {name:'runtime-asset-closure',apply:'build',config(){
  const root=resolve('public'),queue=['favicon.svg','models/README.md','models/watercraft-packed.glb.gz','models/rider-packed.glb.gz','models/watercraft-mobile.glb.gz','models/rider-mobile.glb.gz','models/watercraft-low.glb','models/rider-low.glb',...['waterfront','waterfront-low','city-modules','city-modules-low','city-services','public-citizens'].map(n=>`models/city-sample/${n}.glb`)],seen=new Set();let bytes=0;
  for(const name of['watercraft','rider'])if(statSync(resolve(root,`models/${name}-efficient.glb.gz`),{throwIfNoEntry:false}))queue.push(`models/${name}-efficient.glb.gz`);
  for(const name of['waterfront','waterfront-low','city-modules','city-modules-low','city-services','public-citizens'])if(statSync(resolve(root,`models/city-sample/${name}-efficient.glb.gz`),{throwIfNoEntry:false}))queue.push(`models/city-sample/${name}-efficient.glb.gz`);
  const gpuManifest=resolve(root,'models/gpu-textures/manifest.json');
  if(statSync(gpuManifest,{throwIfNoEntry:false})){const textures=JSON.parse(readFileSync(gpuManifest,'utf8'));queue.push('models/gpu-textures/manifest.json','decoders/basis/basis_transcoder.js','decoders/basis/basis_transcoder.wasm','decoders/basis/README.md',...new Set(Object.values(textures.byHash).map(t=>'models/'+t.path)));}
  for(let i=0;i<queue.length;i++){
   const path=resolve(root,queue[i]),name=relative(root,path);if(name.startsWith('..'))throw Error('Asset outside public directory');if(seen.has(name))continue;seen.add(name);
   files.push({path,name});bytes+=statSync(path).size;
   if(name.endsWith('.glb')||name.endsWith('.glb.gz')){
    const raw=readFileSync(path),data=name.endsWith('.gz')?gunzipSync(raw):raw,g=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)));
    for(const {uri} of [...(g.images??[]),...(g.buffers??[])])if(uri&&!uri.startsWith('data:'))queue.push(relative(root,resolve(dirname(path),uri)));
   }
  }
  const hash=createHash('sha256');for(const file of files)hash.update(file.name.replaceAll('\\','/')).update('\0').update(readFileSync(file.path));revision=hash.digest('hex');
  // Build-only publication format. Original resources stay available as a
  // fallback; no duplicate binary files are added to the Git repository.
  parts={};brotliModels=new Map();
  const describeParts=(data,partBytes)=>{
   const sha256=createHash('sha256').update(data).digest('hex'),hashes=[];
   for(let offset=0;offset<data.length;offset+=partBytes)hashes.push(createHash('sha256').update(data.subarray(offset,offset+partBytes)).digest('hex'));
   return {bytes:data.length,partBytes,sha256,hashes};
  };
  for(const file of files){const name=file.name.replaceAll('\\','/');
   if(!(/-efficient\.glb\.gz$/.test(name)||/^models\/(watercraft|rider)-mobile\.glb\.gz$/.test(name)||/^models\/gpu-textures\/.*\.ktx2$/.test(name)||/^models\/mobile-textures\/.*\.webp$/.test(name)))continue;
   const data=readFileSync(file.path);if(!data.length)continue;
   const decoded=name.endsWith('.gz')?gunzipSync(data):undefined;
   const entry=parts[name]=describeParts(data,512*1024);
   if(!decoded)continue;
   entry.decodedBytes=decoded.length;
   entry.decodedSHA256=createHash('sha256').update(decoded).digest('hex');
   const packed=brotliCompressSync(decoded,{params:{
    [constants.BROTLI_PARAM_QUALITY]:7,
    [constants.BROTLI_PARAM_LGWIN]:23,
    [constants.BROTLI_PARAM_SIZE_HINT]:decoded.length,
   }});
   if(packed.length>=data.length*.99)continue;
   if(!brotliDecompressSync(packed).equals(decoded))throw Error('Brotli model differs: '+name);
   entry.brotli=describeParts(packed,1024*1024);
   brotliModels.set(name,packed);
  }
  return{define:{__RUNTIME_ASSET_VERSION__:JSON.stringify(revision),__RUNTIME_ASSET_PARTS__:JSON.stringify(parts)}};
 },configResolved(config){destination=resolve(config.root,config.build.outDir);},closeBundle(){
  let bytes=0;for(const {path,name}of files){const target=resolve(destination,name);mkdirSync(dirname(target),{recursive:true});copyFileSync(path,target);bytes+=statSync(path).size;}
  let partCount=0;
  const publishParts=(entry,data)=>{
   const folder=resolve(destination,'asset-parts',entry.sha256);
   mkdirSync(folder,{recursive:true});
   for(let i=0;i<entry.hashes.length;i++){
    writeFileSync(resolve(folder,i+'.bin'),data.subarray(i*entry.partBytes,(i+1)*entry.partBytes));
    partCount++;
   }
  };
  for(const [name,entry]of Object.entries(parts)){
   publishParts(entry,readFileSync(resolve('public',name)));
   if(entry.brotli)publishParts(entry.brotli,brotliModels.get(name));
  }
  mkdirSync(resolve(destination,'asset-parts'),{recursive:true});writeFileSync(resolve(destination,'asset-parts/manifest.json'),JSON.stringify(parts));
  console.log(`Immutable transport: ${partCount} byte-verified static parts (original resources retained)`);
  console.log(`Runtime assets: ${files.length} files, ${(bytes/1e6).toFixed(1)} MB (originals preserved locally); version ${revision.slice(0,12)}`);
 }};
}
