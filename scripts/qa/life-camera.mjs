import{loadPlaywright}from'./qa-playwright.mjs';
import{writeFileSync}from'node:fs';
import assert from'node:assert/strict';
const{chromium}=loadPlaywright(),browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5177/scripts/qa/vertical.html');
 await page.waitForFunction(()=>window.verticalQA,null,{timeout:120000});
 await page.evaluate(()=>window.verticalQA.ready());
 await page.evaluate(()=>{
  const g=window.testGame;window.verticalQA.fixture(.06,null,25,false);g.paused=true;
  window.pointerLockRequests=0;g.renderer.domElement.requestPointerLock=()=>{window.pointerLockRequests++;return Promise.reject(Error('unexpected pointer lock'));};
 });
 await page.waitForTimeout(1200);
 const snapshot=()=>page.evaluate(()=>({position:window.testGame.camera.camera.position.toArray(),direction:window.testGame.camera.camera.getWorldDirection(new window.qaTHREE.Vector3()).toArray(),locked:!!document.pointerLockElement,requests:window.pointerLockRequests,panel:!!document.querySelector('.camera-controls')}));
 const before=await snapshot();
 await page.mouse.click(800,500);await page.mouse.move(250,170,{steps:20});await page.mouse.wheel(0,480);
 await page.waitForTimeout(900);
 const after=await snapshot(),distance=Math.hypot(...after.position.map((v,i)=>v-before.position[i])),dot=after.direction.reduce((s,v,i)=>s+v*before.direction[i],0);
 assert.ok(distance<.015,`camera moved ${distance}m without craft motion`);
 assert.ok(dot>.99999,`camera direction changed (${dot})`);
 assert.equal(after.locked,false);assert.equal(after.requests,0);assert.equal(after.panel,false);assert.deepEqual(errors,[]);
 const result={before,after,cameraDisplacementMetres:distance,directionDot:dot,pointerLockRequests:after.requests,mouseControlsPanel:after.panel,pageErrors:errors};
 await page.screenshot({path:'docs/waterfront-life/camera-follow.png'});
 writeFileSync('docs/waterfront-life/camera-tests.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}finally{await browser.close();}
