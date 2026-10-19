import{loadPlaywright}from'./qa-playwright.mjs';
import{mkdirSync,writeFileSync}from'node:fs';
import assert from'node:assert/strict';
const{chromium}=loadPlaywright(),browser=await chromium.launch({channel:'msedge',headless:true});
const folder='docs/lap-fix';mkdirSync(folder,{recursive:true});
try{
 const p=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1}),errors=[];
 p.on('pageerror',e=>errors.push(String(e)));
 await p.goto(process.env.QA_URL??'http://127.0.0.1:5182/scripts/qa/vertical.html',{waitUntil:'commit'});
 await p.waitForFunction(()=>window.verticalQA,null,{timeout:180000});await p.evaluate(()=>window.verticalQA.ready());
 const results=[];
 for(const mode of['main-centre','main-outside','main-inside','both-shortcuts']){
  const result=await p.evaluate(mode=>{
   const g=window.testGame,q=window.verticalQA,t=g.track;
   q.fixture(-.014/(Math.PI*2),null,0,false);let chosen=null;const lane=mode==='main-outside'?10:mode==='main-inside'?-10:0,gates=[],routes=new Set();
   Object.defineProperty(g.input,'state',{configurable:true,get(){
    const m=g.craft.model,lap=Math.floor(g.race.player.passed/24);
    if(mode==='both-shortcuts'){
     const wanted=t.shortcuts.find(s=>s.id===(lap===1?'tunnel-cut':lap===2?'harbor-cut':null)),a=t.project(m,null).angle,toEntry=wanted?(wanted.from-a)*t.radius:Infinity;
     if(toEntry>0&&toEntry<110)chosen=wanted.id;if(chosen&&a>t.shortcuts.find(s=>s.id===chosen).to)chosen=null;
    }
    const route=mode==='both-shortcuts'?(g.race.player.route??chosen):null;
    // Human input does not supply AI routeIntent. This is essential to reproduce
    // early shortcut acquisition while the boat physically stays on the main road.
    m.routeIntent=mode==='both-shortcuts'?route:undefined;
    const target=t.routeTarget(m,Math.max(18,m.speed*.65),lane,route),desired=Math.atan2(target.x-m.x,target.z-m.z),next=t.routeTarget(m,50,lane,route),direction=Math.atan2(next.x-target.x,next.z-target.z),curve=Math.abs(Math.atan2(Math.sin(direction-desired),Math.cos(direction-desired)))/30,cap=Math.min(50,.45/Math.max(.0001,curve)),error=Math.atan2(Math.sin(desired-m.heading),Math.cos(desired-m.heading));
    q.setBoost(!g.flight.airborne&&curve<.002&&g.nitro.energy>15);return{throttle:m.speed<cap?1:0,brake:m.speed>cap+1?1:0,steer:Math.max(-1,Math.min(1,error*2.7/.67))};
   }});
   const render=g.renderer.render,hero=g.heroLighting.update,ai=g.aiLighting.map(l=>l.updateVisible);
   g.renderer.render=()=>{};g.heroLighting.update=()=>{};g.aiLighting.forEach(l=>l.updateVisible=()=>false);
   let steps=0;const started=performance.now();
   try{for(;steps<60*600&&g.race.phase!=='finished';steps++){
    const passed=g.race.player.passed;q.step(true);
    if(g.race.player.route)routes.add(g.race.player.route);
    if(g.race.player.passed!==passed)gates.push({passed:g.race.player.passed,lap:g.race.lap(),time:g.race.elapsed,hud:document.querySelector('#lap').textContent});
   }}finally{g.paused=true;g.renderer.render=render;g.heroLighting.update=hero;g.aiLighting.forEach((l,i)=>l.updateVisible=ai[i]);}
   q.view([0,5.7,-13],[0,1,12],true);
   const elapsed=g.race.elapsed,passed=g.race.player.passed,phase=g.race.phase,finish=g.race.player.finishTime;
   g.paused=false;for(let i=0;i<120;i++)q.step();g.paused=true;
   return{mode,steps,computeMs:performance.now()-started,passed,phase,finish,elapsed,clockFrozen:g.race.elapsed===elapsed&&g.race.player.finishTime===finish,hud:document.querySelector('#lap').textContent,resultVisible:!document.querySelector('#result').hidden,resultRows:document.querySelectorAll('#result-table tbody tr').length,status:document.querySelector('#status').textContent,routes:[...routes],gates,ai:g.race.racers.slice(1).map(r=>({id:r.id,passed:r.passed,finish:r.finishTime}))};
  },mode);
  assert.equal(result.passed,72,mode);assert.equal(result.phase,'finished',mode);assert.equal(result.hud,'3 / 3');assert.equal(result.resultVisible,true);assert.equal(result.resultRows,5);assert.equal(result.clockFrozen,true);
  assert.deepEqual(result.gates.map(g=>g.passed),Array.from({length:72},(_,i)=>i+1));
  assert.deepEqual(result.gates.filter(g=>g.passed%24===0).map(g=>g.hud),['2 / 3','3 / 3','3 / 3']);
  if(mode==='main-inside')assert.ok(result.routes.includes('tunnel-cut'),'exercise misleading automatic branch detection');
  if(mode==='both-shortcuts')assert.deepEqual([...result.routes].sort(),['harbor-cut','tunnel-cut']);
  await p.screenshot({path:`${folder}/${mode}.jpg`,quality:90});
  await p.locator('#race-again').click();
  const reset=await p.evaluate(()=>{const g=window.testGame;g.hud.update(g.craft.model,g.race,false,g.nitro,g.flight,g.tricks);return{phase:g.race.phase,passed:g.race.player.passed,elapsed:g.race.elapsed,lap:document.querySelector('#lap').textContent,resultHidden:document.querySelector('#result').hidden}});
  assert.deepEqual(reset,{phase:'countdown',passed:0,elapsed:0,lap:'1 / 3',resultHidden:true});result.restart=reset;
  results.push(result);console.log(JSON.stringify({...result,gates:`${result.gates.length} sequential checkpoints`}));
 }
 assert.deepEqual(errors,[]);
 writeFileSync(`${folder}/browser.json`,JSON.stringify({method:'Production-compiled Game.frame at fixed 60 Hz with live player input steering, four solid AI, collisions, ramps, nitro and normal per-step race completion. No position teleports, injected checkpoint counts, or pause at CP71. GPU drawing skipped only for accelerated functional simulation and restored for screenshots; this is not an FPS measurement.',results,errors},null,2));
}finally{await browser.close()}
