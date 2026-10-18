import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CityTrack} from '../src/track/CityTrack';
import {trackClearance} from '../src/track/TrackClearance';
import {worldCitySites,siteWorld,CITY_DISTRICTS} from '../src/environment/WorldCityLayout';
import {footprintsOverlap} from '../src/environment/CityDensityLayout';
import {cityServices} from '../src/environment/CityServicesLayout';
import {waterfrontLayout} from '../src/environment/WaterfrontLayout';

const track=new CityTrack(),snapshot=JSON.stringify([track.samples,track.shortcuts]),sites=worldCitySites(track),pockets=waterfrontLayout(track,sites);
test('public-space layout is repeatable, occupies all six districts and preserves racing data',()=>{
 assert.deepEqual(waterfrontLayout(track,sites),pockets);
 assert.equal(new Set(pockets.map(p=>p.id)).size,pockets.length);
 for(const d of CITY_DISTRICTS)for(const side of [-1,1])assert.ok(pockets.some(p=>p.district===d.id&&p.side===side),`${d.id}/${side}`);
 for(const kind of ['courtyard','viewing','service','rest-stop'])assert.ok(pockets.some(p=>p.kind===kind));
 assert.equal(JSON.stringify([track.samples,track.shortcuts]),snapshot);
});
test('furniture reserves dry ground and the complete 3D racing, flight and landing corridor',()=>{
 const clear=trackClearance(track);
 for(const p of pockets){
  assert.equal(clear.intersects({x:p.x,z:p.z,y:3.5,width:p.rx*2,depth:p.rz*2,height:7,heading:p.heading}),false,p.id);
  for(const u of [-1,0,1])for(const v of [-1,0,1])assert.equal(track.contains({x:p.x+Math.cos(p.heading)*p.rx*u+Math.sin(p.heading)*p.rz*v,z:p.z-Math.sin(p.heading)*p.rx*u+Math.cos(p.heading)*p.rz*v},-.6),false,p.id);
 }
});
test('public spaces keep building entrances, services and each other clear',()=>{
 const occupied=[...sites,...cityServices(track)].map(s=>({...s,...siteWorld(track,s)}));
 for(const [i,p] of pockets.entries()){
  for(const s of occupied)assert.equal(footprintsOverlap(p,s,.7),false,`${p.id}/${s.id}`);
  for(const other of pockets.slice(i+1))assert.equal(footprintsOverlap(p,other,.7),false,`${p.id}/${other.id}`);
 }
});
