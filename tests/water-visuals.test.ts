import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scene } from 'three';
import { Wake } from '../src/effects/Wake';
import { Spray } from '../src/effects/Spray';
import { Water } from '../src/effects/Water';
import { DrivingModel } from '../src/player/DrivingModel';
test('five wake emitters are anchored behind hulls, bounded and disappear in flight',()=>{
 const wake=new Wake(new Scene()),m=new DrivingModel();Object.assign(m,{x:10,z:20,speed:50});
 const sources=Array.from({length:5},(_,i)=>({id:String(i),model:m,grounded:true}));
 for(let i=0;i<240;i++)wake.updateAll(1/60,sources);
 assert.ok(wake.pool.activeCount>50&&wake.pool.activeCount<=200);
 for(const p of wake.pool.stamps.filter(p=>p.age<wake.pool.lifetime)){assert.equal(p.x,10);assert.equal(p.z,16);}
 for(let i=0;i<120;i++)wake.updateAll(1/60,sources.map(s=>({...s,grounded:false})));
 assert.equal(wake.pool.activeCount,0);wake.setLow(true);for(let i=0;i<1000;i++)wake.pool.spawn(0,0,0,50);assert.equal(wake.pool.activeCount,72);
 wake.reset();assert.equal(wake.pool.activeCount,0);
});
test('shared spray ages once per step for five emitters and reduces its mobile budget',()=>{
 const spray=new Spray(new Scene()),m=new DrivingModel();m.speed=50;
 for(let i=0;i<120;i++)spray.updateAll(1/60,Array.from({length:5},(_,i)=>({id:String(i),model:m,grounded:true})));
 assert.ok(spray.pool.activeCount>50&&spray.pool.activeCount<=360);
 spray.updateAll(2,[]);assert.equal(spray.pool.activeCount,0);spray.setLow(true);assert.equal(spray.pool.limit,96);
});
test('low quality water reduces geometry and keeps the same time-based material',()=>{
 const water=new Water(new Scene()),count=water.mesh.geometry.getAttribute('position').count,material=water.mesh.material;
 water.setLow(true);assert.ok(water.mesh.geometry.getAttribute('position').count<count/4);assert.equal(water.mesh.material,material);
 water.update(4);water.setLow(false);assert.equal(water.mesh.geometry.getAttribute('position').count,count);water.dispose();
});
