import {preview} from 'vite';import {loadPlaywright} from './qa-playwright.mjs';import {writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const{chromium}=loadPlaywright(),browser=await chromium.launch({channel:'msedge',headless:true}),report=[];
try{for(const label of['before','after']){
 const web=await preview({build:{outDir:`.qa/resource-${label}`},preview:{host:'127.0.0.1',port:5335,strictPort:true}}),context=await browser.newContext({viewport:{width:1600,height:1000}});
 try{const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>performance.setResourceTimingBufferSize(4000));const start=Date.now();await p.goto('http://127.0.0.1:5335/scripts/qa/vertical.html');await p.waitForFunction(()=>window.verticalQA,null,{timeout:240000});await p.evaluate(()=>window.verticalQA.ready());
  const result=await p.evaluate(()=>{
   const items=performance.getEntriesByType('resource').filter(e=>e.name.startsWith(location.origin)).map(e=>({path:new URL(e.name).pathname,bytes:e.encodedBodySize,transfer:e.transferSize,cached:e.transferSize===0}));
   // Worker requests are outside the window ResourceTiming buffer. ModelTransport
   // measures their actual encoded input bytes in the existing performance mark.
   const workers=performance.getEntriesByName('model-transport').map(e=>({path:new URL(e.detail.url).pathname,bytes:e.detail.transportBytes})),workerModelBytes=workers.reduce((s,e)=>s+e.bytes,0),mainModelAndTextureBytes=items.filter(e=>e.path.includes('/models/')).reduce((s,e)=>s+e.bytes,0);
   return{items,workers,mainBodyBytes:items.reduce((s,e)=>s+e.bytes,0),mainModelAndTextureBytes,workerModelBytes,modelAndTextureBytes:mainModelAndTextureBytes+workerModelBytes};
  });report.push({label,loadMs:Date.now()-start,...result,errors});assert.deepEqual(errors,[]);console.log(label,report.at(-1).modelAndTextureBytes,'model/texture bytes including workers');
 }finally{await context.close();await web.close();}
}await writeFile('work/resource-quality/cold-network.json',JSON.stringify({method:'Fresh browser context per version; no IndexedDB/network reuse. Same local 1600x1000 view. Window encoded-body bytes plus worker model input bytes. Local load time is not an internet bandwidth promise.',completed:true,result:report},null,2));}finally{await browser.close();}
