import {loadPlaywright} from './qa-playwright.mjs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=loadPlaywright();const browser=await chromium.launch({channel:'msedge',headless:true});
const base=process.env.QA_URL??'https://huangyh0825-boop.github.io/velocity-water-city/';
const server='https://velocity-water-city-lobby-test.onrender.com/api/lobby';
const output=process.env.QA_OUTPUT??'work/render-game-lobby',local=process.env.QA_LOCAL_BUILD==='1';await mkdir(output,{recursive:true});
const errors=[],heavy=[],health=[],sockets=[];const result={url:base,localPreview:local,backend:server,checks:{}};
const code=String(1000+Math.floor(Math.random()*9000));
async function context(mobile=false){
 const c=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
 if(local)await c.route('https://huangyh0825-boop.github.io/velocity-water-city/**',async route=>{
  const path=decodeURIComponent(new URL(route.request().url()).pathname.slice('/velocity-water-city/'.length))||'index.html',root=resolve('dist'),file=resolve(root,path);
  if(!file.startsWith(root+sep)){await route.abort();return;}
  try{const bytes=await readFile(file),contentType=file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'image/svg+xml';await route.fulfill({status:200,contentType,body:bytes});}catch{await route.abort();}
 });
 return c;
}
async function open(c,name){const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/Game-[\w-]+\.js|\/models\//.test(r.url()))heavy.push(r.url());if(r.url().endsWith('/api/lobby/health'))health.push(r.url());});p.on('websocket',w=>sockets.push(w.url()));await p.goto(base,{waitUntil:'domcontentloaded'});await p.getByLabel('游戏 ID',{exact:true}).fill(name);await p.getByRole('button',{name:'保存 ID'}).click();return p;}
async function join(p,room=code){await p.locator('#room-code').fill(room);await p.locator('#join-room').click();await p.waitForFunction(code=>document.querySelector('#room-title')?.textContent===`房间 ${code}`&&document.querySelector('#room-connection')?.textContent.includes('已连接'),room,{timeout:190_000});}
try{
 const ca=await context(),cb=await context(),cm=await context(true);
 const a=await open(ca,'Render正式一号'),b=await open(cb,'Render正式二号'),m=await open(cm,'手机大厅验收');
 if(local){
  let attempts=0;await a.route(server+'/health',async route=>{
   if(++attempts===1)await route.fulfill({status:503,body:'waking',headers:{'Access-Control-Allow-Origin':new URL(base).origin}});
   else if(attempts===2)await route.fulfill({status:200,body:'<html>waking</html>',headers:{'Access-Control-Allow-Origin':new URL(base).origin}});
   else{await new Promise(r=>setTimeout(r,6500));await route.continue();}
  });
  await m.locator('#room-code').fill(code);let stalled;const received=new Promise(resolve=>stalled=resolve);
  await m.route(server+'/health',route=>{stalled(route);});await m.locator('#join-room').click();const request=await received;
  await m.locator('#cancel-room-connection').click();await request.abort();await m.unroute(server+'/health');
  await m.waitForFunction(()=>document.querySelector('#lobby-message').textContent==='已取消连接');assert.equal(await m.locator('#join-room').isDisabled(),false);assert.equal(await m.locator('#room-panel').isVisible(),false);result.checks.cancelStalledWake=true;
 }
 const started=performance.now();await join(a);result.firstJoinMs=Math.round(performance.now()-started);
 if(local){assert.ok(result.firstJoinMs>12_000);result.checks.wake503HtmlAndHealthBeyondSixSeconds=true;}
 await join(b);await a.waitForFunction(()=>document.querySelectorAll('#room-members li').length===2);await b.locator('#room-ready').click();await a.waitForFunction(()=>document.querySelector('#room-members').textContent.includes('已准备'));result.checks.sameRoomAndReady=true;
 await cb.setOffline(true);await b.waitForFunction(()=>/断开|中断/.test(document.querySelector('#room-connection').textContent));await cb.setOffline(false);await b.waitForFunction(()=>document.querySelector('#room-connection').textContent.includes('已连接'),undefined,{timeout:60000});result.checks.offlineReconnect=true;
 await join(m);await m.waitForFunction(()=>document.querySelectorAll('#room-members li').length===3);assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);result.checks.mobileAndSameRoom=true;
 await a.locator('#leave-room').click();await b.waitForFunction(()=>document.querySelectorAll('#room-members li').length===2&&document.querySelector('#room-members li').textContent.includes('房主'));result.checks.leaveAndHostMigration=true;
 await b.screenshot({path:output+'/desktop.png',fullPage:true});await m.screenshot({path:output+'/mobile.png',fullPage:true});
 await b.locator('#leave-room').click();await m.locator('#leave-room').click();
 assert.ok(health.length>=3&&health.every(h=>h===server+'/health'));assert.ok(sockets.length>=3&&sockets.every(s=>s.startsWith(server.replace('https:','wss:')+'/rooms/')));assert.deepEqual(heavy,[]);assert.deepEqual(errors,[]);
 Object.assign(result,{checks:{...result.checks,renderHttpAndWss:true,no3DAssetsLoaded:true},healthRequests:health.length,sockets:sockets.length,errors,mainlandTesting:'Use user device; this browser test does not identify VPN/region'});
 await writeFile(output+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(e){result.error=e.message;await writeFile(output+'/failure.json',JSON.stringify(result,null,2));throw e;}
finally{await browser.close();}
