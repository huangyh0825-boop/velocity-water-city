import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Track } from '../src/track/Track';
import { CityEnvironment,cityLayout,BRIDGE_CLEARANCE,BRIDGE_ANGLES } from '../src/environment/CityEnvironment';
import { FlightController } from '../src/player/FlightController';
test('city buildings stay beyond the canal and bridge clearance exceeds boosted jump plus rider height',()=>{
 const track=new Track();for(const b of cityLayout(track))assert.ok(Math.hypot(b.x,b.z)-b.width>track.radius+track.halfWidth);
 const f=new FlightController();f.launch(60);let peak=0;while(f.airborne){f.beginStep(1/60);peak=Math.max(peak,f.height);}assert.ok(BRIDGE_CLEARANCE>peak+3);
 assert.equal(BRIDGE_ANGLES.length,3);assert.equal(track.radius,120);assert.equal(track.checkpointCount,8);
});
test('low quality hides decorative city details without removing the main bridge/city structure',()=>{
 const city=new CityEnvironment(new THREE.Scene(),new Track());assert.ok(city.root.children.length>=7);
 city.setLow(true);assert.equal(city.details.visible,false);assert.equal(city.root.visible,true);city.setLow(false);assert.equal(city.details.visible,true);
});
