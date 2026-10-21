import {preview} from 'vite';import {loadPlaywright} from './qa-playwright.mjs';import {mkdir,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const out='work/mobile-quality';await mkdir(out,{recursive:true});
const servers=await Promise.all(['before','after'].map((label,i)=>preview({build:{outDir:'.qa/mobile-quality-'+label},preview:{host:'127.0.0.1',port:5301+i,strictPort:true}})));
const {chromium}=loadPlaywright(),browser=await chromium.launch({channel:'msedge',headless:true}),results=[],errors=[];
try{
 for(const [pass,label,port] of [[1,'before',5301],[1,'after',5302],[2,'after',5302],[2,'before',5301]]){
  const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/scripts/qa/vertical.html`);await page.waitForFunction(()=>window.verticalQA,undefined,{timeout:180000});await page.evaluate(()=>window.verticalQA.ready());
  for(const [scenario,t,route] of [['city-five',.06,null],['harbor-five',.18,'harbor-cut']]){
   if(pass===1){await page.evaluate(({t,route})=>{const g=window.testGame,q=window.verticalQA;q.fixture(t,route,0,true);g.time=12;q.view([0,5.7,-13],[0,1,12],false);g.renderer.render(g.scene,g.camera.camera);},{t,route});await page.locator('canvas.game-canvas').screenshot({path:`${out}/${label}-${scenario}.png`});}
   const result=await page.evaluate(async({t,route})=>{
    const g=window.testGame,q=window.verticalQA;
    q.fixture(t,route,40,true);if(route)g.race.racers.forEach(r=>r.passed=15);g.paused=false;
    for(let i=0;i<60;i++){await new Promise(requestAnimationFrame);q.step(false);}q.fixture(t,route,40,true);if(route)g.race.racers.forEach(r=>r.passed=15);g.paused=false;
    const times=[],cpu=[],calls=[],triangles=[];g.renderer.info.autoReset=false;let last;
    for(let i=0;i<180;i++){await new Promise(requestAnimationFrame);const now=performance.now();g.renderer.info.reset();const start=performance.now();q.step(false);if(last){times.push(now-last);cpu.push(performance.now()-start);calls.push(g.renderer.info.render.calls);triangles.push(g.renderer.info.render.triangles);}last=now;}
    g.paused=true;g.renderer.info.autoReset=true;const mean=a=>a.reduce((s,v)=>s+v,0)/a.length,gl=g.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
    return {fps:1000/mean(times),cpuMs:mean(cpu),p95Ms:[...times].sort((a,b)=>a-b)[Math.floor(times.length*.95)],calls:mean(calls),triangles:mean(triangles),pixelRatio:g.renderer.getPixelRatio(),waterSegments:g.water.mesh.geometry.parameters.widthSegments,reflectionSize:g.water.mesh.material.uniforms.mirrorSampler.value.image.width,racerShadowSize:g.heroLighting.target.width,cityShadowSize:g.citySample.sun.shadow.mapSize.x,renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'unknown',end:{x:g.craft.model.x,z:g.craft.model.z},passed:g.race.racers.map(r=>r.passed)};
   },{t,route});results.push({pass,label,scenario,...result});console.log(JSON.stringify(results.at(-1)));
  }
  await page.evaluate(()=>window.testGame.dispose());await page.close();
 }
 assert.deepEqual(errors,[]);
 await writeFile(out+'/performance.json',JSON.stringify({method:'Same Edge process, before/after/after/before. Desktop 1600x1000 DPR1 standard. Actual Game.frame, five racers, same replays; 60 warmup +180 measured RAF steps per scene. All original desktop visual budgets retained. Desktop GPU and browser results do not establish real phone FPS.',results,errors},null,2));
}finally{await browser.close();await Promise.all(servers.map(s=>s.close()));}
