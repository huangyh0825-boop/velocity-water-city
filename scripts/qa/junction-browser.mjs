import{loadPlaywright}from'./qa-playwright.mjs';import{mkdirSync,writeFileSync}from'node:fs';import assert from'node:assert/strict';
const{chromium}=loadPlaywright(),browser=await chromium.launch({channel:'msedge',headless:true}),results=[];mkdirSync('docs/shortcut-junction',{recursive:true});
try{
 const p=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1}),errors=[];p.on('pageerror',e=>errors.push(String(e)));
 await p.goto('http://127.0.0.1:5182/scripts/qa/vertical.html',{waitUntil:'commit'});await p.waitForFunction(()=>window.verticalQA,null,{timeout:180000});await p.evaluate(()=>window.verticalQA.ready());
 for(const id of['tunnel-cut','harbor-cut'])for(const choice of['main','shortcut']){
  const r=await p.evaluate(({id,choice})=>{
   const g=window.testGame,q=window.verticalQA,t=g.track,cut=t.shortcuts.find(c=>c.id===id),m=g.craft.model;
   const entry=cut.samples.find((s,i)=>{const a=t.project(s,null);return i>1&&i<128*Math.max(.15,cut.entryPortal??.15)&&a.distance>1&&a.distance<a.width-4&&Math.abs(t.heightAt(a.angle)-t.heightAt(s.angle,id))<.5;});
   q.fixture(entry.angle/(Math.PI*2),null,100/3.6,false);Object.assign(m,entry,{route:id,heading:choice==='main'?t.heading(t.project(entry,null).angle):t.routeHeading(entry.angle,id),speed:100/3.6});m.vx=Math.sin(m.heading)*m.speed;m.vz=Math.cos(m.heading)*m.speed;
   g.ramps.place(m,g.flight);g.craftMotion.reset();g.race.syncPosition('player',m);g.race.player.route=id;g.race.player.passed=Math.floor(cut.from/(Math.PI*2)*24);const start=t.project(m,null).angle;
   Object.defineProperty(g.input,'state',{configurable:true,get(){const a=t.routeTarget(m,Math.max(18,m.speed*.65),0,choice==='main'?null:id),desired=Math.atan2(a.x-m.x,a.z-m.z),e=Math.atan2(Math.sin(desired-m.heading),Math.cos(desired-m.heading));return{throttle:m.speed<100/3.6?1:0,brake:m.speed>100/3.6+.3?1:0,steer:Math.max(-1,Math.min(1,e*2.7/.67))}}});
   // Exercise the actual Game.frame / collisions / ramps / race update order.
   // Suppress GPU drawing during deterministic simulation, then draw the result.
   // These are functional tests, not real-time performance measurements.
   const render=g.renderer.render.bind(g.renderer),hero=g.heroLighting.update.bind(g.heroLighting),ai=g.aiLighting.map(l=>l.updateVisible.bind(l)),constrain=t.constrain.bind(t);let safeMainSamples=0,falseMainContacts=0,complete=false,steps=0;
   g.renderer.render=()=>{};g.heroLighting.update=()=>{};g.aiLighting.forEach(l=>l.updateVisible=()=>false);
   t.constrain=model=>{let safe=false;if(model===m){const a=t.project(m,null),b=t.project(m,id),f=(b.angle-cut.from)/(cut.to-cut.from);safe=a.distance<=a.width-3&&f<=Math.max(.15,cut.entryPortal??.15)&&Math.abs(t.heightAt(a.angle)-t.heightAt(b.angle,id))<=1;}const contact=constrain(model);if(safe){safeMainSamples++;if(contact)falseMainContacts++;}return contact;};
   try{for(;steps<4800;steps++){q.step(false);const a=t.project(m,null);if(choice==='main'?m.route===null&&(a.angle-start)*t.radius>100:m.route===null&&a.angle>cut.to){complete=true;break;}}}
   finally{g.paused=true;g.renderer.render=render;g.heroLighting.update=hero;g.aiLighting.forEach((l,i)=>l.updateVisible=ai[i]);t.constrain=constrain;}
   q.view([0,5.7,-13],[0,1,12],true);
   return{id,choice,complete,steps,safeMainSamples,falseMainContacts,route:m.route,passed:g.race.player.passed,kmh:m.speed*3.6,height:g.flight.height,position:{x:m.x,z:m.z}};
  },{id,choice});
  assert.equal(r.complete,true,`${id}/${choice} completes`);if(choice==='main'){assert.ok(r.safeMainSamples>20);assert.equal(r.falseMainContacts,0);}
  results.push(r);await p.screenshot({path:`docs/shortcut-junction/${id}-${choice}.jpg`,quality:90});console.log(JSON.stringify(r));
 }
 assert.deepEqual(errors,[]);writeFileSync('docs/shortcut-junction/browser.json',JSON.stringify({method:'Private production build, standard quality, actual Game.frame at fixed 60Hz; rendering/shadow passes skipped during simulation and restored for screenshots. No FPS claim.',results,errors},null,2));
}finally{await browser.close()}
