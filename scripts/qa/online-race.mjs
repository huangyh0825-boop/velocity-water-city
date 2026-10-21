import {loadPlaywright} from './qa-playwright.mjs';
import {createLobbyServer} from '../../dist-lobby/lobby.mjs';
import {preview} from 'vite';
import {once} from 'node:events';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import assert from 'node:assert/strict';
const output=process.env.QA_OUTPUT??'work/online-race-browser';await mkdir(output,{recursive:true});
const remote=process.env.QA_URL,base=remote??'http://127.0.0.1:5291/';
let server,web,browser;const report={url:base,localBuild:process.env.QA_LOCAL_BUILD==='1',checks:{},errors:[]},events=[[],[]],sent=[[],[]];
try{
 if(!remote){server=createLobbyServer({allowedOrigins:['http://127.0.0.1:5291']});server.listen(0,'127.0.0.1');await once(server,'listening');web=await preview({preview:{host:'127.0.0.1',port:5291,strictPort:true,proxy:{'/api/lobby':{target:`http://127.0.0.1:${server.address().port}`,ws:true}}}});}
 const {chromium}=loadPlaywright();browser=await chromium.launch({channel:'msedge',headless:true});
 const contexts=await Promise.all([0,1].map(()=>browser.newContext({viewport:{width:1280,height:720}})));
 if(process.env.QA_LOCAL_BUILD==='1')for(const context of contexts)await context.route('https://huangyh0825-boop.github.io/velocity-water-city/**',async route=>{
  const root=resolve('dist'),path=decodeURIComponent(new URL(route.request().url()).pathname.slice('/velocity-water-city/'.length))||'index.html',file=resolve(root,path);
  if(!file.startsWith(root+sep)){await route.abort();return;}
  try{await route.fulfill({status:200,contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream',body:await readFile(file)});}catch{await route.abort();}
 });
 const pages=await Promise.all(contexts.map(c=>c.newPage()));
 let release,blocked=false;const hold=new Promise(r=>release=r);
 if(!remote)await pages[1].route('**/assets/Game-*.js',async route=>{blocked=true;await hold;await route.continue();});
 for(const [i,p]of pages.entries()){
  p.on('pageerror',e=>report.errors.push(e.message));
  p.on('websocket',w=>{
   w.on('framereceived',e=>{try{const d=JSON.parse(e.payload);if(['room','race.frame','error'].includes(d.type))events[i].push({at:Date.now(),...d});}catch{}});
   w.on('framesent',e=>{try{const d=JSON.parse(e.payload);if(d.type?.startsWith('race.'))sent[i].push({at:Date.now(),...d});}catch{}});
  });
  await p.goto(base,{waitUntil:'domcontentloaded'});await p.getByLabel('游戏 ID',{exact:true}).fill('联机验收'+(i+1));await p.getByRole('button',{name:'保存 ID'}).click();
 }
 const code=String(1000+Math.floor(Math.random()*9000));
 for(const p of pages){await p.locator('#room-code').fill(code);await p.locator('#join-room').click();await p.waitForFunction(()=>document.querySelector('#room-connection')?.textContent.includes('已连接'),undefined,{timeout:190000});}
 await pages[0].waitForFunction(()=>document.querySelectorAll('#room-members li').length===2);
 assert.equal(await pages[0].locator('#start-online-race').isDisabled(),true);assert.equal(await pages[1].locator('#start-online-race').isVisible(),false);
 for(const p of pages)await p.locator('#room-ready').click();await pages[0].waitForFunction(()=>!document.querySelector('#start-online-race').disabled);
 report.checks.hostAndAllReady=true;await pages[0].locator('#start-online-race').click();console.log('Host started; loading full 3D game');
 if(!remote){
  await pages[0].waitForFunction(()=>!!document.querySelector('.game-canvas')&&!document.querySelector('.boot-screen'),undefined,{timeout:240000});
  assert.equal(blocked,true);assert.equal(sent[1].some(e=>e.type==='race.loaded'),false);assert.equal(events[0].some(e=>e.room?.race?.phase==='countdown'),false);
  await new Promise(r=>setTimeout(r,5500));assert.equal(await pages[0].locator('#countdown strong').textContent(),'等待');report.checks.slowPlayerHoldsStart=true;
  console.log('First player ready, delayed player still loading; countdown correctly held');release();
 }
 for(const p of pages)await p.waitForFunction(()=>!!document.querySelector('.game-canvas')&&!document.querySelector('.boot-screen'),undefined,{timeout:240000});
 for(const p of pages)await p.waitForFunction(()=>document.querySelector('#countdown strong')?.textContent==='5',undefined,{timeout:30000});
 const starts=events.map(list=>list.find(e=>e.room?.race?.phase==='countdown')?.room.race);
 assert.ok(starts[0]&&starts[1]);assert.equal(starts[0].startAt,starts[1].startAt);assert.equal(starts[0].startAt-starts[0].countdownAt,5000);
 assert.ok(starts[0].participants.every(p=>p.loaded));report.checks.allAssetsLoadedAndSharedFiveSecondCountdown=true;
 for(const p of pages)await p.waitForFunction(()=>/00:0[1-9]/.test(document.querySelector('#race-time')?.textContent),undefined,{timeout:30000});
 await pages[0].keyboard.down('w');await new Promise(r=>setTimeout(r,3500));await pages[0].keyboard.up('w');
 for(const p of pages)await p.screenshot({path:`${output}/player-${pages.indexOf(p)+1}.png`});
 const states=sent[0].filter(e=>e.type==='race.state');assert.ok(states.length>10);const first=states[0].state,last=states.at(-1).state;assert.ok(Math.hypot(last.x-first.x,last.z-first.z)>1);
 const roster=starts[0].participants,id=roster[0].id;assert.ok(events[1].filter(e=>e.type==='race.frame').some(e=>e.frame.states.some(s=>s.id===id&&Math.hypot(s.x-first.x,s.z-first.z)>1)));
 report.checks.realDrivingAndOpponentBroadcast=true;console.log('Both players driving; testing offline recovery');
 await contexts[1].setOffline(true);await new Promise(r=>setTimeout(r,1500));await contexts[1].setOffline(false);
 await pages[1].waitForFunction(()=>!document.querySelector('#countdown')?.textContent.includes('等待'),undefined,{timeout:30000});
 await new Promise(r=>setTimeout(r,7000));assert.ok(sent[1].some(e=>e.type==='race.state'&&e.state.correction>0));report.checks.offlineReconnectRestoresAuthoritativePose=true;
 // Network cadence is bounded independently from the render loop and the lobby command budget.
 const deadline=Date.now()+60000;while(Date.now()<deadline){await new Promise(r=>setTimeout(r,5000));}
 for(const [i,list]of sent.entries()){const packets=list.filter(e=>e.type==='race.state');report['player'+(i+1)+'Packets']=packets.length;const peak=new Map();for(const p of packets){const key=Math.floor(p.at/1000);peak.set(key,(peak.get(key)||0)+1);}assert.ok(Math.max(...peak.values())<=16);}
 assert.deepEqual(events.flat().filter(e=>e.type==='error'),[]);assert.deepEqual(report.errors,[]);report.checks.oneMinuteNoRateLimitDisconnect=true;
 for(const p of pages){assert.equal(await p.locator('#reset').isVisible(),false);await p.locator('#home').click();await p.waitForSelector('#room-form');}
 report.checks.exitToHome=true;console.log(JSON.stringify(report,null,2));await writeFile(output+'/result.json',JSON.stringify(report,null,2));
}catch(error){report.error=String(error.stack);await writeFile(output+'/failure.json',JSON.stringify(report,null,2));throw error;}
finally{await browser?.close();await web?.close();if(server)await new Promise(r=>server.close(r));}
