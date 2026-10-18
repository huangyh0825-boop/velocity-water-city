import{loadPlaywright}from'./qa-playwright.mjs';
import{createRequire}from'node:module';import{mkdirSync,writeFileSync}from'node:fs';import assert from'node:assert/strict';
const{chromium}=loadPlaywright(),browser=await chromium.launch({channel:'msedge',headless:true}),folder='docs/city-quality-repair/full-race';mkdirSync(folder,{recursive:true});
try{const p=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:5177/scripts/qa/vertical.html');await p.waitForFunction(()=>window.verticalQA,null,{timeout:120000});await p.evaluate(()=>window.verticalQA.ready());
 await p.evaluate(()=>{
  const q=window.verticalQA,g=window.testGame;q.fixture(.003,null,0,true);window.driveQA={chosen:null,steps:0,render:true,wallHits:0,launches:0,landings:0,frames:[],routes:[],samples:[]};const d=window.driveQA;
  const constrain=g.track.constrain.bind(g.track);g.track.constrain=m=>{const hit=constrain(m);if(hit&&m===g.craft.model)d.wallHits++;return hit;};
  const render=g.renderer.render.bind(g.renderer);g.renderer.render=(...args)=>{if(d.render)return render(...args);};
  for(const light of [g.heroLighting,...g.aiLighting])for(const key of ['update','updateVisible']){const fn=light[key].bind(light);light[key]=(...args)=>{if(d.render)return fn(...args);};}
  Object.defineProperty(g.input,'state',{configurable:true,get(){if(g.race.player.passed>=71&&g.race.racers.slice(1).some(r=>r.passed<72))return{throttle:0,brake:1,steer:0};const m=g.craft.model,route=g.race.player.route??d.chosen,target=g.track.routeTarget(m,Math.max(18,m.speed*.65),0,route),desired=Math.atan2(target.x-m.x,target.z-m.z),error=Math.atan2(Math.sin(desired-m.heading),Math.cos(desired-m.heading)),next=g.track.routeTarget(m,50,0,route),direction=Math.atan2(next.x-target.x,next.z-target.z),curve=Math.abs(Math.atan2(Math.sin(direction-desired),Math.cos(direction-desired)))/30,cap=Math.min(50,.45/Math.max(.0001,curve));q.setBoost(!g.flight.airborne&&curve<.002&&g.nitro.energy>15);return{throttle:m.speed<cap?1:0,brake:m.speed>cap+1?1:0,steer:Math.max(-1,Math.min(1,error*2.7/.67))};}});
 });
 const shots=new Set();let state;
 for(let chunk=0;chunk<1200;chunk++){
  state=await p.evaluate(()=>{const g=window.testGame,q=window.verticalQA,d=window.driveQA;g.paused=false;
   for(let i=0;i<30&&g.race.phase==='racing';i++){
    const lap=Math.floor(g.race.player.passed/24),wanted=g.track.shortcuts.find(s=>s.id===(lap===1?'tunnel-cut':lap===2?'harbor-cut':null)),a=g.track.project(g.craft.model,null).angle,toEntry=wanted?(wanted.from-a)*g.track.radius:Infinity;
    if(toEntry>0&&toEntry<110)d.chosen=wanted.id;if(d.chosen&&a>g.track.shortcuts.find(s=>s.id===d.chosen).to)d.chosen=null;delete g.craft.model.routeIntent;
    d.render=d.steps%12===0;q.step(true);d.steps++;if(g.flight.takeoff)d.launches++;if(g.flight.landed)d.landings++;
    if(d.steps%24===0)d.samples.push([g.craft,...g.aiCraft].map((c,i)=>({id:i?'ai-'+i:'player',x:c.model.x,y:i?g.ai[i-1].flight.height:g.flight.height,z:c.model.z,kmh:c.model.speed*3.6})));
    if(g.race.player.route&&!d.routes.includes(g.race.player.route))d.routes.push(g.race.player.route);
   }d.render=true;g.renderer.render(g.scene,g.camera.camera);
   return{phase:g.race.phase,steps:d.steps,t:g.track.project(g.craft.model,null).angle/(Math.PI*2),lap:Math.floor(g.race.player.passed/24),kmh:g.craft.model.speed*3.6,passed:g.race.racers.map(r=>r.passed),airborne:g.flight.airborne,energy:g.nitro.energy};});
  const sector=Math.floor(state.t*48),key='course-'+String(sector).padStart(2,'0');if(state.lap===0&&!shots.has(key)){shots.add(key);await p.screenshot({path:folder+'/'+key+'.jpg'});}
  if(state.phase!=='racing')break;
 }
 const result=await p.evaluate(()=>{const g=window.testGame,d=window.driveQA;return{phase:g.race.phase,steps:d.steps,passed:g.race.racers.map(r=>r.passed),times:g.race.racers.map(r=>r.finishTime),routes:d.routes,wallHits:d.wallHits,launches:d.launches,landings:d.landings,ai:g.ai.map(a=>({id:a.id,energy:a.nitro.energy,tricks:a.tricks.completed})),samples:d.samples};});
 await p.screenshot({path:folder+'/race-result.jpg'});writeFileSync(folder+'/full-drive.json',JSON.stringify({...result,errors,method:'Production-compiled real Game.frame, unchanged 60Hz driving/collision/AI/race. Automatic steering/braking input, no player routeIntent, main lap1, S1 lap2, S2 lap3. Player waits before the last gate for all four AI to finish. Accelerated QA renders each 12th physical step; no production rendering or physics settings changed.'},null,2));assert.deepEqual(errors,[]);assert.equal(result.phase,'finished');assert.deepEqual(result.passed,[72,72,72,72,72]);assert.deepEqual(new Set(result.routes),new Set(['tunnel-cut','harbor-cut']));console.log(JSON.stringify({...result,samples:result.samples.length}));
 // Consistent close inspection distance, full standard authored LOD and lighting.
 const interiors=await p.evaluate(()=>{const g=window.testGame;return g.citySample.density.interiors.selected.map(s=>({id:s.id,t:s.angle/(Math.PI*2),kind:s.kind}));});
 for(const[id,lo,hi]of[['central',0,.16],['science',.16,.30],['transit',.30,.46],['industrial',.46,.65],['harbor',.65,.86],['leisure',.86,1]]){
  const selected=interiors.find(s=>s.t>=lo&&s.t<hi&&s.kind==='service_depot')??interiors.find(s=>s.t>=lo&&s.t<hi);assert.ok(selected);
  await p.evaluate(({id,t})=>{const g=window.testGame,T=window.qaTHREE;window.verticalQA.fixture(t,null,0);g.paused=true;g.hud.update(g.craft.model,g.race,false,g.nitro,g.flight,g.tricks);const s=g.citySample.density.sites.find(s=>s.id===id),root=g.citySample.root,h=s.heading+root.rotation.y,base=root.localToWorld(new T.Vector3(s.x,0,s.z)),d=14,y=4.4;g.camera.camera.fov=52;g.camera.camera.updateProjectionMatrix();g.camera.camera.position.set(base.x-Math.sin(h)*d+Math.cos(h)*2.5,y,base.z-Math.cos(h)*d-Math.sin(h)*2.5);g.camera.camera.lookAt(base.x,3,base.z);g.citySample.update(12,g.camera.camera);g.water.update(12);g.renderer.render(g.scene,g.camera.camera);document.body.classList.add('qa-hide-hud');},{id:selected.id,t:selected.t});await p.screenshot({path:`${folder}/${id}-interior.jpg`});
 }
}finally{await browser.close();}
