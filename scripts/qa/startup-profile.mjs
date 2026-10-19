import {loadPlaywright} from './qa-playwright.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const label=process.argv[2]??'before',port=process.argv[3]??'5182';
const {chromium}=loadPlaywright(),browser=await chromium.launch({channel:'msedge',headless:true});
mkdirSync('docs/startup-performance',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{
  let seed=982451653;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  window.bootProbe={longTasks:[],stages:[]};new PerformanceObserver(list=>window.bootProbe.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
  new MutationObserver(()=>{const stage=document.querySelector('.boot-screen')?.dataset.stage,last=window.bootProbe.stages.at(-1);if(stage&&stage!==last?.stage)window.bootProbe.stages.push({stage,time:performance.now()});}).observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['data-stage']});
 });
 await page.goto(`http://127.0.0.1:${port}/scripts/qa/vertical.html`,{waitUntil:'commit'});
 await page.waitForFunction(()=>window.verticalQA,null,{timeout:180000});await page.evaluate(()=>window.verticalQA.ready());
 const boot=await page.evaluate(()=>({readyMs:performance.now(),...window.bootProbe,workerDownloads:performance.getEntriesByType('measure').filter(m=>m.name==='model-transport').map(m=>m.detail),resources:performance.getEntriesByType('resource').map(r=>({name:r.name.split('/').slice(3).join('/'),bytes:r.encodedBodySize,duration:r.duration})),heap:performance.memory?.usedJSHeapSize}));
 console.log(label,'ready',Math.round(boot.readyMs),'longestTask',Math.round(Math.max(...boot.longTasks.map(t=>t.duration))));
 const results=[];
 for(const[id,t,offset,target]of[['city-driver',.06,[0,5.7,-13],[0,1,12]],['city-distance',.06,[0,42,-100],[0,14,180]],['elevated-five',.34,[0,5.7,-13],[0,1,12]],['tunnel-five',.535,[0,5.7,-13],[0,1,12]]].filter(v=>!process.argv[4]||v[0]===process.argv[4])){
  const r=await page.evaluate(async({t,offset,target})=>{
   const g=window.testGame,q=window.verticalQA;q.fixture(t,null,0,true);g.time=12;q.view(offset,target,false);await g.renderer.compileAsync(g.scene,g.camera.camera);
   const frames=[],cpu=[],calls=[],triangles=[];let last;g.renderer.info.autoReset=false;
   for(let i=0;i<240;i++){await new Promise(requestAnimationFrame);const now=performance.now();g.renderer.info.reset();const start=performance.now();g.citySample.update(12,g.camera.camera);g.heroLighting.update(g.renderer,g.scene,g.craft.visual);g.aiCraft.forEach((c,i)=>g.aiLighting[i].updateVisible(g.renderer,g.scene,c.visual,g.camera.camera));g.renderer.render(g.scene,g.camera.camera);if(i>=60){frames.push(now-last);cpu.push(performance.now()-start);calls.push(g.renderer.info.render.calls);triangles.push(g.renderer.info.render.triangles);}last=now;}
   g.renderer.info.autoReset=true;const avg=a=>a.reduce((s,v)=>s+v,0)/a.length,gl=g.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
   return {fps:1000/avg(frames),frameMs:avg(frames),low1:1000/avg([...frames].sort((a,b)=>b-a).slice(0,Math.ceil(frames.length*.01))),cpuMs:avg(cpu),calls:avg(calls),triangles:avg(triangles),memory:g.renderer.info.memory,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null};
  },{t,offset,target});
  results.push({id,...r});await page.screenshot({path:`docs/startup-performance/${label}-${id}.png`});console.log(label,id,JSON.stringify(r));
 }
 writeFileSync(`docs/startup-performance/${label}.json`,JSON.stringify({label,conditions:'Edge, production build, 1600x1000 DPR1, standard quality, seeded RNG, all five racers frozen t12; 60 warmup +180 RAF frames per view, no GPU queries; fresh browser cache, unthrottled localhost startup.',boot,errors,results},null,2));
}finally{await browser.close();}
