import{loadPlaywright}from'./qa-playwright.mjs';
import{createRequire}from'node:module';import{mkdirSync,writeFileSync}from'node:fs';import assert from'node:assert/strict';
const{chromium}=loadPlaywright(),b=await chromium.launch({channel:'msedge',headless:true});
const mode=process.argv[2]??'after',port=mode==='before'?5179:5177,folder=`docs/world-city/${mode}`;mkdirSync(folder,{recursive:true});
const scenes=[['central',.06],['science',.225],['transit',.37],['industrial',.535],['harbor',.735],['leisure',.935]];
try{const p=await b.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(`http://127.0.0.1:${port}/scripts/qa/vertical.html`);await p.waitForFunction(()=>window.verticalQA,null,{timeout:120000});await p.evaluate(()=>window.verticalQA.ready());
 const capture=async(name,offset,target,hud=false)=>{await p.evaluate(({offset,target,hud})=>window.verticalQA.view(offset,target,hud),{offset,target,hud});await p.screenshot({path:`${folder}/${name}.png`});};
 const results=[];
 for(const[id,t]of scenes){
  await p.evaluate(t=>{window.verticalQA.fixture(t,null,0,true);window.testGame.time=12;},t);
  await capture(id+'-drive',[0,5.7,-13],[0,1,12],true);await capture(id+'-bank',[30,9,-35],[52,8,12]);
  const r=await p.evaluate(async()=>{const g=window.testGame;window.verticalQA.view([0,5.7,-13],[0,1,12],true);await g.renderer.compileAsync(g.scene,g.camera.camera);const gl=g.renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),pending=[],gpu=[],frames=[],cpu=[],calls=[],triangles=[];let draw=0,tri=0,last=0;const render=g.renderer.render.bind(g.renderer);g.renderer.render=(...args)=>{render(...args);draw+=g.renderer.info.render.calls;tri+=g.renderer.info.render.triangles;};
   for(let i=0;i<240;i++){await new Promise(requestAnimationFrame);const now=performance.now();draw=tri=0;let q;if(ext&&i>=120&&i%10===0){q=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,q);}const start=performance.now();g.citySample.update(12,g.camera.camera);g.heroLighting.update(g.renderer,g.scene,g.craft.visual);g.aiCraft.forEach((c,i)=>g.aiLighting[i].updateVisible(g.renderer,g.scene,c.visual,g.camera.camera));g.renderer.render(g.scene,g.camera.camera);if(q){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(q);}if(i>=120){frames.push(now-last);cpu.push(performance.now()-start);calls.push(draw);triangles.push(tri);}last=now;for(let j=pending.length-1;j>=0;j--)if(gl.getQueryParameter(pending[j],gl.QUERY_RESULT_AVAILABLE)){if(!gl.getParameter(ext.GPU_DISJOINT_EXT))gpu.push(gl.getQueryParameter(pending[j],gl.QUERY_RESULT)/1e6);gl.deleteQuery(pending[j]);pending.splice(j,1);}}
   g.renderer.render=render;pending.forEach(q=>gl.deleteQuery(q));const mean=a=>a.reduce((s,v)=>s+v,0)/a.length,worst=[...frames].sort((a,b)=>b-a).slice(0,Math.ceil(frames.length*.01));return{fps:1000/mean(frames),low1:1000/mean(worst),frameMs:mean(frames),cpuMs:mean(cpu),gpuMs:gpu.length?mean(gpu):null,gpuSamples:gpu.length,calls:mean(calls),triangles:mean(triangles),memory:g.renderer.info.memory,city:g.citySample.density.stats()};});results.push({id,t,...r});console.log(mode,id,JSON.stringify(r));
 }
 if(mode==='after'){
  await p.evaluate(()=>window.verticalQA.fixture(.35,null,0,true));await capture('elevated',[38,19,-35],[0,2,20]);
  for(const route of ['tunnel-cut','harbor-cut']){await p.evaluate(route=>window.verticalQA.fixture(.23,route,0),route);await capture(route,[0,6,-16],[0,2,18],true);}
  await p.evaluate(()=>{window.verticalQA.fixture(.03,null,0);window.verticalQA.overhead();});await p.screenshot({path:folder+'/overview.png'});
  await p.evaluate(()=>window.verticalQA.fixture(.225,null,0));await capture('skyline',[0,95,-120],[40,35,160]);
  const audit=await p.evaluate(()=>{const g=window.testGame,names=[];g.scene.traverse(o=>{if(/checkpoint-(gate|sign)|district-sign/.test(o.name))names.push(o.name);});return{names,sites:g.citySample.density.sites,interiors:g.citySample.density.interiors.selected.map(s=>s.id),stats:g.citySample.density.stats(),scene:g.renderer.info.memory};});assert.deepEqual(audit.names,[]);writeFileSync(folder+'/audit.json',JSON.stringify(audit,null,2));
 }
 assert.deepEqual(errors,[]);writeFileSync(folder+'/performance.json',JSON.stringify({mode,resolution:[1600,1000],dpr:1,method:'Production build, headless Edge, compileAsync then 120 warm-up + 120 RAF samples, frozen physics and water t=12, identical camera and 5 boats. Short stationary GPU/CPU submission benchmarks, not a full-race FPS guarantee.',results,errors},null,2));
}finally{await b.close();}
