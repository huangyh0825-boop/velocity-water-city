import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE??'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const folder='.qa/performance/gameplay';mkdirSync(folder,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto((process.env.PERF_URL??'http://127.0.0.1:5176')+'/scripts/qa/performance.html');
 await page.waitForFunction(()=>window.perfQA,null,{timeout:120000});await page.evaluate(()=>window.perfQA.ready());
 // Real requestAnimationFrame loop and real keyboard input, not the fixed replay.
 await page.evaluate(()=>{const g=window.testGame;g.restart();g.track.spawn(g.craft.model,.032*Math.PI*2);g.craftMotion.reset();g.camera.update(0,g.craft.model,true);g.paused=false;g.previous=0;g.frameId=requestAnimationFrame(g.frame);});
 await page.waitForFunction(()=>window.testGame.race.phase==='racing');
 await page.keyboard.down('w');await page.waitForFunction(()=>window.testGame.craft.model.speed*3.6>174,null,{timeout:30000});
 const heading=await page.evaluate(()=>window.testGame.craft.model.heading);
 await page.keyboard.down('d');await page.waitForTimeout(280);await page.keyboard.up('d');
 const changedHeading=await page.evaluate(()=>window.testGame.craft.model.heading);assert.ok(Math.abs(changedHeading-heading)>.01);
 await page.waitForFunction(()=>window.testGame.craft.model.speed*3.6>174,null,{timeout:10000});
 await page.keyboard.down('Shift');await page.waitForFunction(()=>window.testGame.nitro.active&&window.testGame.craft.model.speed*3.6>200,null,{timeout:10000});
 const boost=await page.evaluate(()=>({speed:window.testGame.craft.model.speed*3.6,energy:window.testGame.nitro.energy}));
 await page.screenshot({path:folder+'/boost.png'});await page.keyboard.up('Shift');await page.keyboard.up('w');
 await page.evaluate(()=>{const g=window.testGame,r=g.ramps.data[0];Object.assign(g.craft.model,{x:r.lip.x-Math.sin(r.heading)*18,z:r.lip.z-Math.cos(r.heading)*18,heading:r.heading,speed:48,vx:Math.sin(r.heading)*48,vz:Math.cos(r.heading)*48,yawRate:0});g.flight.reset();g.tricks.reset();g.craftMotion.reset();g.nitro.energy=20;g.camera.update(0,g.craft.model,true);});
 await page.keyboard.down('w');await page.waitForFunction(()=>window.testGame.flight.airborne,null,{timeout:8000});
 await page.keyboard.press('Space');await page.screenshot({path:folder+'/airborne.png'});
 await page.waitForFunction(()=>!window.testGame.flight.airborne&&window.testGame.tricks.feedbackTime>0,null,{timeout:10000});
 const jump=await page.evaluate(()=>({completed:window.testGame.tricks.completed,message:window.testGame.tricks.message,energy:window.testGame.nitro.energy}));
 assert.equal(jump.completed,true);assert.equal(jump.energy,55);await page.keyboard.up('w');
 await page.keyboard.down('s');await page.waitForTimeout(1800);await page.keyboard.up('s');
 const brake=await page.evaluate(()=>window.testGame.craft.model.speed*3.6);assert.ok(brake<100);
 const models=await page.evaluate(()=>[window.testGame.craft,...window.testGame.aiCraft].map(c=>{let triangles=0;const skeletons=new Set();c.visual.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;if(o.isSkinnedMesh)skeletons.add(o.skeleton);}});return{loaded:c.assetLoaded,error:c.assetError,triangles,skeletons:skeletons.size};}));
 assert.ok(models.every(m=>m.loaded&&!m.error&&m.skeletons===1));assert.ok(models.every(m=>m.triangles===models[0].triangles));
 const audio=await page.evaluate(()=>({state:window.testGame.audio.context?.state,loops:window.testGame.audio.loopCount,voices:window.testGame.audio.activeVoices}));assert.equal(audio.state,'running');
 await page.evaluate(()=>window.testGame.paused=true);
 const memory=[];
 for(const low of [true,false,true,false]){
  await page.locator('#quality').click();await page.waitForFunction(low=>{const g=window.testGame;return g.low===low&&[g.craft,...g.aiCraft].every(c=>c.asset.userData.visualAsset===(low?'watercraft-low':'watercraft'))&&g.citySample.density.loaded&&g.citySample.density.low===low;},low,{timeout:120000});
  await page.evaluate(()=>{const g=window.testGame;g.citySample.update(g.time,g.camera.camera);g.water.update(g.time);if(!g.low){g.heroLighting.update(g.renderer,g.scene,g.craft.visual);g.aiCraft.forEach((c,i)=>g.aiLighting[i].update(g.renderer,g.scene,c.visual));}g.renderer.render(g.scene,g.camera.camera);});
  memory.push(await page.evaluate(()=>({...window.testGame.renderer.info.memory})));
 }
 assert.deepEqual(memory[1],memory[3]);
 await page.evaluate(()=>window.testGame.paused=false);await page.locator('#reset').click();
 await page.waitForFunction(()=>window.testGame.race.phase==='countdown');
 const reset=await page.evaluate(()=>{const g=window.testGame;return{energy:g.nitro.energy,wake:g.wake.pool.activeCount,spray:g.spray.pool.activeCount,airborne:g.flight.airborne,lap:g.race.player.lap};});
 assert.equal(reset.energy,40);assert.equal(reset.wake,0);assert.equal(reset.spray,0);assert.equal(reset.airborne,false);
 await page.screenshot({path:folder+'/restart.png'});
 await page.evaluate(()=>{const g=window.testGame,Game=g.constructor;g.dispose();window.testGame=new Game(document.querySelector('#app'));});
 await page.waitForFunction(()=>window.testGame.citySample.loaded&&[window.testGame.craft,...window.testGame.aiCraft].every(c=>c.assetLoaded),null,{timeout:120000});
 await page.waitForTimeout(500);assert.deepEqual(errors,[]);
 const result={boost,jump,headingDelta:changedHeading-heading,brake,models,audio,memory,reset,recreated:true,errors,mode:'real RAF + keyboard; fixture relocation only for ramp test'};
 writeFileSync(folder+'/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
