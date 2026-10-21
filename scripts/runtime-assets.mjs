import {readFileSync,copyFileSync,mkdirSync,statSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';import {gunzipSync} from 'node:zlib';

/** Publish only assets reachable from the actual runtime entries. Editable and
 * historical originals stay in public/ and assets/ for rebuilding and rollback. */
export function runtimeAssets(){
 let destination;
 return {name:'runtime-asset-closure',apply:'build',configResolved(config){destination=resolve(config.root,config.build.outDir);},closeBundle(){
  const root=resolve('public'),queue=['favicon.svg','models/README.md','models/watercraft-packed.glb.gz','models/rider-packed.glb.gz','models/watercraft-mobile.glb.gz','models/rider-mobile.glb.gz','models/watercraft-low.glb','models/rider-low.glb',...['waterfront','waterfront-low','city-modules','city-modules-low','city-services','public-citizens'].map(n=>`models/city-sample/${n}.glb`)],seen=new Set();let bytes=0;
  for(let i=0;i<queue.length;i++){
   const path=resolve(root,queue[i]),name=relative(root,path);if(name.startsWith('..'))throw Error('Asset outside public directory');if(seen.has(name))continue;seen.add(name);
   const target=resolve(destination,name);mkdirSync(dirname(target),{recursive:true});copyFileSync(path,target);bytes+=statSync(path).size;
   if(name.endsWith('.glb')||name.endsWith('.glb.gz')){
    const raw=readFileSync(path),data=name.endsWith('.gz')?gunzipSync(raw):raw,g=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)));
    for(const {uri} of [...(g.images??[]),...(g.buffers??[])])if(uri&&!uri.startsWith('data:'))queue.push(relative(root,resolve(dirname(path),uri)));
   }
  }
  console.log(`Runtime assets: ${seen.size} files, ${(bytes/1e6).toFixed(1)} MB (originals preserved locally)`);
 }};
}
