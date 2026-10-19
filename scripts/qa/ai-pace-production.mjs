import{loadPlaywright}from'./qa-playwright.mjs';import{writeFileSync}from'node:fs';import assert from'node:assert/strict';
const{chromium}=loadPlaywright(),browser=await chromium.launch({channel:'msedge',headless:true});
try{const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(String(e)));
 await p.goto('http://127.0.0.1:5183/',{waitUntil:'commit'});await p.waitForSelector('.boot-screen',{state:'detached',timeout:180000});await p.waitForTimeout(3500);
 const build=await p.locator('script[type=module]').getAttribute('src'),privateQA=await p.evaluate(()=>!!window.testGame);
 await p.keyboard.down('w');await p.waitForTimeout(2500);await p.keyboard.up('w');const accelerated=Number(await p.locator('#speed').textContent());
 await p.keyboard.down('s');await p.waitForTimeout(1000);await p.keyboard.up('s');const braked=Number(await p.locator('#speed').textContent());
 assert.ok(accelerated>0&&braked<accelerated);assert.equal(privateQA,false);assert.deepEqual(errors,[]);
 const result={url:p.url(),build,privateQA,accelerated,braked,errors};writeFileSync('docs/ai-pace/production.json',JSON.stringify(result,null,2));console.log(result);
}finally{await browser.close()}
