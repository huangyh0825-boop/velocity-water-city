import{loadPlaywright}from'./qa-playwright.mjs';import{writeFileSync}from'node:fs';import assert from'node:assert/strict';
const{chromium}=loadPlaywright(),b=await chromium.launch({channel:'msedge',headless:true}),rows=[];
try{const p=await b.newPage();p.setDefaultTimeout(180000);await p.goto('http://127.0.0.1:5177/scripts/qa/vertical.html');await p.waitForFunction(()=>window.verticalQA);await p.evaluate(()=>window.verticalQA.ready());
 for(const[w,h]of[[1920,1080],[1366,768],[1600,900],[1280,720]]){
  await p.setViewportSize({width:w,height:h});await p.evaluate(()=>{const Q=window.verticalQA,g=window.testGame;Q.fixture(.06,null,25);g.hud.update(g.craft.model,g.race,false,g.nitro,g.flight,g.tricks);g.paused=true;Q.view([0,5.7,-13],[0,1,15],true)});
  for(const expanded of[false,true]){
   if(expanded)await p.locator('.camera-settings').click();const row=await p.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}},panel=rect('.camera-controls'),keys=rect('.keyboard'),speed=rect('.speedometer'),options=rect('#camera-options'),box=document.querySelector('#camera-options'),open=!box.hidden,g=window.testGame,T=window.qaTHREE,v=new T.Vector3(g.craft.model.x,g.flight.height+1,g.craft.model.z).project(g.camera.camera);return{panel,keys,speed,options,open,boat:{x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2},width:innerWidth,height:innerHeight}});
   const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y,inside=a=>a.x>=0&&a.y>=0&&a.x+a.w<=w&&a.y+a.h<=h;
   assert.ok(inside(row.panel)&&row.panel.x<w*.1&&row.panel.y>h*.6);assert.ok(!overlap(row.panel,row.keys)&&!overlap(row.panel,row.speed));assert.ok(!overlap(row.panel,{x:row.boat.x-70,y:row.boat.y-70,w:140,h:140}));if(expanded){assert.ok(inside(row.options));await p.locator('[aria-label="鼠标视角灵敏度"]').fill('135');await p.locator('[aria-label="鼠标视角灵敏度"]').dispatchEvent('input');assert.equal(await p.evaluate(()=>window.testGame.cameraControls.sensitivity),1.35);await p.locator('[aria-label="启用鼠标自由视角"]').uncheck();await p.locator('[aria-label="启用鼠标自由视角"]').check();}
   rows.push({w,h,expanded,...row});await p.screenshot({path:`docs/city-quality-repair/ui-${w}-${h}${expanded?'-expanded':''}.png`});if(expanded)await p.locator('.camera-settings').click();
  }
 }writeFileSync('docs/city-quality-repair/ui-layout.json',JSON.stringify(rows,null,2));console.log('8 layouts passed, settings functional');
}finally{await b.close()}
