import {loadPlaywright}from'./qa-playwright.mjs';import{mkdirSync,writeFileSync}from'node:fs';import assert from'node:assert/strict';
const{chromium}=loadPlaywright(),browser=await chromium.launch({channel:'msedge',headless:true}),result={};const entry=process.env.QA_URL??'http://127.0.0.1:5183/';const label=process.env.QA_URL?'online':'production';mkdirSync('docs/fps-final',{recursive:true});
try{
 for(const mobile of [false,true]){
  const p=await browser.newPage({viewport:mobile?{width:844,height:390}:{width:1280,height:720},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile}),errors=[],failed=[];
  p.on('pageerror',e=>errors.push(String(e)));p.on('response',r=>{if(r.status()>=400)failed.push({url:r.url(),status:r.status()})});
  await p.goto(entry,{waitUntil:'commit'});await p.waitForFunction(()=>!!document.querySelector('#status')&&!document.querySelector('.boot-screen'),null,{timeout:180000});await p.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('下一检查点'),null,{timeout:20000});
  const quality=await p.locator('#quality').innerText();assert.equal(quality,mobile?'画质 · 低':'画质 · 标准');
  if(mobile){const box=await p.locator('[data-action=throttle]').boundingBox(),cdp=await p.context().newCDPSession(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});await p.waitForTimeout(1800);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  else{await p.keyboard.down('w');await p.waitForTimeout(1800);await p.keyboard.up('w');}
  const speed=Number(await p.locator('#speed').innerText());assert.ok(speed>20,`Acceleration: ${speed}`);
  await p.locator('#reset').click();await p.waitForFunction(()=>/^[123]$/.test(document.querySelector('#countdown strong')?.textContent??''));
  const layout=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,qaHooks:!!(window.testGame||window.verticalQA),canvas:!!document.querySelector('canvas')}));assert.equal(layout.overflow,false);assert.equal(layout.qaHooks,false);
  await p.screenshot({path:`docs/fps-final/${label}-${mobile?'touch':'desktop'}.png`});assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);result[mobile?'touch':'desktop']={quality,speed,reset:true,...layout,errors,failed};console.log(mobile?'touch':'desktop',JSON.stringify(result[mobile?'touch':'desktop']));await p.close();
 }
 const p=await browser.newPage();await p.route('**/watercraft-packed.glb.gz',r=>r.abort());await p.goto(entry,{waitUntil:'commit'});await p.locator('.boot-failed').waitFor({timeout:180000});result.failure={message:await p.locator('.boot-progress').innerText(),retry:await p.locator('.boot-screen button').isVisible()};assert.equal(result.failure.retry,true);await p.close();
 writeFileSync(`docs/fps-final/${label}.json`,JSON.stringify(result,null,2));
}finally{await browser.close()}
