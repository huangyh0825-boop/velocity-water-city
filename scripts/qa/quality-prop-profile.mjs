import{loadPlaywright}from'./qa-playwright.mjs';import{writeFileSync}from'node:fs';
const{chromium}=loadPlaywright(),b=await chromium.launch({channel:'msedge',headless:true}),rows=[];
try{const p=await b.newPage({viewport:{width:1600,height:1000}});p.setDefaultTimeout(240000);await p.goto('http://127.0.0.1:5177/scripts/qa/vertical.html');await p.waitForFunction(()=>window.verticalQA);await p.evaluate(()=>window.verticalQA.ready());
 for(const t of[.06,.535])for(const lod of[false,true]){
  const r=await p.evaluate(async({t,lod})=>{const g=window.testGame,Q=window.verticalQA;Q.fixture(t,null,0,true);g.time=12;for(const b of g.citySample.density.furnishings.batches)b.lodEnabled=lod;g.citySample.sun.shadow.needsUpdate=true;Q.view([0,5.7,-13],[0,1,12],false);const frames=[],cpu=[];let last=0;
   for(let i=0;i<240;i++){await new Promise(requestAnimationFrame);const now=performance.now(),start=now;g.citySample.update(12,g.camera.camera);g.heroLighting.update(g.renderer,g.scene,g.craft.visual);g.aiCraft.forEach((c,i)=>g.aiLighting[i].updateVisible(g.renderer,g.scene,c.visual,g.camera.camera));g.renderer.render(g.scene,g.camera.camera);if(i>=60){frames.push(now-last);cpu.push(performance.now()-start)}last=now}
   const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;return{fps:1000/mean(frames),cpu:mean(cpu),view:g.camera.camera.position.toArray(),material:!!g.citySample.density.furnishings};
  },{t,lod});rows.push({t,lod,...r});await p.screenshot({path:`docs/city-quality-repair/lod-${t}-${lod}.png`});console.log(rows.at(-1));
 }writeFileSync('docs/city-quality-repair/prop-lod-profile.json',JSON.stringify(rows,null,2));
}finally{await b.close()}
