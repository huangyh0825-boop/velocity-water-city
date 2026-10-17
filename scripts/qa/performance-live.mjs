import{createRequire}from'node:module';import{mkdirSync,writeFileSync}from'node:fs';import assert from'node:assert/strict';
const{chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE??'playwright');
const label=process.argv[2]??'live',folder=`.qa/performance/${label}`;mkdirSync(folder,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto((process.env.PERF_URL??'http://127.0.0.1:5176')+'/scripts/qa/performance.html');await page.waitForFunction(()=>window.perfQA,null,{timeout:120000});await page.evaluate(()=>window.perfQA.ready());
 const results={};
 for(const name of ['high','five','collision']){
  // Compile/upload before measuring, then let the unmodified 60Hz accumulator
  // advance from actual RAF timestamps for a six-second wall-clock window.
  await page.evaluate(name=>window.perfQA.run(name,{warmup:180,samples:1}),name);
  results[name]=await page.evaluate(async name=>{
   const g=window.testGame;window.perfQA.setup(name);g.previous=0;g.accumulator=0;
   const original=g.frame,r=g.renderer;r.info.autoReset=false;
   const frames=[];let previous,start;
   await new Promise(resolve=>{
    g.frame=now=>{r.info.reset();const t=performance.now();original(now);if(start===undefined)start=now;if(previous!==undefined&&now-start>1500)frames.push({interval:now-previous,cpuMs:performance.now()-t,draws:r.info.render.calls,triangles:r.info.render.triangles});previous=now;if(now-start>=7500){cancelAnimationFrame(g.frameId);g.paused=true;resolve();}};
    g.frameId=requestAnimationFrame(g.frame);
   });g.frame=original;
   const average=a=>a.reduce((a,b)=>a+b,0)/a.length,slow=frames.map(f=>f.interval).sort((a,b)=>b-a).slice(0,Math.ceil(frames.length*.01));
   return{schedule:'real wall-clock RAF, 1.5s settle + 6s measurement',frames,meanMs:average(frames.map(f=>f.interval)),fps:1000/average(frames.map(f=>f.interval)),onePercentLow:1000/average(slow),stutters50ms:frames.filter(f=>f.interval>50).length,kmh:g.craft.model.speed*3.6};
  },name);console.log(JSON.stringify({label,scenario:name,...results[name],frames:results[name].frames.length}));
 }
 assert.deepEqual(errors,[]);writeFileSync(folder+'/results.json',JSON.stringify({metadata:await page.evaluate(()=>window.perfQA.metadata()),results,errors},null,2));
}finally{await browser.close();}
