import{createRequire}from'node:module';import{writeFileSync}from'node:fs';import assert from'node:assert/strict';
const{chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE??'playwright'),b=await chromium.launch({channel:'msedge',headless:true});
try{
 const p=await b.newPage({viewport:{width:2200,height:1600},deviceScaleFactor:1});await p.goto('http://127.0.0.1:5173/docs/track-repair-validation/index.html');await p.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
 const images=await p.evaluate(()=>[...document.images].map(i=>({src:i.getAttribute('src'),width:i.naturalWidth,height:i.naturalHeight})));assert.ok(images.length>=20);await p.locator('main').evaluate(el=>el.style.maxWidth='none');
 for(const name of ['final-map','profiles','merge-map']){const picture=p.locator(`img[src="${name}.svg"]`);await picture.evaluate(el=>{el.style.width=el.naturalWidth+'px';const figure=el.closest('figure');figure.style.gridColumn='1/-1';figure.style.width=el.naturalWidth+'px';});await picture.screenshot({path:`docs/track-repair-validation/${name}.png`});}
 writeFileSync('docs/track-repair-validation/gallery-check.json',JSON.stringify({images},null,2));console.log(JSON.stringify(images));
}finally{await b.close();}
