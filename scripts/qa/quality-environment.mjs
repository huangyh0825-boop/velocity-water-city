import{loadPlaywright}from'./qa-playwright.mjs';import{writeFileSync,mkdirSync,readFileSync}from'node:fs';
const{chromium}=loadPlaywright(),b=await chromium.launch({channel:'msedge',headless:true}),report=[];mkdirSync('docs/city-quality-repair/environment',{recursive:true});
try{const p=await b.newPage({viewport:{width:1600,height:1000}});p.setDefaultTimeout(240000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
 for(const[label,port]of(process.argv[2]==='after'?[['after',5177]]:[['before',5182],['after',5177]])){
  await p.goto(`http://127.0.0.1:${port}/scripts/qa/vertical.html`);await p.waitForFunction(()=>window.verticalQA);await p.evaluate(()=>window.verticalQA.ready());
  const stats=await p.evaluate(()=>{const g=window.testGame,d=g.citySample.density;return{buildings:d.sites.length,infill:d.sites.filter(s=>s.id.startsWith('world-infill-')).map(s=>({id:s.id,kind:s.kind,angle:s.angle})),interiors:d.interiors.selected.length,pockets:d.furnishings.pockets,counts:d.furnishings.counts,memory:g.renderer.info.memory}});report.push({label,...stats});
  for(const[id,t]of[['central',.055],['science',.215],['transit',.365],['industrial',.545],['harbor',.75],['leisure',.925]]){
   await p.evaluate(t=>{const g=window.testGame,Q=window.verticalQA;Q.fixture(t,null,45,true);g.time=12;g.race.elapsed=10;g.hud.update(g.craft.model,g.race,false,g.nitro,g.flight,g.tricks);g.paused=true;Q.view([0,5.7,-13],[0,1,15],true);document.querySelector('.countdown').style.display='none'},t);await p.screenshot({path:`docs/city-quality-repair/environment/${label}-${id}-driver.jpg`,quality:90});
  }
  // Identical absolute camera transforms for before/after empty-lot comparisons.
  for(const[id,t,side]of[['central-plaza',.137,-1],['science-park',.245,1],['transit-court',.377,-1],['industrial-yard',.575,1],['harbor-wharf',.755,1],['leisure-garden',.945,-1]]){
   await p.evaluate(({t,side})=>{const g=window.testGame,Q=window.verticalQA,T=window.qaTHREE;Q.fixture(t,null,0);g.time=12;const h=g.track.heading(t*Math.PI*2),p=g.track.point(t*Math.PI*2,side*(g.track.widthAt(t*Math.PI*2)+43)),c=g.camera.camera;c.fov=52;c.updateProjectionMatrix();c.position.set(p.x-Math.sin(h)*38-Math.cos(h)*side*30,19,p.z-Math.cos(h)*38+Math.sin(h)*side*30);c.lookAt(p.x,1.8,p.z);g.citySample.update(12,c);g.water.update(12);g.renderer.render(g.scene,c);document.body.classList.add('qa-hide-hud')},{t,side});await p.screenshot({path:`docs/city-quality-repair/environment/${label}-${id}.jpg`,quality:90});
  }
  if(label==='after'){
   const pockets=stats.pockets.filter(s=>s.id.startsWith('civic-'));
   for(const[id,kind]of[['crowd','race-plaza'],['green','park'],['market','market'],['service','maintenance'],['transport','transit-court']]){
    const s=pockets.find(p=>p.kind===kind&&p.rx>=7)??pockets.find(p=>p.kind===kind);await p.evaluate(s=>{const g=window.testGame,Q=window.verticalQA;Q.fixture(s.angle/(Math.PI*2),null,0);const h=s.heading,c=g.camera.camera;c.fov=52;c.updateProjectionMatrix();c.position.set(s.x-Math.sin(h)*17-Math.cos(h)*18,10,s.z-Math.cos(h)*17+Math.sin(h)*18);c.lookAt(s.x,1.5,s.z);g.citySample.update(12,c);g.renderer.render(g.scene,c);document.body.classList.add('qa-hide-hud')},s);await p.screenshot({path:`docs/city-quality-repair/environment/${id}-close.jpg`,quality:92});
   }
  }
  await p.evaluate(()=>window.verticalQA.overhead());await p.screenshot({path:`docs/city-quality-repair/environment/${label}-whole-map.jpg`,quality:92});
  await p.evaluate(()=>{const g=window.testGame;g.dispose();g.renderer.forceContextLoss()});
 }writeFileSync('docs/city-quality-repair/environment-stats.json',JSON.stringify({report:process.argv[2]==='after'?[JSON.parse(readFileSync('docs/city-quality-repair/environment-stats.json','utf8')).report.find(r=>r.label==='before'),...report]:report,errors},null,2));console.log(report.map(r=>({label:r.label,buildings:r.buildings,pockets:r.pockets.length,counts:r.counts})),errors);
}finally{await b.close()}
