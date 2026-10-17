import{createRequire}from'node:module';import{mkdirSync,writeFileSync}from'node:fs';import assert from'node:assert/strict';
const{chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE??'playwright');
const label=process.argv[2]??'before',folder=`.qa/performance/${label}`;mkdirSync(folder,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto((process.env.PERF_URL??'http://127.0.0.1:5175')+'/scripts/qa/performance.html'+(process.env.PERF_QUERY??''));await page.waitForFunction(()=>window.perfQA,null,{timeout:120000});await page.evaluate(()=>window.perfQA.ready());
 const metadata=await page.evaluate(()=>window.perfQA.metadata());console.log(JSON.stringify({label,metadata}));
 const scenarios={},summary={};const percentile=(a,p)=>a.toSorted((a,b)=>a-b)[Math.min(a.length-1,Math.floor(a.length*p))],average=a=>a.reduce((a,b)=>a+b,0)/a.length;
 for(const name of (process.env.PERF_SCENARIOS??'idle,normal,high,five,boost,jump,district,collision').split(',')){
  const samples=Number(process.env.PERF_SAMPLES??180);
  const result=await page.evaluate(async({name,samples})=>window.perfQA.run(name,{samples}),{name,samples});scenarios[name]=result;
  result.gpuDiagnostics=await page.evaluate(async({name,samples})=>window.perfQA.run(name,{samples,warmup:0,gpuEvery:30}),{name,samples});
  const frames=result.frames,intervals=frames.map(f=>f.interval).filter(Number.isFinite),slow=intervals.toSorted((a,b)=>b-a).slice(0,Math.max(1,Math.ceil(intervals.length*.01)));
  const gpuFrames=result.gpuDiagnostics.frames.filter(f=>f.gpuMeasured&&!f.disjoint),cpuKeys=[...new Set(frames.flatMap(f=>Object.keys(f.cpu)))],gpuKeys=[...new Set(gpuFrames.flatMap(f=>Object.keys(f.gpu)))];
  summary[name]={meanMs:average(intervals),fps:1000/average(intervals),onePercentLow:1000/average(slow),p99Ms:percentile(intervals,.99),stutters50ms:intervals.filter(v=>v>50).length,stutters100ms:intervals.filter(v=>v>100).length,draws:average(frames.map(f=>f.draws)),triangles:average(frames.map(f=>f.triangles)),cpu:Object.fromEntries(cpuKeys.map(k=>[k,average(frames.map(f=>f.cpu[k]??0))])),gpu:gpuFrames.length?Object.fromEntries(gpuKeys.map(k=>[k,average(gpuFrames.map(f=>f.gpu[k]??0))])):null,gpuSamples:gpuFrames.length,memory:frames.at(-1).memory,heap:result.heap,state:result.state};
  console.log(JSON.stringify({label,scenario:name,...summary[name]}));writeFileSync(`${folder}/results.json`,JSON.stringify({label,metadata,summary,scenarios,errors},null,2));
 }
 await page.addStyleTag({content:'.topbar,.race-hud,.tools,.audio-controls,.countdown,.keyboard,.speedometer,footer,.touch,.trick-toast{visibility:hidden!important}'});
 const poses={};for(const name of ['waterNear','waterFar','wake','racer','district','five']){poses[name]=await page.evaluate(name=>window.perfQA.shot(name),name);await page.screenshot({path:`${folder}/${name}.png`});}
 writeFileSync(`${folder}/poses.json`,JSON.stringify(poses,null,2));assert.deepEqual(errors,[]);writeFileSync(`${folder}/results.json`,JSON.stringify({label,metadata,summary,scenarios,errors},null,2));
}finally{await browser.close();}
