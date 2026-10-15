import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {CityTrack} from '../src/track/CityTrack';import {CITY_MODULES,citySites,cityLOD,footprintsOverlap} from '../src/environment/CityDensityLayout';
import {atlasCellUV} from '../src/environment/ReadableSign';
test('authored district has all twenty-six module types and three populated layers without changing track data',()=>{
 const track=new CityTrack(),before=JSON.stringify([track.samples,track.shortcuts]),sites=citySites(track);
 assert.ok(sites.length>=170);assert.equal(new Set(sites.map(s=>s.kind)).size,26);
 for(const [layer,min] of [['waterfront',26],['blocks',58],['skyline',90]] as const)assert.ok(sites.filter(s=>s.layer===layer).length>=min);
 for(const side of [-1,1])for(const layer of ['waterfront','blocks','skyline'])assert.ok(sites.filter(s=>s.layer===layer&&s.side===side).length>=7);
 assert.equal(new Set(sites.map(s=>s.id)).size,sites.length);assert.deepEqual(sites,citySites(track));assert.equal(JSON.stringify([track.samples,track.shortcuts]),before);
 for(const s of sites)assert.ok([s.x,s.z,s.heading,s.scaleXZ,s.scaleY].every(Number.isFinite));
});

test('sixteen advertising atlas cells remain distinct, readable and inside the texture',()=>{
 const centers=new Set<string>();
 for(let i=0;i<16;i++){
  for(const u of [0,1])for(const v of [0,1])assert.ok(atlasCellUV(i,4,4,u,v).every(value=>value>=0&&value<=1));
  const [left,bottom]=atlasCellUV(i,4,4,0,0),[right,top]=atlasCellUV(i,4,4,1,1);assert.ok(right>left&&top>bottom);centers.add(atlasCellUV(i,4,4,.5,.5).join(','));
 }
 assert.equal(centers.size,16);assert.deepEqual(atlasCellUV(0,4,4,0,0),[0,.75]);assert.deepEqual(atlasCellUV(15,4,4,1,1),[1,.25]);
});
test('new district footprints stay clear of all legal racing water and each other',()=>{
 const track=new CityTrack(),sites=citySites(track),c=track.point(.06*Math.PI*2),h=track.heading(.06*Math.PI*2);
 for(const [i,s] of sites.entries()){
  const along=s.angle*track.radius-.06*track.length;assert.ok(Math.abs(along)+s.radius<=(s.layer==='skyline'?340:140));
  for(const u of [-1,0,1])for(const v of [-1,0,1]){
   const x=s.x+Math.cos(s.heading)*s.rx*u+Math.sin(s.heading)*s.rz*v,z=s.z-Math.sin(s.heading)*s.rx*u+Math.cos(s.heading)*s.rz*v;
   assert.equal(track.contains({x:c.x+Math.cos(h)*x+Math.sin(h)*z,z:c.z-Math.sin(h)*x+Math.cos(h)*z},-1.3),false);
  }
  for(const other of sites.slice(i+1))assert.equal(footprintsOverlap(s,other),false,`${s.id} overlaps ${other.id}`);
 }
});
test('module GLBs have all real geometry LODs, bounded footprints and finite vertices',()=>{
 const manifest=JSON.parse(readFileSync('public/models/city-sample/modules-manifest.json','utf8'));
 assert.deepEqual(manifest.modules,CITY_MODULES);assert.ok(manifest.standardBytes<12000000&&manifest.lowBytes<5500000);
 const counts:Record<string,number>[]=[];
 for(const file of ['city-modules.glb','city-modules-low.glb']){
  const bytes=readFileSync('public/models/city-sample/'+file),length=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+length).toString()),bin=bytes.subarray(28+length),totals:Record<string,number>={};
  for(const [kind,m] of Object.entries(CITY_MODULES))for(const tier of ['near','mid','far']){
   const name=kind+'__'+tier,node=j.nodes.find((n:any)=>n.name===name);assert.ok(node,`Missing ${name}`);let triangles=0;
   for(const id of node.children){const mesh=j.meshes[j.nodes[id].mesh];for(const p of mesh.primitives){
    triangles+=j.accessors[p.indices].count/3;const a=j.accessors[p.attributes.POSITION],v=j.bufferViews[a.bufferView],offset=(v.byteOffset??0)+(a.byteOffset??0);assert.equal(a.componentType,5126);
    for(let k=0;k<a.count;k++){const at=offset+k*(v.byteStride??12),x=bin.readFloatLE(at),y=bin.readFloatLE(at+4),z=bin.readFloatLE(at+8);assert.ok([x,y,z].every(Number.isFinite));assert.ok(Math.abs(x)<=m.rx+.2&&Math.abs(z)<=m.rz+.2,`${name} footprint mismatch`);assert.ok(y>=-.1&&y<=m.height+1);}
   }}totals[name]=triangles;
  }
  counts.push(totals);
 }
 for(const kind of Object.keys(CITY_MODULES)){assert.ok(counts[0][kind+'__near']>counts[0][kind+'__mid']&&counts[0][kind+'__mid']>counts[0][kind+'__far']);assert.ok(counts[1][kind+'__near']<counts[0][kind+'__near']*.55);assert.ok(counts[0][kind+'__far']<500);}
});

test('exported city binaries contain complete embedded textures and valid mesh indices',()=>{
 for(const file of ['city-modules.glb','city-modules-low.glb']){
  const bytes=readFileSync('public/models/city-sample/'+file);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const length=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+length).toString()),bin=bytes.subarray(28+length);
  for(const view of j.bufferViews)assert.ok((view.byteOffset??0)+view.byteLength<=bin.length);
  for(const image of j.images){
   const view=j.bufferViews[image.bufferView],data=bin.subarray(view.byteOffset,view.byteOffset+view.byteLength);
   if(image.mimeType==='image/png'){assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(data.subarray(-12).toString('hex'),'0000000049454e44ae426082');}
   else {assert.equal(image.mimeType,'image/jpeg');assert.equal(data.subarray(0,2).toString('hex'),'ffd8');assert.equal(data.subarray(-2).toString('hex'),'ffd9');}
  }
  for(const mesh of j.meshes)for(const p of mesh.primitives){
   const a=j.accessors[p.indices],v=j.bufferViews[a.bufferView],start=(v.byteOffset??0)+(a.byteOffset??0),size=a.componentType===5123?2:4;
   assert.ok(a.componentType===5123||a.componentType===5125);
   for(let i=0;i<a.count;i++)assert.ok((size===2?bin.readUInt16LE(start+i*size):bin.readUInt32LE(start+i*size))<j.accessors[p.attributes.POSITION].count);
  }
 }
});
test('distance LOD has hysteresis, keeps the skyline cheap and lowers mobile detail thresholds',()=>{
 assert.equal(cityLOD('blocks',129,0,false),0);assert.equal(cityLOD('blocks',129,1,false),1);assert.equal(cityLOD('blocks',110,1,false),0);
 assert.equal(cityLOD('blocks',282,2,false),2);assert.equal(cityLOD('blocks',275,2,false),1);
 assert.equal(cityLOD('skyline',5,0,false),2);assert.equal(cityLOD('blocks',90,0,true),1);
});
