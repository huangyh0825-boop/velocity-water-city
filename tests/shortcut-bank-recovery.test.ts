import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CityTrack} from '../src/track/CityTrack';
import {DrivingModel} from '../src/player/DrivingModel';
import {RoomRace} from '../server/RoomRace';

test('hugging either shortcut bank corrects locally with a stale route, including sideways and reverse approaches',()=>{
 const track=new CityTrack();let recovered=0;
 for(const cut of track.shortcuts)for(let i=1;i<128;i++)for(const physical of [null,cut.id])for(const side of [-1,1])for(const rotation of [0,Math.PI/2,Math.PI]){
  const angle=cut.from+(cut.to-cut.from)*i/128,width=track.routeWidth(angle,physical),point=track.routePoint(angle,side*(width-.2),physical),model=new DrivingModel();
  Object.assign(model,point,{route:physical===null?cut.id:null,heading:track.routeHeading(angle,physical)+rotation,speed:25});model.vx=Math.sin(model.heading)*25;model.vz=Math.cos(model.heading)*25;
  const q=track.project(point,physical);if(q.distance>q.width||Math.abs(track.heightAt(q.angle,physical)-point.y)>1)continue;
  const before={x:model.x,z:model.z};track.constrain(model);
  const distance=Math.hypot(model.x-before.x,model.z-before.z);
  const required=Math.max(0,q.distance-q.width+Math.max(1,.8+1.8*Math.abs(Math.sin(model.heading-q.heading))));
  assert.ok(distance<=Math.max(2.61,required+.01),`${cut.id}/${i}/${physical}/${side}/${rotation}: bank correction ${distance}m`);
  if(distance>.01){recovered++;assert.ok(track.contains(model),'corrected hull remains on connected water');}
 }
 assert.ok(recovered>500);
});

test('a small collision displacement beyond the new bank cannot snap back across the divider',()=>{
 const track=new CityTrack(),cut=track.shortcuts[1],angle=cut.from+(cut.to-cut.from)*7/128;
 for(const lane of [-6.2,6.2]){
  const model=new DrivingModel(),p=track.routePoint(angle,lane,cut.id);Object.assign(model,p,{route:null,heading:track.routeHeading(angle,cut.id),speed:15});
  track.constrain(model);assert.ok(Math.hypot(model.x-p.x,model.z-p.z)<1.5);assert.ok(track.project(model,cut.id).distance<5.01);
 }
});

test('authoritative multiplayer contact uses the actual shortcut bank despite stale server race tags',()=>{
 const track=new CityTrack(),cut=track.shortcuts[1],angle=cut.from+(cut.to-cut.from)*7/128,ids=['a'.repeat(24),'b'.repeat(24)];
 const room=new RoomRace(ids.map(id=>({id,playerId:id})),0);room.loaded(ids[0],0);room.loaded(ids[1],0);room.tick(7000);
 for(const [i,id] of ids.entries()){
  const player=room.players.get(id)!,point=track.routePoint(angle,-5.7+i*.6,cut.id);
  Object.assign(player.model,point,{route:null,heading:track.routeHeading(angle,cut.id),speed:0,vx:0,vz:0});player.pose={...player.pose,...player.model};room.rules.syncPosition(id,player.model);
 }
 const initial=ids.map(id=>({...room.players.get(id)!.model}));room.tick(7200);
 for(const [i,id] of ids.entries()){
  const player=room.players.get(id)!;assert.equal(player.correctionKind,'collision');assert.ok(player.correction>0);
  assert.ok(Math.hypot(player.model.x-initial[i].x,player.model.z-initial[i].z)<3,'server correction does not cross the divider');
  assert.ok(track.project(player.model,cut.id).distance<=5.01);
 }
});
