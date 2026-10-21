import {loadPlaywright} from './qa-playwright.mjs';
import {createLobbyServer} from '../../server/lobby.ts';
import {RoomRace} from '../../server/RoomRace.ts';
import {CityTrack} from '../../src/track/CityTrack.ts';
import {build,preview} from 'vite';
import {createServer,request} from 'node:http';
import {WebSocket,WebSocketServer} from 'ws';
import {once} from 'node:events';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const output=process.env.QA_OUTPUT??'work/contact-browser';await mkdir(output,{recursive:true});
process.env.VITE_LOBBY_URL='/api/lobby';
await build({base:'/',build:{outDir:'.qa/contact-build',rollupOptions:{input:'scripts/qa/online-contact-view.html'}}});
const loaded=RoomRace.prototype.loaded;
RoomRace.prototype.loaded=function(id,now){loaded.call(this,id,now);if(this.view.phase!=='countdown'||this.contactRig)return;this.contactRig=true;
 const track=new CityTrack();for(const [i,p]of [...this.players.values()].entries()){track.spawn(p.model,-.014-i*.008,0);if(process.env.QA_SHORTCUT==='1'){const cut=track.shortcuts[1],a=cut.from+(cut.to-cut.from)*7/128,h=track.routeHeading(a,cut.id),point=track.routePoint(a,-5.7+i*.6,cut.id);Object.assign(p.model,point,{route:null,heading:h});p.model.x-=Math.sin(h)*i*3.2;p.model.z-=Math.cos(h)*i*3.2;}p.pose={...p.pose,...p.model};p.correction++;p.correctionKind='reset';this.rules.syncPosition(this.view.participants[i].id,p.model);}
};
const server=createLobbyServer({allowedOrigins:['http://127.0.0.1:5292']});server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;
// The proxy adds 100 ms each way without changing game or room-server code.
const relay=createServer((req,res)=>{const upstream=request({host:'127.0.0.1',port,path:req.url,method:req.method,headers:{...req.headers,host:`127.0.0.1:${port}`}},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});upstream.on('error',()=>{res.writeHead(502);res.end();});req.pipe(upstream);});
const wss=new WebSocketServer({noServer:true});const sockets=new Set();relay.on('upgrade',(req,socket,head)=>{
 const upstream=new WebSocket(`ws://127.0.0.1:${port}${req.url}`,{origin:'http://127.0.0.1:5292'});sockets.add(upstream);upstream.on('error',()=>socket.destroy());
 upstream.once('open',()=>wss.handleUpgrade(req,socket,head,down=>{sockets.add(down);const forward=(to,data,binary)=>setTimeout(()=>{if(to.readyState===WebSocket.OPEN)to.send(data,{binary});},100);
  upstream.on('message',(d,b)=>forward(down,d,b));down.on('message',(d,b)=>forward(upstream,d,b));down.on('error',()=>{});down.on('close',()=>upstream.close());upstream.on('close',()=>down.close());
 }));
});relay.listen(0,'127.0.0.1');await once(relay,'listening');
 let web,browser;const pages=[];const result={delayMsEachWay:100,shortcut:process.env.QA_SHORTCUT==='1',checks:{},errors:[]};
try{
 web=await preview({build:{outDir:'.qa/contact-build'},preview:{host:'127.0.0.1',port:5292,strictPort:true,proxy:{'/api/lobby':{target:`http://127.0.0.1:${relay.address().port}`,ws:true}}}});
 const {chromium}=loadPlaywright();browser=await chromium.launch({channel:'msedge',headless:true});
 for(let i=0;i<2;i++){const c=await browser.newContext({viewport:{width:1280,height:720}}),p=await c.newPage();p.on('pageerror',e=>result.errors.push(e.message));pages.push(p);await p.goto('http://127.0.0.1:5292/scripts/qa/online-contact-view.html');await p.getByLabel('游戏 ID',{exact:true}).fill('碰撞测试'+i);await p.getByRole('button',{name:'保存 ID'}).click();await p.locator('.tutorial-done').click();}
 const code=String(1000+Math.floor(Math.random()*9000));for(const p of pages){await p.locator('#room-code').fill(code);await p.locator('#join-room').click();await p.waitForFunction(()=>!document.querySelector('#room-panel').hidden,undefined,{timeout:30000});}
 for(const p of pages)await p.locator('#room-ready').click();await pages[0].waitForFunction(()=>!document.querySelector('#start-online-race').disabled);await pages[0].locator('#start-online-race').click();console.log('Contact fixture: loading complete 3D game in two clients');
 for(const p of pages)await p.waitForFunction(()=>window.contactQA?.ready(),undefined,{timeout:240000});for(const p of pages)await p.waitForFunction(()=>/00:0[1-9]/.test(document.querySelector('#race-time')?.textContent),undefined,{timeout:30000});
 const colors=await Promise.all(pages.map(p=>p.evaluate(()=>window.contactQA.colors())));assert.deepEqual([...colors[0]].sort((a,b)=>a.id.localeCompare(b.id)),[...colors[1]].sort((a,b)=>a.id.localeCompare(b.id)));assert.equal(colors[0][0].colors[0],'#126bba');assert.equal(colors[1][0].colors[0],'#f6cc61');result.colors=colors;result.checks.sameRealGLBPaintInBothViewpoints=true;
 for(const p of pages)await p.evaluate(()=>window.contactQA.watch());if(result.shortcut){for(const p of pages)await p.keyboard.down('w');await new Promise(r=>setTimeout(r,2000));for(const p of pages)await p.keyboard.up('w');}else{await pages[1].keyboard.down('w');await pages[1].waitForFunction(()=>window.contactQA.summary().contactSteps>=5,undefined,{timeout:60000});await new Promise(r=>setTimeout(r,4000));await pages[1].keyboard.up('w');}
 result.views=await Promise.all(pages.map(p=>p.evaluate(()=>window.contactQA.summary())));assert.ok(result.views[1].maxPhysicalStep<1,JSON.stringify(result.views));assert.equal(result.views[1].quality,'standard');assert.deepEqual(result.errors,[]);if(result.shortcut){for(const view of result.views){const branch=view.waterways.find(p=>p.route==='harbor-cut'),main=view.waterways.find(p=>p.route===null);assert.ok(branch.distance<=branch.width+.1,JSON.stringify(view));assert.ok(main.distance>main.width,JSON.stringify(view));}result.checks.bankScrapeStaysInChosenShortcut=true;}else result.checks.sustainedRealContactWithoutPullback=true;
 for(let i=0;i<2;i++)await pages[i].screenshot({path:`${output}/player-${i}.png`});
 for(const p of pages)await p.locator('#home').click();await writeFile(output+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(e){result.error=String(e.stack);result.views=await Promise.all(pages.map(p=>p.evaluate(()=>window.contactQA?.summary()).catch(()=>null)));for(let i=0;i<pages.length;i++)await pages[i].screenshot({path:`${output}/failure-${i}.png`}).catch(()=>{});await writeFile(output+'/failure.json',JSON.stringify(result,null,2));throw e;}
finally{await browser?.close();await web?.close();for(const socket of sockets)socket.terminate();wss.close();await new Promise(r=>relay.close(r));await new Promise(r=>server.close(r));RoomRace.prototype.loaded=loaded;}
