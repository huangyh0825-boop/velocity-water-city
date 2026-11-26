import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const root=resolve(process.argv[2]??'dist'),manifest=JSON.parse(await readFile(resolve(root,'asset-parts/manifest.json'),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');let files=0,bytes=0;
for(const [name,entry] of Object.entries(manifest)){
 assert.equal(entry.hashes.length,Math.ceil(entry.bytes/entry.partBytes));const chunks=[];
 for(const [i,hash]of entry.hashes.entries()){
  const data=await readFile(resolve(root,'asset-parts',entry.sha256,i+'.bin'));assert.equal(sha(data),hash,name+'/'+i);assert.equal(data.length,Math.min(entry.partBytes,entry.bytes-i*entry.partBytes));chunks.push(data);files++;
 }
 const data=Buffer.concat(chunks);assert.equal(data.length,entry.bytes);assert.equal(sha(data),entry.sha256);
 assert.ok(data.equals(await readFile(resolve(root,name))),'Published fallback differs: '+name);
 assert.ok(data.equals(await readFile(resolve('public',name))),'Authored bytes changed: '+name);
 if(entry.decodedSHA256){const decoded=gunzipSync(data);assert.equal(decoded.length,entry.decodedBytes);assert.equal(sha(decoded),entry.decodedSHA256);}
 bytes+=data.length;
}
assert.ok(files>0);console.log(JSON.stringify({verified:true,assets:Object.keys(manifest).length,parts:files,bytes,manifestBytes:(await stat(resolve(root,'asset-parts/manifest.json'))).size,proof:'Every part hash and whole-file hash verified; reconstructed bytes equal both published fallbacks and existing authored source files.'}));
