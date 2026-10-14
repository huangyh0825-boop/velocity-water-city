import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {CityTrack} from '../src/track/CityTrack';import {CITY_MODULES,citySites,cityLOD,footprintsOverlap} from '../src/environment/CityDensityLayout';
test('authored district has all eight module types and three populated layers without changing track data',()=>{
 const track=new CityTrack(),before=JSON.stringify([track.samples,track.shortcuts]),sites=citySites(track);
 assert.ok(sites.length>=80);assert.equal(new Set(sites.map(s=>s.kind)).size,8);
 for(const layer of ['waterfront','blocks','skyline'])assert.ok(sites.filter(s=>s.layer===layer).length>5);
 assert.deepEqual(sites,citySites(track));assert.equal(JSON.stringify([track.samples,track.shortcuts]),before);
 for(const s of sites)assert.ok([s.x,s.z,s.heading,s.scaleXZ,s.scaleY].every(Number.isFinite));
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
 assert.deepEqual(manifest.modules,CITY_MODULES);assert.ok(manifest.standardBytes<6000000&&manifest.lowBytes<2500000);
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
 for(const kind of Object.keys(CITY_MODULES)){assert.ok(counts[0][kind+'__near']>counts[0][kind+'__mid']&&counts[0][kind+'__mid']>counts[0][kind+'__far']);assert.ok(counts[1][kind+'__near']<counts[0][kind+'__near']*.45);assert.ok(counts[0][kind+'__far']<150);}
});
test('distance LOD has hysteresis, keeps the skyline cheap and lowers mobile detail thresholds',()=>{
 assert.equal(cityLOD('blocks',129,0,false),0);assert.equal(cityLOD('blocks',129,1,false),1);assert.equal(cityLOD('blocks',110,1,false),0);
 assert.equal(cityLOD('blocks',282,2,false),2);assert.equal(cityLOD('blocks',275,2,false),1);
 assert.equal(cityLOD('skyline',5,0,false),2);assert.equal(cityLOD('blocks',90,0,true),1);
});
