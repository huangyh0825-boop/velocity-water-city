import{loadPlaywright}from'./qa-playwright.mjs';import{writeFileSync}from'node:fs';import assert from'node:assert/strict';
const{chromium}=loadPlaywright(),browser=await chromium.launch({channel:'msedge',headless:true}),results=[];
try{for(const[pass,label,port]of[[1,'before',5184],[1,'after',5182],[2,'after',5182],[2,'before',5184]]){
 const p=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1}),errors=[];p.on('pageerror',e=>errors.push(String(e)));
 await p.goto(`http://127.0.0.1:${port}/scripts/qa/vertical.html`,{waitUntil:'commit'});await p.waitForFunction(()=>window.verticalQA,null,{timeout:180000});await p.evaluate(()=>window.verticalQA.ready());
 const compute=await p.evaluate(()=>{
  const g=window.testGame,q=window.verticalQA,render=g.renderer.render.bind(g.renderer),hero=g.heroLighting.update.bind(g.heroLighting),ai=g.aiLighting.map(l=>l.updateVisible.bind(l));
  g.renderer.render=()=>{};g.heroLighting.update=()=>{};g.aiLighting.forEach(l=>l.updateVisible=()=>false);
  q.fixture(.06,null,48,true);for(let i=0;i<180;i++)q.step(false);q.fixture(.06,null,48,true);
  const original=g.track.project.bind(g.track);let queries=0;g.track.project=(...args)=>{queries++;return original(...args);};const started=performance.now();
  for(let i=0;i<1800;i++)q.step(false);const elapsed=performance.now()-started;g.track.project=original;g.paused=true;
  g.renderer.render=render;g.heroLighting.update=hero;g.aiLighting.forEach((l,i)=>l.updateVisible=ai[i]);
  return{elapsedMs:elapsed,msPerStep:elapsed/1800,queries,queriesPerStep:queries/1800,end:[g.craft,...g.aiCraft].map(c=>({x:c.model.x,z:c.model.z,y:c.model.y,route:c.model.route})),passed:g.race.racers.map(r=>r.passed)};
 });
 results.push({pass,label,scenario:'five-compute',...compute});console.log(JSON.stringify({pass,label,scenario:'five-compute',...compute}));
 for(const[scenario,t,route,nearbyAI]of[['city-five',.06,null,true],['harbor-five',.18,'harbor-cut',true]]){
  const r=await p.evaluate(async({t,route,nearbyAI})=>{
   const g=window.testGame,q=window.verticalQA,frames=[],cpu=[],calls=[],triangles=[];q.fixture(t,route,40,nearbyAI);q.setSpeedCap(144);if(route==='harbor-cut')g.race.racers.forEach(r=>r.passed=15);
   for(let i=0;i<60;i++){await new Promise(requestAnimationFrame);q.step(false);}q.fixture(t,route,40,nearbyAI);q.setSpeedCap(144);if(route==='harbor-cut')g.race.racers.forEach(r=>r.passed=15);
   g.renderer.info.autoReset=false;let previous;
   for(let i=0;i<240;i++){await new Promise(requestAnimationFrame);const now=performance.now();g.renderer.info.reset();const started=performance.now();q.step(false);if(previous!==undefined){frames.push(now-previous);cpu.push(performance.now()-started);calls.push(g.renderer.info.render.calls);triangles.push(g.renderer.info.render.triangles);}previous=now;}
   g.renderer.info.autoReset=true;g.paused=true;const avg=a=>a.reduce((s,v)=>s+v,0)/a.length,sorted=[...frames].sort((a,b)=>a-b);
   const gl=g.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
   return{fps:1000/avg(frames),frameMs:avg(frames),p95Ms:sorted[Math.floor(sorted.length*.95)],p99Ms:sorted[Math.floor(sorted.length*.99)],cpuMs:avg(cpu),calls:avg(calls),triangles:avg(triangles),low:g.low,pixelRatio:g.renderer.getPixelRatio(),waterSegments:g.water.mesh.geometry.parameters.widthSegments,waterNormals:g.water.mesh.material.uniforms.normalSampler.value.image.width,renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null,end:{x:g.craft.model.x,z:g.craft.model.z,y:g.craft.model.y,route:g.craft.model.route},passed:g.race.racers.map(r=>r.passed)};
  },{t,route,nearbyAI});results.push({pass,label,scenario,...r});console.log(JSON.stringify({pass,label,scenario,...r}));
 }
 assert.deepEqual(errors,[]);await p.close();
}writeFileSync('docs/shortcut-choice/performance.json',JSON.stringify({method:'Current pre-fix homepage build versus shortcut-choice fix. Same Edge process, before/after/after/before order; 1600x1000 DPR1 standard, same 5-boat replay, 60 warmup +240 measured RAF steps. S2 fixtures start at sector15 so the bypass guard is exercised even when its next optional marker was missed. Compute-only replay skips GPU drawing/shadows, 180 warmup+1800 measured actual Game.frame steps; no FPS claim for compute-only values. All loaded geometry/textures/shaders, quality controls, reflections and shadows kept for RAF samples.',results},null,2));}finally{await browser.close()}
