import {loadPlaywright} from './qa-playwright.mjs';import{writeFileSync}from'node:fs';
const {chromium}=loadPlaywright(),browser=await chromium.launch({channel:'msedge',headless:true}),results=[];
const passes=process.argv[2]==='reverse'?[['after',5182],['before',5184]]:[['before',5184],['after',5182]];
try{for(const[label,port]of passes){const p=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});await p.goto(`http://127.0.0.1:${port}/scripts/qa/vertical.html`,{waitUntil:'commit'});await p.waitForFunction(()=>window.verticalQA,null,{timeout:180000});await p.evaluate(()=>window.verticalQA.ready());
 for(const[scenario,five]of[['single',false],['five',true]]){
  const r=await p.evaluate(async({five})=>{const g=window.testGame,q=window.verticalQA,frames=[],cpu=[],trackCPU=[],riderCPU=[],triangles=[];let nowTrack=0,nowRider=0;
   const project=g.track.project.bind(g.track);g.track.project=(...args)=>{const s=performance.now();try{return project(...args)}finally{nowTrack+=performance.now()-s}};
   const crafts=[g.craft,...g.aiCraft],originals=crafts.map(c=>c.sync.bind(c));crafts.forEach((c,i)=>c.sync=(...args)=>{const s=performance.now();try{return originals[i](...args)}finally{nowRider+=performance.now()-s}});
   q.fixture(.06,null,48,five);for(let i=0;i<90;i++){await new Promise(requestAnimationFrame);q.step();}
   q.fixture(.06,null,48,five);g.renderer.info.autoReset=false;let previous;
   for(let i=0;i<240;i++){await new Promise(requestAnimationFrame);const now=performance.now();nowTrack=nowRider=0;g.renderer.info.reset();const s=performance.now();q.step();if(previous!==undefined){frames.push(now-previous);cpu.push(performance.now()-s);trackCPU.push(nowTrack);riderCPU.push(nowRider);triangles.push(g.renderer.info.render.triangles)}previous=now;}
   g.renderer.info.autoReset=true;g.track.project=project;crafts.forEach((c,i)=>c.sync=originals[i]);g.paused=true;
   const avg=a=>a.reduce((s,v)=>s+v,0)/a.length;return{fps:1000/avg(frames),low1:1000/avg([...frames].sort((a,b)=>b-a).slice(0,3)),frameMs:avg(frames),cpuMs:avg(cpu),trackCPU:avg(trackCPU),riderCPU:avg(riderCPU),triangles:avg(triangles),end:{kmh:g.craft.model.speed*3.6,x:g.craft.model.x,z:g.craft.model.z,passed:g.race.player.passed,ai:g.ai.map(a=>({x:a.model.x,z:a.model.z}))}};
  },{five});results.push({label,scenario,...r});console.log(label,scenario,JSON.stringify(r));
 }
 await p.close();}
 writeFileSync(`docs/startup-performance/gameplay-${process.argv[2]??'forward'}.json`,JSON.stringify({conditions:'Same production builds, Edge, 1600x1000 DPR1 standard, 90 warmup +240 deterministic 60Hz simulation steps per camera-tracked driving replay; player autopilot, five includes clustered start, rivals subsequently race normally. CPU timings include submission/driver waits. This is a four-second simulation path, not a full-race FPS guarantee.',results},null,2));
}finally{await browser.close()}
