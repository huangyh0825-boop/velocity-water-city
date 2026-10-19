import{loadPlaywright}from'./qa-playwright.mjs';import{writeFileSync}from'node:fs';import assert from'node:assert/strict';
const{chromium}=loadPlaywright(),browser=await chromium.launch({channel:'msedge',headless:true}),results=[];
try{const p=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1}),errors=[];p.on('pageerror',e=>errors.push(String(e)));await p.goto('http://127.0.0.1:5182/scripts/qa/vertical.html',{waitUntil:'commit'});await p.waitForFunction(()=>window.verticalQA,null,{timeout:180000});await p.evaluate(()=>window.verticalQA.ready());
 for(const mode of['parked-player','racing-player']){
  const result=await p.evaluate(mode=>{
   const g=window.testGame,q=window.verticalQA;q.fixture(-.014/(Math.PI*2),null,0,false);let chosen=null;
   Object.defineProperty(g.input,'state',{configurable:true,get(){
    if(mode==='parked-player'||g.race.player.passed>=71&&g.race.racers.slice(1).some(r=>r.finishTime===null))return{throttle:0,brake:1,steer:0};
    const m=g.craft.model,t=g.track,lap=Math.floor(g.race.player.passed/24),wanted=t.shortcuts.find(s=>s.id===(lap===1?'tunnel-cut':lap===2?'harbor-cut':null)),a=t.project(m,null).angle,toEntry=wanted?(wanted.from-a)*t.radius:Infinity;if(toEntry>0&&toEntry<110)chosen=wanted.id;if(chosen&&a>t.shortcuts.find(s=>s.id===chosen).to)chosen=null;
    const route=g.race.player.route??chosen;m.routeIntent=route;const target=t.routeTarget(m,Math.max(18,m.speed*.65),0,route),desired=Math.atan2(target.x-m.x,target.z-m.z),next=t.routeTarget(m,50,0,route),direction=Math.atan2(next.x-target.x,next.z-target.z),curve=Math.abs(Math.atan2(Math.sin(direction-desired),Math.cos(direction-desired)))/30,cap=Math.min(50,.45/Math.max(.0001,curve)),error=Math.atan2(Math.sin(desired-m.heading),Math.cos(desired-m.heading));
    q.setBoost(!g.flight.airborne&&curve<.002&&g.nitro.energy>15);return{throttle:m.speed<cap?1:0,brake:m.speed>cap+1?1:0,steer:Math.max(-1,Math.min(1,error*2.7/.67))};
   }});
   const render=g.renderer.render.bind(g.renderer),hero=g.heroLighting.update.bind(g.heroLighting),ai=g.aiLighting.map(l=>l.updateVisible.bind(l));g.renderer.render=()=>{};g.heroLighting.update=()=>{};g.aiLighting.forEach(l=>l.updateVisible=()=>false);let steps=0;
   const started=performance.now();try{for(;steps<36000&&g.race.racers.slice(1).some(r=>r.finishTime===null);steps++)q.step(true);}finally{g.paused=true;g.renderer.render=render;g.heroLighting.update=hero;g.aiLighting.forEach((l,i)=>l.updateVisible=ai[i]);}
   q.view([0,5.7,-13],[0,1,12],true);
   return{mode,steps,computeMs:performance.now()-started,elapsed:g.race.elapsed,playerPassed:g.race.player.passed,racers:g.race.racers.slice(1).map((r,i)=>({id:r.id,name:r.name,passed:r.passed,finish:r.finishTime,maxKmh:g.ai[i].targetSpeed*3.6,authorizedPeak:r.maxSpeed*3.6,energy:g.ai[i].nitro.energy}))};
  },mode);results.push(result);console.log(JSON.stringify(result));assert.deepEqual(result.racers.map(r=>r.passed),[72,72,72,72]);const times=result.racers.map(r=>r.finish);assert.ok(times[0]>=260&&times[0]<=285);assert.ok(times.every(t=>t<=360));assert.ok(Math.max(...times)>=330);await p.screenshot({path:`docs/ai-pace/${mode}.jpg`,quality:90});
 }
 assert.deepEqual(errors,[]);writeFileSync('docs/ai-pace/browser.json',JSON.stringify({method:'Actual production-compiled Game.frame, default live grid, four AI plus player, all collision/ramp/race rules. GPU rendering skipped only during accelerated functional timing; restored for screenshots. Times are in-game race seconds, not browser processing time. Separate FPS test retains full rendering.',results,errors},null,2));
}finally{await browser.close()}
