import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{CityTrack}from'../src/track/CityTrack';import{worldCitySites,CITY_DISTRICTS,districtAt}from'../src/environment/WorldCityLayout';import{waterfrontLayout}from'../src/environment/WaterfrontLayout';import{vacancySurvey}from'../src/environment/CityVacancy';import{interiorSites,INTERIOR_BAYS}from'../src/environment/CityInteriors';
const t=new CityTrack(),sites=worldCitySites(t),spaces=waterfrontLayout(t,sites);
test('empty-land audit covers every district and large blanks are broken into designed civic spaces',()=>{
 const before=vacancySurvey(t,sites,spaces.filter(p=>!p.id.startsWith('civic-'))),after=vacancySurvey(t,sites,spaces);
 assert.equal(after.districts.length,6);assert.ok(after.freeArea<before.freeArea*.62);assert.ok(after.plots[0].area<before.plots[0].area*.12);
 for(const d of CITY_DISTRICTS)for(const side of[-1,1])assert.ok(spaces.filter(p=>p.id.startsWith('civic-')&&p.district===d.id&&p.side===side).length>20);
});
test('58 infill buildings retain authored sample modules and eligible occupied interiors',()=>{
 const infill=sites.filter(s=>s.id.startsWith('world-infill-')),interiors=interiorSites(sites);assert.equal(infill.length,58);
 for(const d of CITY_DISTRICTS)assert.equal(infill.filter(s=>districtAt(s.angle).id===d.id).length,d.id==='central'?8:10);
 for(const s of infill)if(INTERIOR_BAYS[s.kind])assert.ok(interiors.includes(s));
});
test('four anatomical Blender poses and a shared fabric normal are actually exported',()=>{
 const buffer=readFileSync('public/models/city-sample/public-citizens.glb'),g=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)).toString());assert.equal(buffer.length,buffer.readUInt32LE(8));
 for(let i=0;i<4;i++)assert.ok(g.nodes.some((n:any)=>n.name===`spectator-${i}`));assert.ok(g.materials.some((m:any)=>m.normalTexture));
 const tris=g.meshes.reduce((n:number,m:any)=>n+m.primitives.reduce((s:number,p:any)=>s+g.accessors[p.indices].count/3,0),0);assert.ok(tris>40000&&tris<80000);assert.equal(g.skins,undefined);assert.equal(g.animations,undefined);
});
