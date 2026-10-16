import {mkdirSync as ensureDirectory} from 'node:fs';
ensureDirectory('.qa/rider-ai',{recursive:true});
import {createRequire} from 'node:module';import {mkdirSync,writeFileSync} from 'node:fs';import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)((process.env.PLAYWRIGHT_MODULE??'playwright')),browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:5173/scripts/qa/hero-water.html');await page.waitForFunction(()=>window.testGame?.citySample.loaded&&[window.testGame.craft,...window.testGame.aiCraft].every(c=>c.assetLoaded),{timeout:120000});
 await page.evaluate(()=>{const g=window.testGame;g.restart();g.track.spawn(g.craft.model,.032*Math.PI*2);g.craftMotion.reset();g.camera.update(0,g.craft.model,true);});await page.waitForFunction(()=>window.testGame.race.phase==='racing');
 await page.keyboard.down('w');await page.waitForFunction(()=>window.testGame.craft.model.speed>40);
 const performance=await page.evaluate(async()=>{
  const g=window.testGame,startKmh=g.craft.model.speed*3.6;
  const times=await new Promise(resolve=>{const times=[];let last=0;const tick=t=>{if(last)times.push(t-last);last=t;if(times.length<120)requestAnimationFrame(tick);else resolve(times);};requestAnimationFrame(tick);});
  const gl=g.renderer.getContext(),info=gl.getExtension('WEBGL_debug_renderer_info');
  return{frames:times.length,meanMs:times.reduce((a,b)=>a+b,0)/times.length,p95Ms:times.toSorted((a,b)=>a-b)[Math.floor(times.length*.95)],startKmh,endKmh:g.craft.model.speed*3.6,gpu:info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):'unavailable',viewport:[innerWidth,innerHeight],pixelRatio:g.renderer.getPixelRatio()};
 });
 await page.keyboard.up('w');
 await page.evaluate(()=>window.testGame.paused=true);
 // Exercise the same graphics resources through complete low/high swaps and restart.
 const memory=[];
 for(const low of [true,false,true,false]){
  await page.locator('#quality').click();await page.waitForFunction(low=>{const g=window.testGame,d=g.citySample.density;return g.low===low&&[g.craft,...g.aiCraft].every(c=>c.asset.userData.visualAsset===(low?'watercraft-low':'watercraft'))&&d.loaded&&d.low===low&&d.interiors.root.visible===!low;},low,{timeout:120000});
  await page.evaluate(()=>new Promise(resolve=>{let count=0;function frame(){const g=window.testGame;g.citySample.update(g.time,g.camera.camera);g.water.update(g.time);if(!g.low){g.heroLighting.update(g.renderer,g.scene,g.craft.visual);g.aiCraft.forEach((c,i)=>g.aiLighting[i].update(g.renderer,g.scene,c.visual));}g.renderer.render(g.scene,g.camera.camera);if(++count<12)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);}));memory.push(await page.evaluate(()=>({...window.testGame.renderer.info.memory})));
 }
 await page.evaluate(()=>window.testGame.paused=false);
 await page.locator('#reset').click();
 await page.waitForFunction(()=>window.testGame.race.phase==='countdown'&&document.querySelector('#countdown').textContent.length>0);
 const reset=await page.evaluate(()=>{const g=window.testGame;return{energy:g.nitro.energy,wake:g.wake.pool.activeCount,spray:g.spray.pool.activeCount,airborne:g.flight.airborne,trick:g.tricks.completed,lap:g.race.player.lap,phase:g.race.phase};});
 assert.equal(reset.energy,40);assert.equal(reset.wake,0);assert.equal(reset.airborne,false);assert.equal(reset.trick,false);
 writeFileSync('.qa/rider-ai/runtime-results.json',JSON.stringify({performance,memory,reset,errors},null,2));
 const high=memory.filter((_,i)=>i%2===1);assert.deepEqual(high[0],high[1]);
 await page.evaluate(async()=>{window.testGame.dispose();const {Game}=await import('/src/core/Game.ts');window.testGame=new Game(document.querySelector('#app'));});
 await page.waitForFunction(()=>window.testGame.craft.assetLoaded&&window.testGame.citySample.loaded,{timeout:120000});await page.waitForTimeout(300);assert.deepEqual(errors,[]);
 const result={performance,memory,reset,recreatedGameWithoutShaderErrors:true,errors};writeFileSync('.qa/rider-ai/runtime-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
