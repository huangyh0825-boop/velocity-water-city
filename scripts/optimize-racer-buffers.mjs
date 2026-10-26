import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';import {gzipSync} from 'node:zlib';import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';import assert from 'node:assert/strict';
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const component={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16},report=[];
for(const name of['watercraft','rider']){
 const file=await readFile(`public/models/${name}.glb`),length=file.readUInt32LE(12),g=JSON.parse(file.subarray(20,20+length)),bin=file.subarray(28+length),accessors=g.accessors.map(a=>({...a}));
 const values=accessors.map(a=>{const v=g.bufferViews[a.bufferView],Type=component[a.componentType],row=width[a.type]*Type.BYTES_PER_ELEMENT,bytes=Buffer.alloc(a.count*row);for(let i=0;i<a.count;i++)bin.copy(bytes,i*row,(v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??row),(v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??row)+row);return bytes;});
 const add=(source,bytes,count)=>{const a={...accessors[source],count};delete a.byteOffset;delete a.bufferView;accessors.push(a);values.push(bytes);return accessors.length-1;};
 const primitives=[];let whiteBytes=0,triangles=0;
 for(const mesh of g.meshes)for(const p of mesh.primitives){
  const beforeCount=accessors[p.attributes.POSITION].count,ia=accessors[p.indices],Index=component[ia.componentType],original=new Index(values[p.indices].buffer,values[p.indices].byteOffset,ia.count),indices=new Uint32Array(original),material=g.materials[p.material];
  const opaque=material.alphaMode!=='BLEND',[remap,unique]=MeshoptEncoder.reorderMesh(indices,opaque,false),inverse=new Uint32Array(unique);for(let i=0;i<remap.length;i++)if(remap[i]<unique)inverse[remap[i]]=i;
  // Exact oriented-triangle multiset proof. Transparent primitives also retain
  // their draw order; opaque primitives change only vertex-cache order.
  const codes=(src,translate)=>{const out=new BigUint64Array(src.length/3);for(let i=0;i<src.length;i+=3){const a=translate?inverse[src[i]]:src[i],b=translate?inverse[src[i+1]]:src[i+1],c=translate?inverse[src[i+2]]:src[i+2];out[i/3]=(BigInt(a)<<42n)|(BigInt(b)<<21n)|BigInt(c);}if(opaque)out.sort();return Buffer.from(out.buffer);};
  assert.ok(codes(original,false).equals(codes(indices,true)),'Oriented triangles changed');
  const attrs={};for(const[semantic,index]of Object.entries(p.attributes)){
   const a=accessors[index],Type=component[a.componentType],row=width[a.type]*Type.BYTES_PER_ELEMENT,source=values[index];
   if(semantic==='COLOR_0'){const typed=new Type(source.buffer,source.byteOffset,source.byteLength/Type.BYTES_PER_ELEMENT),one=a.normalized?(a.componentType===5121?255:65535):1;if(typed.every(v=>v===one)){whiteBytes+=source.length;continue;}}
   const bytes=Buffer.alloc(unique*row);for(let old=0;old<remap.length;old++)if(remap[old]<unique)source.copy(bytes,remap[old]*row,old*row,old*row+row);
   // Every retained component is copied bit-for-bit, including UVs, normals,
   // skin joints and weights. No quantization or geometry simplification.
   for(let vertex=0;vertex<unique;vertex++)assert.ok(bytes.subarray(vertex*row,(vertex+1)*row).equals(source.subarray(inverse[vertex]*row,(inverse[vertex]+1)*row)));
   attrs[semantic]=add(index,bytes,unique);
  }
  const use16=unique<=65535,newIndex=use16?new Uint16Array(indices):indices,oldIndex=p.indices;p.attributes=attrs;p.indices=add(oldIndex,Buffer.from(newIndex.buffer,newIndex.byteOffset,newIndex.byteLength),newIndex.length);accessors[p.indices].componentType=use16?5123:5125;
  triangles+=indices.length/3;primitives.push({name:mesh.name,material:material.name,triangles:indices.length/3,verticesBefore:beforeCount,verticesAfter:unique,cacheOrder:opaque?'optimized':'preserved',proof:'same oriented triangles, all nonconstant attribute bytes identical'});
 }
 const used=new Set();for(const m of g.meshes)for(const p of m.primitives){used.add(p.indices);Object.values(p.attributes).forEach(i=>used.add(i));for(const t of p.targets??[])Object.values(t).forEach(i=>used.add(i));}for(const s of g.skins??[])if(s.inverseBindMatrices!==undefined)used.add(s.inverseBindMatrices);for(const a of g.animations??[])for(const s of a.samplers){used.add(s.input);used.add(s.output);}
 const indicesSet=new Set(g.meshes.flatMap(m=>m.primitives.map(p=>p.indices))),newAccessors=[],newViews=[],chunks=[],mapping=new Map(),shared=new Map();let offset=0,decoded=0,rawAttributeBytes=0;
 for(const index of used){const a={...accessors[index]},data=values[index],stride=component[a.componentType].BYTES_PER_ELEMENT*width[a.type],mode=indicesSet.has(index)?'INDICES':'ATTRIBUTES',key=createHash('sha256').update(data).update(`${stride}:${mode}`).digest('hex');let view=shared.get(key);
  if(view===undefined){const packed=MeshoptEncoder.encodeGltfBuffer(data,a.count,stride,mode),check=new Uint8Array(data.length);MeshoptDecoder.decodeGltfBuffer(check,a.count,stride,packed,mode);assert.ok(Buffer.from(check).equals(data));view=newViews.length;newViews.push({buffer:1,byteOffset:decoded,byteLength:data.length,extensions:{EXT_meshopt_compression:{buffer:0,byteOffset:offset,byteLength:packed.length,byteStride:stride,count:a.count,mode,filter:'NONE'}}});chunks.push(packed);offset+=packed.length;const padding=(4-offset%4)%4;chunks.push(Buffer.alloc(padding));offset+=padding;decoded+=data.length;shared.set(key,view);rawAttributeBytes+=data.length;}
  a.bufferView=view;a.byteOffset=0;mapping.set(index,newAccessors.length);newAccessors.push(a);
 }
 for(const m of g.meshes)for(const p of m.primitives){p.indices=mapping.get(p.indices);for(const k of Object.keys(p.attributes))p.attributes[k]=mapping.get(p.attributes[k]);for(const t of p.targets??[])for(const k of Object.keys(t))t[k]=mapping.get(t[k]);}for(const s of g.skins??[])if(s.inverseBindMatrices!==undefined)s.inverseBindMatrices=mapping.get(s.inverseBindMatrices);for(const a of g.animations??[])for(const s of a.samplers){s.input=mapping.get(s.input);s.output=mapping.get(s.output);}
 const textures=JSON.parse(await readFile('public/models/runtime-textures/manifest.json','utf8'));for(const image of g.images){image.uri=textures[image.uri];image.mimeType='image/webp';}for(const t of g.textures){t.extensions={...t.extensions,EXT_texture_webp:{source:t.source}};delete t.source;}
 g.accessors=newAccessors;g.bufferViews=newViews;g.buffers=[{byteLength:offset},{byteLength:decoded,extensions:{EXT_meshopt_compression:{fallback:true}}}];g.extensionsUsed=[...new Set([...(g.extensionsUsed??[]),'EXT_meshopt_compression','EXT_texture_webp'])];g.extensionsRequired=[...new Set([...(g.extensionsRequired??[]),'EXT_meshopt_compression','EXT_texture_webp'])];
 const json=Buffer.from(JSON.stringify(g)),jsonChunk=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),binary=Buffer.concat(chunks),header=Buffer.alloc(20),tail=Buffer.alloc(8);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+jsonChunk.length+binary.length,8);header.writeUInt32LE(jsonChunk.length,12);header.writeUInt32LE(0x4e4f534a,16);tail.writeUInt32LE(binary.length);tail.writeUInt32LE(0x004e4942,4);
 const packed=Buffer.concat([header,jsonChunk,tail,binary]),gzip=gzipSync(packed,{level:9});await writeFile(`public/models/${name}-efficient.glb.gz`,gzip);report.push({name,triangles,sourceBytes:file.length,transportBytes:gzip.length,decodedAttributeBytes:rawAttributeBytes,constantWhiteColorBytesRemoved:whiteBytes,sourceSHA256:createHash('sha256').update(file).digest('hex'),primitives});console.log(name,triangles,'triangles preserved,',gzip.length,'download bytes');
}
await mkdir('work/resource-quality',{recursive:true});await writeFile('work/resource-quality/lossless-geometry.json',JSON.stringify(report,null,2));
