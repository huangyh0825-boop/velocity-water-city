import{loadPlaywright}from'./qa-playwright.mjs';
import{mkdirSync,writeFileSync}from'node:fs';
import assert from'node:assert/strict';
const{chromium}=loadPlaywright(),browser=await chromium.launch({channel:'msedge',headless:true}),folder='docs/shortcut-choice';mkdirSync(folder,{recursive:true});const results=[];
try{
 for(const[label,port,choices]of[['before',5184,['main-cut']],['after',5182,['main-cut','cut-main','cut-cut','main-main']]]){
  const p=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1}),errors=[];p.on('pageerror',e=>errors.push(String(e)));
  await p.goto(`http://127.0.0.1:${port}/scripts/qa/vertical.html`,{waitUntil:'commit'});await p.waitForFunction(()=>window.verticalQA,null,{timeout:180000});await p.evaluate(()=>window.verticalQA.ready());
  for(const choice of choices){
   const result=await p.evaluate(({label,choice})=>{
    const g=window.testGame,q=window.verticalQA,t=g.track,m=g.craft.model,cut=t.shortcuts[1],tau=Math.PI*2;let chosen=null,stage=0,lastLap=0;const switches=[],gates=[],lowerVisits=new Set();
    q.fixture(-.014/tau,null,0,false);
    Object.defineProperty(g.input,'state',{configurable:true,get(){
     const main=t.project(m,null),projection=t.project(m,cut.id),fraction=(projection.angle-cut.from)/(cut.to-cut.from),lap=Math.floor(g.race.player.passed/24);
     if(lap!==lastLap){stage=0;chosen=null;lastLap=lap;}
     if(stage===0&&main.angle/tau>.625&&main.angle<cut.from){stage=1;chosen=choice.startsWith('cut')?cut.id:null;}
     if(stage===1&&((chosen&&fraction>.49)||(!chosen&&main.angle/tau>.738))){stage=2;chosen=choice.endsWith('cut')?cut.id:null;switches.push({lap,passed:g.race.player.passed,main:main.angle/tau,fraction,chosen,entered:[...g.race.player.enteredRoutes]});}
     if(stage===2&&main.angle>cut.to){chosen=null;stage=3;}
     if(fraction>.6&&fraction<.8&&projection.distance<6&&m.y<2)lowerVisits.add(lap);
     m.routeIntent=undefined;
     const lane=!chosen&&main.angle/tau>.63&&main.angle/tau<.71?5:0,target=t.routeTarget(m,Math.max(18,m.speed*.65),lane,chosen),desired=Math.atan2(target.x-m.x,target.z-m.z),k=Math.max(Math.abs(t.curvature(main.angle)),Math.abs(t.curvature(main.angle+45/t.radius))),cap=main.angle/tau>.71&&main.angle/tau<.765?16:chosen?38:Math.min(40,.45/Math.max(.0001,k)),error=Math.atan2(Math.sin(desired-m.heading),Math.cos(desired-m.heading));
     return{throttle:m.speed<cap?1:0,brake:m.speed>cap+1?1:0,steer:Math.max(-1,Math.min(1,error*2.7/.67))};
    }});
    const render=g.renderer.render,hero=g.heroLighting.update,ai=g.aiLighting.map(l=>l.updateVisible);g.renderer.render=()=>{};g.heroLighting.update=()=>{};g.aiLighting.forEach(l=>l.updateVisible=()=>false);
    let steps=0;try{for(;steps<60*550&&g.race.phase!=='finished';steps++){const before=g.race.player.passed;q.step(true);if(g.race.player.passed!==before)gates.push(g.race.player.passed);if(label==='before'&&stage===3&&t.project(m,null).angle/tau>.88)break;}}
    finally{g.paused=true;g.renderer.render=render;g.heroLighting.update=hero;g.aiLighting.forEach((l,i)=>l.updateVisible=ai[i]);}
    q.view([0,5.7,-13],[0,1,12],true);
    return{label,choice,steps,phase:g.race.phase,passed:g.race.player.passed,finish:g.race.player.finishTime,lap:document.querySelector('#lap').textContent,status:document.querySelector('#status').textContent,resultVisible:!document.querySelector('#result').hidden,switches,lowerVisits:[...lowerVisits],gates,ai:g.race.racers.slice(1).map(r=>({passed:r.passed,finish:r.finishTime}))};
   },{label,choice});
   console.log(JSON.stringify({...result,gates:result.gates.length}));results.push(result);
   if(label==='before'){assert.equal(result.phase,'racing');assert.equal(result.passed,18);assert.ok(result.lowerVisits.includes(0));}
   else{assert.equal(result.phase,'finished');assert.equal(result.passed,72);assert.equal(result.lap,'3 / 3');assert.equal(result.resultVisible,true);assert.equal(result.switches.length,3);for(const gate of[15,21,24,39,45,48,63,69,72])assert.ok(result.gates.includes(gate));if(choice==='main-cut'){assert.deepEqual(result.lowerVisits,[0,1,2]);assert.ok(result.switches.every(s=>!s.entered.includes('harbor-cut')));assert.ok(result.gates.includes(21)&&!result.gates.includes(19),'old branch-only CP19 must not be required');}}
   await p.screenshot({path:`${folder}/${label}-${choice}.jpg`,quality:90});
  }
  assert.deepEqual(errors,[]);await p.close();
 }
 writeFileSync(`${folder}/browser.json`,JSON.stringify({method:'Before/after production-compiled real Game.frame, normal player start, four solid AI, fixed 60Hz driving with ramp/flight/collision rules and no routeIntent, injected checkpoint counts or player teleports. Slow at the crossing to make a controlled turn. Three complete laps on all four S2 route combinations after the fix; before reproduces CP19 blocking. GPU drawing skipped only during accelerated functional simulation, restored for screenshots; performance measured separately.',results},null,2));
}finally{await browser.close()}
