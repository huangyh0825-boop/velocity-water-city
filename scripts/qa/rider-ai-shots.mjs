import{createRequire}from'node:module';import{mkdirSync,writeFileSync}from'node:fs';import assert from'node:assert/strict';
const{chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE??'playwright');
const out='.qa/rider-ai';mkdirSync(out,{recursive:true});const b=await chromium.launch({channel:'msedge',headless:true});
try{
 const p=await b.newPage({viewport:{width:1600,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.goto('http://127.0.0.1:5173/scripts/qa/hero-water.html');
 await p.waitForFunction(()=>window.testGame?.citySample.loaded&&[window.testGame.craft,...window.testGame.aiCraft].every(c=>c.assetLoaded),null,{timeout:120000});
 await p.evaluate(()=>{const g=window.testGame;g.paused=true;g.track.spawn(g.craft.model,.041*Math.PI*2);Object.assign(g.craft.model,{speed:0,yawRate:0});g.craft.sync(0);g.craft.rider.update(1,0,0);g.aiCraft.forEach(c=>c.object.visible=false);g.water.update(0);});
 await p.addStyleTag({content:'.topbar,.race-hud,.tools,.audio-controls,.countdown,.keyboard,.speedometer,footer,.touch,.trick-toast{visibility:hidden!important}'});
 async function shot(name,pose){
  await p.evaluate(({pose})=>{const g=window.testGame,m=g.craft.model,h=m.heading,w=(x,y,z)=>[m.x+Math.cos(h)*x+Math.sin(h)*z,y,m.z-Math.sin(h)*x+Math.cos(h)*z];g.camera.camera.fov=38;g.camera.camera.updateProjectionMatrix();g.camera.camera.position.set(...w(...pose.slice(0,3)));g.camera.camera.lookAt(...w(...pose.slice(3)));g.citySample.update(0,g.camera.camera);g.heroLighting.update(g.renderer,g.scene,g.craft.visual);g.aiCraft.forEach((c,i)=>{if(c.object.visible)g.aiLighting[i].update(g.renderer,g.scene,c.visual);});g.renderer.render(g.scene,g.camera.camera);},{pose});
  await p.screenshot({path:`${out}/${name}.png`});
 }
 await shot('rider-front',[.65,1.9,2,0,1.4,.23]);await shot('rider-side',[-2.1,1.7,-.10,0,1.33,.16]);await shot('mounted',[-3.4,2.2,3.4,0,.97,0]);
 const models=await p.evaluate(()=>[window.testGame.craft,...window.testGame.aiCraft].map((c,i)=>{let tri=0;const skins=new Set(),assets=new Set(),colors=[];c.visual.traverse(o=>{if(o.userData.visualAsset)assets.add(o.userData.visualAsset);if(o.isMesh){tri+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;if(o.material.name==='Paint')colors.push(o.material.color.getHexString());if(o.isSkinnedMesh)skins.add(o.skeleton);}});return{i,tri,assets:[...assets].sort(),skinCount:skins.size,color:colors[0],loaded:c.assetLoaded,error:c.assetError};}));
 assert.ok(models.every(m=>m.loaded&&!m.error&&m.assets.join(',')==='rider,watercraft'&&m.skinCount===1));assert.ok(models.every(m=>m.tri===models[0].tri));assert.equal(new Set(models.map(m=>m.color)).size,5);
 // Group portraits are staged on a valid straight; actual racing is checked below.
 await p.evaluate(()=>{const g=window.testGame,m=g.craft.model,h=m.heading;g.craft.object.visible=false;const c=g.aiCraft[0];Object.assign(c.model,{x:m.x,z:m.z,heading:h,speed:0,yawRate:0});c.object.visible=true;c.sync(0);c.rider.update(1,0,0);});
 await shot('ai-single',[-3.4,2.2,3.4,0,.97,0]);
 await p.evaluate(()=>{const g=window.testGame,m=g.craft.model,h=m.heading;g.craft.object.visible=true;g.aiCraft.forEach((c,i)=>{const x=i%2===0?-4.2:4.2,z=i<2?1.8:7.8;Object.assign(c.model,{x:m.x+Math.cos(h)*x+Math.sin(h)*z,z:m.z-Math.sin(h)*x+Math.cos(h)*z,heading:h,speed:0,yawRate:0});c.object.visible=true;c.sync(0);c.rider.update(1,0,0);});});
 await shot('same-field',[-10,5,-10,0,1,2]);
 await p.evaluate(()=>window.testGame.craft.object.visible=false);await shot('multiple-ai',[12,6,-12,0,1,4]);
 // Restore real race state, keyboard acceleration and the unmodified AI controllers.
 await p.evaluate(()=>{const g=window.testGame;g.craft.object.visible=true;g.restart();g.track.spawn(g.craft.model,.032*Math.PI*2);g.craftMotion.reset();g.camera.update(0,g.craft.model,true);g.paused=false;});
 await p.waitForFunction(()=>window.testGame.race.phase==='racing');await p.keyboard.down('w');await p.waitForFunction(()=>window.testGame.craft.model.speed*3.6>130,null,{timeout:30000});
 await p.screenshot({path:`${out}/driving.png`});
 const driving=await p.evaluate(()=>({kmh:window.testGame.craft.model.speed*3.6,rank:document.querySelector('#rank').textContent,lap:document.querySelector('#lap').textContent}));
 await p.keyboard.down('d');await p.waitForTimeout(450);await p.screenshot({path:`${out}/turning.png`});await p.keyboard.up('d');await p.keyboard.up('w');
 // Reproducible parallel racing fixture: put both participants on valid adjacent lanes,
 // then let physics + AI run for 0.35 s. No AI decisions are replaced.
 await p.evaluate(()=>{const g=window.testGame;g.restart();g.race.phase='racing';g.track.spawn(g.craft.model,.032*Math.PI*2);const m=g.craft.model,h=m.heading,c=g.aiCraft[0];Object.assign(m,{speed:38,vx:Math.sin(h)*38,vz:Math.cos(h)*38,yawRate:0});Object.assign(c.model,{x:m.x+Math.cos(h)*3.3,z:m.z-Math.sin(h)*3.3,heading:h,speed:38,vx:Math.sin(h)*38,vz:Math.cos(h)*38,yawRate:0});g.craftMotion.reset();g.aiMotion[0].reset();g.aiCraft.slice(1).forEach(c=>c.object.visible=false);g.paused=false;});
 await p.keyboard.down('w');await p.waitForTimeout(350);await p.evaluate(()=>window.testGame.paused=true);await p.keyboard.up('w');
 const parallel=await p.evaluate(()=>{const g=window.testGame;return{distance:Math.hypot(g.craft.model.x-g.ai[0].model.x,g.craft.model.z-g.ai[0].model.z),playerKmh:g.craft.model.speed*3.6,aiKmh:g.ai[0].model.speed*3.6};});
 await shot('parallel-racing',[-5,3.4,-6,1,1,1]);
 assert.deepEqual(errors,[]);writeFileSync(`${out}/visual-results.json`,JSON.stringify({models,driving,parallel,errors,groupPortraits:'staged static formation; parallel fixture runs existing controllers for 0.35s'},null,2));console.log(JSON.stringify({models,driving,parallel,errors}));
}finally{await b.close();}
