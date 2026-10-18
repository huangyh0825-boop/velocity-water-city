import{loadPlaywright}from'./qa-playwright.mjs';import{writeFileSync}from'node:fs';import assert from'node:assert/strict';
const{chromium}=loadPlaywright(),browser=await chromium.launch({channel:'msedge',headless:true}),label=process.argv[2]??'after';
try{const p=await browser.newPage({viewport:{width:1600,height:1000}});p.setDefaultTimeout(180000);await p.goto(`http://127.0.0.1:${label==='before'?5182:5177}/scripts/qa/vertical.html`);await p.waitForFunction(()=>window.verticalQA);await p.evaluate(()=>window.verticalQA.ready());
 const results=[];
 for(const route of['tunnel-cut','harbor-cut'])for(const kmh of[40,100,160])for(const lane of[-3,0,3]){
  const row=await p.evaluate(({route,kmh,lane})=>{
   const g=window.testGame,Q=window.verticalQA,cut=g.track.shortcuts.find(s=>s.id===route),angle=cut.from-35/g.track.radius;
   Q.fixture(angle/(Math.PI*2),null,kmh/3.6);g.track.spawn(g.craft.model,angle,lane);const m=g.craft.model;Object.assign(m,{speed:kmh/3.6,vx:Math.sin(m.heading)*kmh/3.6,vz:Math.cos(m.heading)*kmh/3.6});g.ramps.place(m,g.flight);g.race.player.passed=Math.floor(angle/(Math.PI*2)*24);g.race.syncPosition('player',m);g.craftMotion.reset();delete m.routeIntent;
   Object.defineProperty(g.input,'state',{configurable:true,get(){const target=g.track.routeTarget(m,Math.max(18,m.speed*.65),0,route),desired=Math.atan2(target.x-m.x,target.z-m.z),error=Math.atan2(Math.sin(desired-m.heading),Math.cos(desired-m.heading));return{throttle:m.speed<kmh/3.6?1:0,brake:m.speed>kmh/3.6+.3?1:0,steer:Math.max(-1,Math.min(1,error*2.7/.67))};}});
   const render=g.renderer.render.bind(g.renderer),lights=[g.heroLighting,...g.aiLighting],saved=lights.map(l=>({l,update:l.update,updateVisible:l.updateVisible}));let draw=false;g.renderer.render=(...a)=>{if(draw)return render(...a)};saved.forEach(({l,update,updateVisible})=>{l.update=function(...a){if(draw)return update.apply(this,a)};l.updateVisible=function(...a){if(draw)return updateVisible.apply(this,a)}});
   let entered=false,exit=false,walls=0,steps=0,min=kmh,air=0;const visited=[];
   for(;steps<6000;steps++){draw=steps%120===0;Q.step(true);if(m.route===route)entered=true;if(g.wallContact)walls++;if(g.flight.takeoff)air++;min=Math.min(min,m.speed*3.6);if(m.route&&!visited.includes(m.route))visited.push(m.route);if(entered&&m.route===null&&g.track.project(m,null).angle>cut.to){exit=true;break;}}
   g.renderer.render=render;saved.forEach(({l,update,updateVisible})=>{l.update=update;l.updateVisible=updateVisible});g.paused=true;
   return{route,kmh,lane,entered,exit,walls,steps,min,air,passed:g.race.player.passed,routeIntent:m.routeIntent??'undefined',visited};
  },{route,kmh,lane});results.push(row);console.log(JSON.stringify(row));
 }
 for(const route of['tunnel-cut','harbor-cut'])for(const[q,name]of[[.045,'entry'],[.36,'inside'],[.96,'exit']]){await p.evaluate(({route,q})=>{const Q=window.verticalQA,g=window.testGame;Q.fixture(q,route,0);g.time=12;Q.view([0,5.7,-13],[0,1,15],false);},{route,q});await p.screenshot({path:`docs/city-quality-repair/${label}-${route}-${name}.jpg`,quality:90});}
 writeFileSync(`docs/city-quality-repair/${label}-browser-shortcuts.json`,JSON.stringify(results,null,2));if(label!=='before')assert.ok(results.every(r=>r.entered&&r.exit));
}finally{await browser.close()}
