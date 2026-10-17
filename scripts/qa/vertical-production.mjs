import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE??'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const folder='.qa/vertical-production',base=process.env.GAME_PREVIEW_URL??'http://127.0.0.1:5174/';mkdirSync(folder,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],assets=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(r.url().includes('/models/'))assets.push({url:r.url(),status:r.status()});});
 await page.goto(base);
 const manifest=JSON.parse(readFileSync('public/models/manifest.json','utf8'));
 const paths=['watercraft.glb','rider.glb',...manifest.pwcRebuild.textures.map(t=>t.uri),...manifest.riderRebuild.textures.map(t=>t.uri)].map(p=>new URL('models/'+p,base).href);
 await page.waitForFunction(paths=>{const loaded=new Set(performance.getEntriesByType('resource').map(e=>e.name));return paths.every(p=>loaded.has(p));},paths,{timeout:120000});
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.startsWith('下一检查点'));
 await page.waitForTimeout(1500);
 await page.keyboard.down('w');await page.waitForFunction(()=>Number(document.querySelector('#speed')?.textContent)>35);await page.keyboard.up('w');
 const speed=Number(await page.locator('#speed').innerText());
 await page.keyboard.down('a');await page.waitForTimeout(350);await page.keyboard.up('a');
 await page.keyboard.down('s');await page.waitForTimeout(1400);await page.keyboard.up('s');
 const brake=Number(await page.locator('#speed').innerText());assert.ok(brake<speed);
 await page.screenshot({path:folder+'/production-driving.png'});
 await page.locator('#reset').click();await page.waitForFunction(()=>document.querySelector('#countdown').textContent.length>0,null,{timeout:10000});
 assert.equal(await page.locator('#nitro-label').innerText(),'40%');
 assert.ok(paths.every(p=>assets.some(a=>a.url===p&&a.status===200)));assert.ok(assets.every(a=>a.status===200));
 assert.equal(await page.evaluate(()=>typeof window.testGame),'undefined');assert.deepEqual(errors,[]);
 const result={base,speed,brake,assets,errors,reset:true,testHookAbsent:true};writeFileSync(folder+'/production-results.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify({base,speed,brake,assetRequests:assets.length,errors,reset:true,testHookAbsent:true}));
}finally{await browser.close();}

