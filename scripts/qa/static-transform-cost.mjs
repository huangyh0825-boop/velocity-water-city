import {preview} from 'vite';import {loadPlaywright} from './qa-playwright.mjs';import {writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const server=await preview({build:{outDir:'.qa/mobile-quality-after'},preview:{host:'127.0.0.1',port:5303,strictPort:true}}),{chromium}=loadPlaywright(),browser=await chromium.launch({channel:'msedge',headless:true});
try{const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});await page.goto('http://127.0.0.1:5303/scripts/qa/vertical.html');await page.waitForFunction(()=>window.verticalQA,undefined,{timeout:180000});await page.evaluate(()=>window.verticalQA.ready());
const result=await page.evaluate(()=>{
 const g=window.testGame,roots=[g.citySample.root,g.city.root,g.verticalView.root],objects=[];roots.forEach(r=>r.traverse(o=>objects.push(o)));const expected=objects.map(o=>o.matrixWorld.elements.slice()),results=[];
 for(const enabled of [false,true,true,false]){objects.forEach(o=>{o.matrixAutoUpdate=o.matrixWorldAutoUpdate=!enabled;});for(let i=0;i<100;i++)g.scene.updateMatrixWorld(true);const start=performance.now();for(let i=0;i<1000;i++)g.scene.updateMatrixWorld(true);results.push({cached:enabled,ms:performance.now()-start});}
 objects.forEach(o=>{o.matrixAutoUpdate=o.matrixWorldAutoUpdate=false;});g.scene.updateMatrixWorld(true);
 return {sceneryObjects:objects.length,results,exactMatrices:objects.every((o,i)=>o.matrixWorld.elements.every((v,j)=>v===expected[i][j])),method:'Isolated CPU cost of the actual loaded scene world-matrix update; 100 warmups +1000 updates, uncached/cached/cached/uncached in one page. Rendering is excluded; this is not an FPS measurement.'};
});assert.equal(result.exactMatrices,true);await writeFile('work/mobile-quality/static-transform-cost.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();await server.close();}
