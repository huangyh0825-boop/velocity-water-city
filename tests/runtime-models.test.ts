import {test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{gunzipSync}from'node:zlib';
import{MeshoptDecoder}from'three/addons/libs/meshopt_decoder.module.js';
function read(data:Buffer){const length=data.readUInt32LE(12);return{json:JSON.parse(data.subarray(20,20+length).toString()),binary:data.subarray(28+length)};}
test('shipping models preserve every geometry byte, triangle order, material value, rig, socket and animation',async()=>{
 await MeshoptDecoder.ready;
 for(const name of ['watercraft','rider']){
  const source=read(readFileSync(`public/models/${name}.glb`)),packed=read(gunzipSync(readFileSync(`public/models/${name}-packed.glb.gz`)));
  for(const field of ['accessors','meshes','materials','skins','nodes','animations','scenes'])assert.deepEqual(packed.json[field],source.json[field],`${name}/${field}`);
  for(const [i,view]of packed.json.bufferViews.entries()){
   const e=view.extensions.EXT_meshopt_compression,input=packed.binary.subarray(e.byteOffset,e.byteOffset+e.byteLength),decoded=new Uint8Array(e.count*e.byteStride);
   MeshoptDecoder.decodeGltfBuffer(decoded,e.count,e.byteStride,input,e.mode,e.filter);
   const old=source.json.bufferViews[i],raw=source.binary.subarray(old.byteOffset??0,(old.byteOffset??0)+old.byteLength);assert.ok(Buffer.from(decoded).equals(raw),`${name}/bufferView${i}`);
  }
 }
});
