import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
/** Decode geometry/skins in Node without DOM image loaders; browser QA tests images. */
export function visualDocument(name:string){const bytes=readFileSync(`public/models/${name}.glb`),length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length).toString());return {bytes,json,bin:bytes.subarray(28+length)};}
export async function visualGeometry(name:string){
 const {json,bin}=visualDocument(name);
 json.materials=json.materials.map((m:any)=>({name:m.name,pbrMetallicRoughness:{baseColorFactor:m.pbrMetallicRoughness?.baseColorFactor}}));delete json.images;delete json.textures;
 const encoded=Buffer.from(JSON.stringify(json)),length=Math.ceil(encoded.length/4)*4,glb=Buffer.alloc(28+length+bin.length,32);
 glb.writeUInt32LE(0x46546c67,0);glb.writeUInt32LE(2,4);glb.writeUInt32LE(glb.length,8);glb.writeUInt32LE(length,12);glb.writeUInt32LE(0x4e4f534a,16);encoded.copy(glb,20);glb.writeUInt32LE(bin.length,20+length);glb.writeUInt32LE(0x004e4942,24+length);bin.copy(glb,28+length);
 return new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.length),'');
}
