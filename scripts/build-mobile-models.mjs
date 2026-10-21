import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {gzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {MeshoptSimplifier} from 'meshoptimizer';
// Separate, reproducible phone-standard assets. Never overwrite desktop / low assets.
await MeshoptSimplifier.ready;MeshoptSimplifier.useExperimentalFeatures=true;
const widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16},types={5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
const textureMap=JSON.parse(readFileSync('public/models/mobile-textures/manifest.json'));
const report=[];
for(const name of ['watercraft','rider']){
 const source=readFileSync(`public/models/${name}.glb`),n=source.readUInt32LE(12),g=JSON.parse(source.subarray(20,20+n)),bin=source.subarray(28+n),accessors=g.accessors,views=g.bufferViews;
 const read=id=>{const a=accessors[id],v=views[a.bufferView],Type=types[a.componentType],size=widths[a.type],stride=v.byteStride??Type.BYTES_PER_ELEMENT*size,out=new Type(a.count*size),start=(v.byteOffset??0)+(a.byteOffset??0);for(let i=0;i<a.count;i++)for(let k=0;k<size;k++){const offset=start+i*stride+k*Type.BYTES_PER_ELEMENT;out[i*size+k]=Type===Float32Array?bin.readFloatLE(offset):Type===Uint32Array?bin.readUInt32LE(offset):Type===Uint16Array?bin.readUInt16LE(offset):bin[offset];}return out;};
 const chunks=[],nextViews=[],nextAccessors=[];let offset=0;
 const add=(data,descriptor)=>{const b=Buffer.from(data.buffer,data.byteOffset,data.byteLength),view=nextViews.length;nextViews.push({buffer:0,byteOffset:offset,byteLength:b.length});chunks.push(b);offset+=b.length;const pad=(4-offset%4)%4;chunks.push(Buffer.alloc(pad));offset+=pad;const a={...descriptor,bufferView:view,byteOffset:0,count:data.length/widths[descriptor.type]};delete a.sparse;nextAccessors.push(a);return nextAccessors.length-1;};
 let before=0,after=0,maxError=0;
 for(const mesh of g.meshes)for(const p of mesh.primitives){
  const original=new Uint32Array(read(p.indices)),position=read(p.attributes.POSITION),count=position.length/3,keys=Object.keys(p.attributes),values=Object.fromEntries(keys.map(k=>[k,read(p.attributes[k])]));before+=original.length/3;
  const selected=['NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0'].filter(k=>values[k]),attributeWeights=selected.flatMap(k=>Array(widths[accessors[p.attributes[k]].type]).fill(k==='NORMAL'?.008:k==='TEXCOORD_0'?.02:k==='JOINTS_0'?.001:.08)),stride=attributeWeights.length,attrs=new Float32Array(count*stride);
  for(let i=0;i<count;i++){let k=0;for(const key of selected){const a=accessors[p.attributes[key]],w=widths[a.type],scale=a.normalized?(a.componentType===5121?255:65535):1;for(let j=0;j<w;j++)attrs[i*stride+k++]=values[key][i*w+j]/scale;}}
  let indices=original,error=0;
  if(original.length>6000)[indices,error]=MeshoptSimplifier.simplifyWithAttributes(original,position,3,attrs,stride,attributeWeights,null,Math.max(6000,Math.floor(original.length*.055/3)*3),.006,['LockBorder','ErrorAbsolute']);
  maxError=Math.max(maxError,error);after+=indices.length/3;
  // compactMesh mutates the index buffer to its new vertex order.
  const [remap,used]=MeshoptSimplifier.compactMesh(indices),newIndices=indices;
  p.indices=add(newIndices,{componentType:5125,type:'SCALAR',min:[0],max:[used-1]});
  for(const key of keys){const descriptor=accessors[p.attributes[key]],w=widths[descriptor.type],data=values[key],Type=data.constructor,compact=new Type(used*w);for(let i=0;i<remap.length;i++)if(remap[i]!==0xffffffff)for(let j=0;j<w;j++)compact[remap[i]*w+j]=data[i*w+j];
   const d={...descriptor};delete d.min;delete d.max;if(key==='POSITION'){d.min=[Infinity,Infinity,Infinity];d.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<used;i++)for(let j=0;j<3;j++){d.min[j]=Math.min(d.min[j],compact[i*3+j]);d.max[j]=Math.max(d.max[j],compact[i*3+j]);}}
   p.attributes[key]=add(compact,d);
  }
 }
 for(const skin of g.skins??[])skin.inverseBindMatrices=add(read(skin.inverseBindMatrices),accessors[skin.inverseBindMatrices]);
 for(const image of g.images){if(!textureMap[image.uri])throw Error('Missing phone texture '+image.uri);image.uri=textureMap[image.uri];image.mimeType='image/webp';}
 for(const texture of g.textures){texture.extensions={...texture.extensions,EXT_texture_webp:{source:texture.source}};delete texture.source;}
 g.extensionsUsed=[...new Set([...(g.extensionsUsed??[]),'EXT_texture_webp'])];g.extensionsRequired=[...new Set([...(g.extensionsRequired??[]),'EXT_texture_webp'])];
 g.accessors=nextAccessors;g.bufferViews=nextViews;g.buffers=[{byteLength:offset}];
 const json=Buffer.from(JSON.stringify(g)),padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),binary=Buffer.concat(chunks),header=Buffer.alloc(20),binHeader=Buffer.alloc(8);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+padded.length+binary.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);binHeader.writeUInt32LE(binary.length);binHeader.writeUInt32LE(0x004e4942,4);
 const transport=gzipSync(Buffer.concat([header,padded,binHeader,binary]),{level:9});writeFileSync(`public/models/${name}-mobile.glb.gz`,transport);
 report.push({name,sourceTriangles:before,mobileTriangles:after,maximumSimplifierError:maxError,transportBytes:transport.length,sourceSHA256:createHash('sha256').update(source).digest('hex'),preserved:'Original materials, bones, skin weights, joints, normals and UVs at retained vertices. Separate 1024px lossless WebP textures. Desktop assets untouched.'});console.log(report.at(-1));
}
mkdirSync('docs/mobile-quality',{recursive:true});writeFileSync('docs/mobile-quality/models.json',JSON.stringify(report,null,2));
