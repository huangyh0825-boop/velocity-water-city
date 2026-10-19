import {loadPlaywright}from'./qa-playwright.mjs';import{readFileSync,writeFileSync}from'node:fs';import assert from'node:assert/strict';
const{chromium}=loadPlaywright(),browser=await chromium.launch({channel:'msedge',headless:true}),results=[];
try{for(const raw of [false,true]){
 const p=await browser.newPage({viewport:{width:1280,height:720}});
 if(raw)await p.route('**/*-packed.glb.gz',r=>r.fulfill({body:readFileSync('public/models/'+new URL(r.request().url()).pathname.split('/').at(-1)),contentType:'application/octet-stream'}));
 await p.goto('http://127.0.0.1:5183/',{waitUntil:'commit'});await p.locator('.boot-screen').waitFor({state:'detached',timeout:180000});
 const transports=await p.evaluate(()=>performance.getEntriesByType('measure').filter(m=>m.name==='model-transport').map(m=>m.detail));
 assert.deepEqual(transports.map(t=>t.transportBytes).sort((a,b)=>a-b),[17362994,32005716]);results.push({server:raw?'gzip file without Content-Encoding; Worker decompresses':'Vite Content-Encoding:gzip; fetch decompresses',transports});await p.close();
}writeFileSync('docs/startup-performance/transport-audit.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));}finally{await browser.close()}
