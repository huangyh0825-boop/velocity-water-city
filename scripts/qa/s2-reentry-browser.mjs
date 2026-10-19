import{loadPlaywright}from'./qa-playwright.mjs';
import{mkdirSync,writeFileSync}from'node:fs';
import assert from'node:assert/strict';
const{chromium}=loadPlaywright(),browser=await chromium.launch({channel:'msedge',headless:true}),folder='docs/s2-lap-fix';mkdirSync(folder,{recursive:true});
try{
 const p=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1}),errors=[];p.on('pageerror',e=>errors.push(String(e)));
 await p.goto('http://127.0.0.1:5182/scripts/qa/vertical.html',{waitUntil:'commit'});await p.waitForFunction(()=>window.verticalQA,null,{timeout:180000});await p.evaluate(()=>window.verticalQA.ready());
 const result=await p.evaluate(()=>{
  const g=window.testGame,q=window.verticalQA,t=g.track,cut=t.shortcuts[1],m=g.craft.model;let chosen=null;
  const gates=[],losses=[],returns=[];q.fixture(-.014/(Math.PI*2),null,0,false);
  Object.defineProperty(g.input,'state',{configurable:true,get(){
   const main=t.project(m,null),toEntry=(cut.from-main.angle)*t.radius;
   if(toEntry>0&&toEntry<110)chosen=cut.id;if(chosen&&main.angle>cut.to)chosen=null;
   m.routeIntent=undefined; // keyboard/touch players supply no AI intent
   const lane=chosen&&g.flight.airborne?8:0;
   const centre=t.routeTarget(m,Math.max(18,m.speed*.65),0,chosen),next=t.routeTarget(m,50,0,chosen),centreHeading=Math.atan2(centre.x-m.x,centre.z-m.z),nextHeading=Math.atan2(next.x-centre.x,next.z-centre.z),curve=Math.abs(Math.atan2(Math.sin(nextHeading-centreHeading),Math.cos(nextHeading-centreHeading)))/30;
   const target=t.routeTarget(m,Math.max(18,m.speed*.65),lane,chosen),desired=Math.atan2(target.x-m.x,target.z-m.z),error=Math.atan2(Math.sin(desired-m.heading),Math.cos(desired-m.heading)),cap=chosen?45:Math.min(45,.45/Math.max(.0001,curve));
   return{throttle:m.speed<cap?1:0,brake:m.speed>cap+1?1:0,steer:Math.max(-1,Math.min(1,error*2.7/.67))};
  }});
  const render=g.renderer.render,hero=g.heroLighting.update,ai=g.aiLighting.map(l=>l.updateVisible);g.renderer.render=()=>{};g.heroLighting.update=()=>{};g.aiLighting.forEach(l=>l.updateVisible=()=>false);
  let steps=0;try{for(;steps<60*600&&g.race.phase!=='finished';steps++){
   const route=g.race.player.route,passed=g.race.player.passed;q.step(true);const active=g.race.player.route,projected=t.project(m,cut.id),fraction=(projected.angle-cut.from)/(cut.to-cut.from);
   if(route===cut.id&&active===null&&fraction>.45&&fraction<.8)losses.push({passed,elapsed:g.race.elapsed,fraction,distance:projected.distance,height:m.y,entered:g.race.player.enteredRoutes.has(cut.id)});
   if(route===null&&active===cut.id&&fraction>.5)returns.push({passed,elapsed:g.race.elapsed,fraction});
   if(g.race.player.passed!==passed)gates.push({passed:g.race.player.passed,lap:document.querySelector('#lap').textContent,elapsed:g.race.elapsed,route:active});
  }}finally{g.paused=true;g.renderer.render=render;g.heroLighting.update=hero;g.aiLighting.forEach((l,i)=>l.updateVisible=ai[i]);}
  q.view([0,5.7,-13],[0,1,12],true);
  return{steps,phase:g.race.phase,passed:g.race.player.passed,finish:g.race.player.finishTime,lap:document.querySelector('#lap').textContent,status:document.querySelector('#status').textContent,resultVisible:!document.querySelector('#result').hidden,resultRows:document.querySelectorAll('#result-table tbody tr').length,losses,returns,gates,ai:g.race.racers.slice(1).map(r=>({id:r.id,passed:r.passed,finish:r.finishTime}))};
 });
 writeFileSync(`${folder}/three-laps.json`,JSON.stringify({method:'Production-compiled Game.frame. Drive from the normal start through three complete laps, taking S2 and deliberately steering 8m sideways in flight on each lap. No AI routeIntent, position teleport, injected checkpoint progress, or CP71 pause. Normal solid AI, collision, ramp, nitro and scoring logic retained. GPU drawing skipped only for accelerated functional simulation and restored for screenshots; no FPS claim.',result,errors},null,2));
 console.log(JSON.stringify({...result,gates:result.gates.length}));
 assert.equal(result.phase,'finished');assert.equal(result.passed,72);assert.equal(result.lap,'3 / 3');assert.equal(result.resultVisible,true);assert.equal(result.resultRows,5);assert.ok(result.losses.length>=3);assert.ok(result.returns.length>=3);assert.ok(result.losses.every(r=>r.entered));
 assert.deepEqual(result.gates.map(g=>g.passed),Array.from({length:72},(_,i)=>i+1));assert.deepEqual(result.gates.filter(g=>g.passed%24===19).map(g=>g.passed),[19,43,67]);assert.deepEqual(errors,[]);
 await p.screenshot({path:`${folder}/three-laps.jpg`,quality:90});await p.locator('#race-again').click();
 const reset=await p.evaluate(()=>{const g=window.testGame;g.hud.update(g.craft.model,g.race,false,g.nitro,g.flight,g.tricks);return{phase:g.race.phase,passed:g.race.player.passed,entered:g.race.player.enteredRoutes.size,lap:document.querySelector('#lap').textContent,resultHidden:document.querySelector('#result').hidden};});
 assert.deepEqual(reset,{phase:'countdown',passed:0,entered:0,lap:'1 / 3',resultHidden:true});console.log(JSON.stringify({reset}));
}finally{await browser.close()}
