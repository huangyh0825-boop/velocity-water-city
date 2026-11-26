import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {brotliDecompressSync, gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const root=resolve(process.argv[2]??'dist'),manifest=JSON.parse(await readFile(resolve(root,'asset-parts/manifest.json'),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
let files=0,bytes=0,brotliFiles=0,brotliSavings=0;
async function reassemble(name,entry){
 assert.equal(entry.hashes.length,Math.ceil(entry.bytes/entry.partBytes));const chunks=[];
 for(const [i,hash]of entry.hashes.entries()){
  const data=await readFile(resolve(root,'asset-parts',entry.sha256,i+'.bin'));assert.equal(sha(data),hash,name+'/'+i);assert.equal(data.length,Math.min(entry.partBytes,entry.bytes-i*entry.partBytes));chunks.push(data);files++;
 }
 const data=Buffer.concat(chunks);assert.equal(data.length,entry.bytes);assert.equal(sha(data),entry.sha256);
 return data;
}
for(const [name,entry] of Object.entries(manifest)){
 const data=await reassemble(name,entry);
 assert.ok(data.equals(await readFile(resolve(root,name))),'Published fallback differs: '+name);
 assert.ok(data.equals(await readFile(resolve('public',name))),'Authored bytes changed: '+name);
 if(entry.decodedSHA256){
  const decoded=gunzipSync(data);
  assert.equal(decoded.length,entry.decodedBytes);assert.equal(sha(decoded),entry.decodedSHA256);
  if(entry.brotli){
   const packed=await reassemble(name+' (Brotli)',entry.brotli);
   assert.ok(brotliDecompressSync(packed).equals(decoded),'Decoded Brotli differs: '+name);
   brotliFiles++;
   brotliSavings+=data.length-packed.length;
  }
 }
 bytes+=data.length;
}
assert.ok(files>0);console.log(JSON.stringify({verified:true,assets:Object.keys(manifest).length,parts:files,bytes,brotliFiles,brotliSavings,manifestBytes:(await stat(resolve(root,'asset-parts/manifest.json'))).size,proof:'All parts verified. Brotli and published originals decode to identical bytes.'}));
