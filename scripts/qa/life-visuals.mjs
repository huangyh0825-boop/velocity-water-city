import{loadPlaywright}from'./qa-playwright.mjs';import{writeFileSync}from'node:fs';import assert from'node:assert/strict';
const{chromium}=loadPlaywright(),b=await chromium.launch({channel:'msedge',headless:true}),folder='docs/waterfront-life',views=[],errors=[];
try{const p=await b.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});p.on('pageerror',e=>errors.push(e.message));
for(const[label,port]of[['after',5177],['before',5182]]){
 await p.goto(`http://127.0.0.1:${port}/scripts/qa/vertical.html`);await p.waitForFunction(()=>window.verticalQA);await p.evaluate(()=>window.verticalQA.ready());
 if(label==='after'){
  const data=await p.evaluate(()=>{const f=window.testGame.citySample.density.furnishings;return{pockets:f.pockets,counts:f.counts,batches:f.root.children.length}});writeFileSync(folder+'/layout.json',JSON.stringify(data,null,2));
  for(const id of ['central','science','transit','industrial','harbor','leisure']){const list=data.pockets.filter(p=>p.district===id),pocket=list.find(p=>p.kind==='viewing')??list.find(p=>p.kind==='service')??list.find(p=>p.kind==='promenade')??list[0];views.push({id,pocket});}
  for(const id of ['central','science','leisure'])views.push({id:id+'-forecourt',pocket:data.pockets.find(p=>p.district===id&&p.kind==='courtyard')});
 }
 for(const view of views){
  await p.evaluate(({pocket})=>{const g=window.testGame,T=window.qaTHREE,q=window.verticalQA;q.fixture(pocket.angle/(Math.PI*2),null,0,true);g.paused=true;g.time=12;g.hud.update(g.craft.model,g.race,false,g.nitro,g.flight,g.tricks);const h=pocket.heading,at=(x,y,z)=>new T.Vector3(pocket.x+Math.cos(h)*x+Math.sin(h)*z,y,pocket.z-Math.sin(h)*x+Math.cos(h)*z);g.camera.camera.fov=52;g.camera.camera.updateProjectionMatrix();g.camera.camera.position.copy(pocket.kind==='courtyard'?at(-7,5,-12):at(-pocket.side*10,6,-11));g.camera.camera.lookAt(at(0,1,pocket.kind==='courtyard'?2:0));g.citySample.update(12,g.camera.camera);g.water.update(12);g.heroLighting.update(g.renderer,g.scene,g.craft.visual);g.renderer.render(g.scene,g.camera.camera);document.body.classList.add('qa-hide-hud');},{pocket:view.pocket});
  await p.screenshot({path:`${folder}/${label}-${view.id}-quay.jpg`,quality:88});
 }
 await p.evaluate(()=>{const q=window.verticalQA,g=window.testGame;q.fixture(.06,null,0,true);g.hud.update(g.craft.model,g.race,false,g.nitro,g.flight,g.tricks);g.time=12;q.view([24,10,-32],[30,2,10],false)});await p.screenshot({path:`${folder}/${label}-sample-promenade.jpg`,quality:88});
 if(label==='after')for(const[id,t]of[['central',.06],['science',.205],['transit',.37],['industrial',.55],['harbor',.765],['leisure',.92]]){
  await p.evaluate(t=>{const g=window.testGame,q=window.verticalQA;q.fixture(t,null,40,true);g.time=12;g.hud.update(g.craft.model,g.race,false,g.nitro,g.flight,g.tricks);q.view([0,5.7,-13],[0,1,12],true);},t);await p.screenshot({path:`${folder}/driver-${id}.jpg`,quality:88});
 }
 await p.evaluate(()=>{const g=window.testGame;g.dispose();g.renderer.forceContextLoss();});
}
assert.deepEqual(errors,[]);writeFileSync(folder+'/visual-views.json',JSON.stringify({views,errors,settings:'1600x1000 DPR1 standard quality, t=12, FOV52; matching camera transforms for before/after; baseline aeb908e'},null,2));console.log('Ten matching comparisons and six driver views captured.');
}finally{await b.close();}
