import{loadPlaywright}from'./qa-playwright.mjs';import{writeFileSync}from'node:fs';import assert from'node:assert/strict';
const{chromium}=loadPlaywright(),browser=await chromium.launch({channel:'msedge',headless:true}),results=[];
try{
 const p=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1}),errors=[];p.on('pageerror',e=>errors.push(String(e)));
 await p.goto('http://127.0.0.1:5182/scripts/qa/vertical.html',{waitUntil:'commit'});await p.waitForFunction(()=>window.verticalQA,null,{timeout:180000});await p.evaluate(()=>window.verticalQA.ready());
 for(const id of['tunnel-cut','harbor-cut'])for(const physical of[null,id])for(const location of['entry','beyond-old-cap','exit'])for(const direction of[1,-1]){
  const r=await p.evaluate(({id,physical,location,direction})=>{
   const g=window.testGame,q=window.verticalQA,t=g.track,cut=t.shortcuts.find(c=>c.id===id),m=g.craft.model,logical=physical===null?id:null;
   const scale=physical?cut.length/(cut.to-cut.from):t.radius,angle=location==='entry'?cut.from+25/scale:location==='exit'?cut.to-25/scale:cut.from+(cut.to-cut.from)*.25;
   q.fixture(angle/(Math.PI*2),null,5/3.6,false);Object.assign(m,t.routePoint(angle,0,physical),{route:logical,heading:t.routeHeading(angle,physical)+(direction<0?Math.PI:0),speed:5/3.6});m.vx=Math.sin(m.heading)*m.speed;m.vz=Math.cos(m.heading)*m.speed;
   g.ramps.place(m,g.flight);g.craftMotion.reset();g.race.syncPosition('player',m);g.race.player.route=logical;
   Object.defineProperty(g.input,'state',{configurable:true,get(){const projection=t.project(m,physical),a=projection.angle+direction*Math.max(10,m.speed*.65)/scale,target=t.routePoint(a,0,physical),desired=Math.atan2(target.x-m.x,target.z-m.z),e=Math.atan2(Math.sin(desired-m.heading),Math.cos(desired-m.heading));return{throttle:m.speed<40/3.6?1:0,brake:m.speed>40/3.6+.3?1:0,steer:Math.max(-1,Math.min(1,e*2.7/.67))}}});
   const render=g.renderer.render.bind(g.renderer),hero=g.heroLighting.update.bind(g.heroLighting),ai=g.aiLighting.map(l=>l.updateVisible.bind(l)),constrain=t.constrain.bind(t);let samples=0,falseContacts=0,complete=false,steps=0,maxCorrection=0;
   g.renderer.render=()=>{};g.heroLighting.update=()=>{};g.aiLighting.forEach(l=>l.updateVisible=()=>false);
   t.constrain=model=>{const before={x:model.x,z:model.z},a=model===m?t.project(m,physical):null,safe=a&&a.distance<=a.width-3&&Math.abs(t.heightAt(a.angle,physical)-m.y)<=1;const contact=constrain(model);if(safe){samples++;if(contact)falseContacts++;maxCorrection=Math.max(maxCorrection,Math.hypot(m.x-before.x,m.z-before.z));}return contact;};
   try{for(;steps<1200;steps++){q.step(false);if(direction*(t.project(m,physical).angle-angle)*scale>20){complete=true;break;}}}
   finally{g.paused=true;g.renderer.render=render;g.heroLighting.update=hero;g.aiLighting.forEach((l,i)=>l.updateVisible=ai[i]);t.constrain=constrain;}
   q.view([0,5.7,-13],[0,1,12],true);
   return{id,physical,location,direction,complete,steps,samples,falseContacts,maxCorrection,kmh:m.speed*3.6,route:m.route,height:m.y,position:{x:m.x,z:m.z}};
  },{id,physical,location,direction});
  results.push(r);console.log(JSON.stringify(r));
  assert.equal(r.complete,true);assert.ok(r.samples>30);assert.equal(r.falseContacts,0);assert.equal(r.maxCorrection,0);assert.ok(r.kmh>35);
  if(physical===null&&location==='beyond-old-cap'&&direction===1)await p.screenshot({path:`docs/shortcut-junction/${id}-slow-recovery.jpg`,quality:90});
 }
 assert.deepEqual(errors,[]);writeFileSync('docs/shortcut-junction/maneuvers.json',JSON.stringify({method:'Private production build, actual fixed-step Game.frame; start at 5km/h with opposite route tag, drive 20m forward or reversed. Rendering skipped during simulation and restored for screenshots. No FPS claim.',results,errors},null,2));
}finally{await browser.close()}
