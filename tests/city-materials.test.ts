import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';

function asset(){
 const bytes=readFileSync('public/models/city-sample/waterfront.glb'),length=bytes.readUInt32LE(12);
 return {json:JSON.parse(bytes.subarray(20,20+length).toString()),bin:bytes.subarray(28+length),bytes};
}
// Decode 8-bit RGB/RGBA PNG scanlines to test content, not just texture presence.
function pngPixels(bytes:Buffer){
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),channels=bytes[25]===6?4:3,chunks:Buffer[]=[];
 assert.equal(bytes[24],8);assert.ok(bytes[25]===2||bytes[25]===6);
 for(let at=8;at<bytes.length;){const n=bytes.readUInt32BE(at),type=bytes.toString('ascii',at+4,at+8);if(type==='IDAT')chunks.push(bytes.subarray(at+8,at+8+n));at+=n+12;}
 const raw=inflateSync(Buffer.concat(chunks)),stride=width*channels,pixels=Buffer.alloc(stride*height);
 for(let y=0;y<height;y++){
  const filter=raw[y*(stride+1)];
  for(let x=0;x<stride;x++){
   const at=y*stride+x,a=x>=channels?pixels[at-channels]:0,b=y?pixels[at-stride]:0,c=y&&x>=channels?pixels[at-stride-channels]:0;
   const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);
   const prediction=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):pa<=pb&&pa<=pc?a:pb<=pc?b:c;
   pixels[at]=(raw[y*(stride+1)+1+x]+prediction)&255;
  }
 }
 return {pixels,channels};
}
test('exported glass normal and roughness maps have real nonblack pixels',()=>{
 const {json:j,bin}=asset(),m=j.materials.find((m:any)=>m.name==='Blue laminated glazing');
 const image=(index:number)=>{const v=j.bufferViews[j.images[j.textures[index].source].bufferView];return pngPixels(bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength));};
 const rough=image(m.pbrMetallicRoughness.metallicRoughnessTexture.index),normal=image(m.normalTexture.index),green=new Set<number>();
 for(let i=1;i<rough.pixels.length;i+=rough.channels)green.add(rough.pixels[i]);
 assert.ok(green.size>=5&&Math.min(...green)>=35&&Math.max(...green)>100,'roughness must contain panes and frames, not a cleared black buffer');
 let blue=0,count=0;for(let i=2;i<normal.pixels.length;i+=normal.channels){blue+=normal.pixels[i];count++;}
 assert.ok(blue/count>240,'normal map must face out of the surface');
});
test('sample coatings contain packed AO/roughness/metalness and bounded original normal/color maps',()=>{
 const {json:j,bin,bytes}=asset();
 for(const name of ['Coated architectural alloy','Graphite plaza paving']){
  const m=j.materials.find((m:any)=>m.name===name);assert.ok(m);
  assert.equal(m.occlusionTexture.index,m.pbrMetallicRoughness.metallicRoughnessTexture.index);
  for(const index of [m.normalTexture.index,m.occlusionTexture.index,m.pbrMetallicRoughness.baseColorTexture.index]){
   const image=j.images[j.textures[index].source],view=j.bufferViews[image.bufferView],png=bin.subarray(view.byteOffset??0);
   assert.equal(image.mimeType,'image/png');assert.equal(png.readUInt32BE(16),512);assert.equal(png.readUInt32BE(20),512);
  }
 }
 for(const m of j.materials.filter((m:any)=>/glazing/.test(m.name)))assert.equal(m.pbrMetallicRoughness.metallicFactor,0,'glass must not become a metallic mirror');
 const triangles=j.meshes.flatMap((m:any)=>m.primitives).reduce((sum:number,p:any)=>sum+j.accessors[p.indices].count/3,0);
 assert.ok(triangles<280000);assert.ok(j.meshes.length<=14);assert.ok(bytes.length<16000000);
});
test('closed curtain-wall UVs do not interpolate across the full atlas at the seam',()=>{
 const {json:j,bin}=asset();let triangles=0;
 for(const mesh of j.meshes)for(const p of mesh.primitives){
  if(j.materials[p.material].name!=='Blue laminated glazing')continue;
  const ia=j.accessors[p.indices],iv=j.bufferViews[ia.bufferView],ua=j.accessors[p.attributes.TEXCOORD_0],uv=j.bufferViews[ua.bufferView];
  assert.equal(ua.componentType,5126);
  const index=(n:number)=>{const at=(iv.byteOffset??0)+(ia.byteOffset??0)+n*(ia.componentType===5125?4:2);return ia.componentType===5125?bin.readUInt32LE(at):bin.readUInt16LE(at);};
  const u=(n:number)=>bin.readFloatLE((uv.byteOffset??0)+(ua.byteOffset??0)+n*(uv.byteStride??8));
  for(let n=0;n<ia.count;n+=3){const us=[u(index(n)),u(index(n+1)),u(index(n+2))];assert.ok(Math.max(...us)-Math.min(...us)<.15,'a panel may not span the entire atlas');triangles++;}
 }
 assert.ok(triangles>100);
});
