import{createRequire}from'node:module';import{writeFileSync,mkdirSync}from'node:fs';import assert from'node:assert/strict';
const{chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE??'playwright'),browser=await chromium.launch({channel:'msedge',headless:true}),folder='docs/track-repair-validation';mkdirSync(folder,{recursive:true});
try{
 const p=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1}),errors=[];p.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});await p.goto('http://127.0.0.1:5177/scripts/qa/vertical.html');await p.waitForFunction(()=>window.verticalQA,null,{timeout:120000});await p.evaluate(()=>window.verticalQA.ready());console.log('Production assets ready');
 await p.evaluate(()=>{const g=window.testGame,original=g.track.constrain.bind(g.track);window.playerWallHits=0;g.track.constrain=m=>{const hit=original(m);if(hit&&m===g.craft.model)window.playerWallHits++;return hit;};});
 const s1=[];for(const speed of [120,140,160]){
  const frames=await p.evaluate(speed=>{const q=window.verticalQA,g=window.testGame,c=g.track.shortcuts[0];q.fixture(.62,c.id,speed/3.6);q.setSpeedCap(speed);window.playerWallHits=0;return Math.ceil((c.length*.38+85)/(speed/3.6)*60)+5;},speed);await p.evaluate(n=>window.verticalQA.advance(n,false),frames);
  const r=await p.evaluate(()=>{const g=window.testGame,c=g.track.shortcuts[0],m=g.craft.model;return{walls:window.playerWallHits,kmh:m.speed*3.6,route:m.route,mainAngle:g.track.project(m,null).angle,exitAngle:c.to};});assert.equal(r.walls,0);assert.equal(r.route,null);assert.ok(r.mainAngle>r.exitAngle);s1.push({approach:speed,...r});console.log('S1',speed,r);
 }
 const capture=async(name,offset,target,hud=false)=>{await p.evaluate(({offset,target,hud})=>window.verticalQA.view(offset,target,hud),{offset,target,hud});await p.screenshot({path:`${folder}/${name}.png`});};
 await p.evaluate(()=>{const c=window.testGame.track.shortcuts[0];window.verticalQA.fixture(c.entryPortal+.02,c.id,0);});await capture('s1-entry',[-18,9,-25],[0,3,16]);
 await p.evaluate(()=>window.verticalQA.fixture(.95,'tunnel-cut',0));await capture('s1-exit',[-24,13,-28],[0,2,22]);await capture('s1-merge-overhead',[0,110,8],[0,-5,10]);
 await p.evaluate(()=>window.verticalQA.fixture(.1484375,'harbor-cut',0));await capture('s2-cleared-slope',[-48,28,-28],[0,3,12]);await capture('s2-driving',[0,5.7,-13],[0,1,8],true);
 const photos=[['N1',.093,null,120,45],['N2',.196,null,160,50],['N3',.449,null,180,70],['C-drop',.812,null,180,70],['A-drop',.349,null,180,45],['B-crest',.726,null,180,55],['S2-cross',.442,'harbor-cut',180,70]];const jumps=[];
 for(const[name,q,route,speed,frames]of photos){await p.evaluate(({q,route,speed})=>{window.verticalQA.fixture(q,route,speed/3.6);window.verticalQA.setSpeedCap(speed);},{q,route,speed});await p.evaluate(n=>window.verticalQA.advance(n,false),frames);const r=await p.evaluate(()=>window.verticalQA.state());assert.ok(r.airborne&&r.legal,name+JSON.stringify(r));jumps.push({id:name,...r});await capture(name,[-17,7,-22],[0,-2,12]);console.log('Jump',name,r.height);}
 await p.evaluate(()=>window.verticalQA.advance(160,true));const landing=await p.evaluate(()=>window.verticalQA.state());assert.equal(landing.airborne,false);
 await p.evaluate(()=>window.verticalQA.fixture(.812,null,44,true));await p.evaluate(()=>window.verticalQA.advance(75,true));const ai=await p.evaluate(()=>window.testGame.ai.map(a=>({id:a.id,airborne:a.flight.airborne,height:a.flight.height,finite:Number.isFinite(a.model.x)&&Number.isFinite(a.flight.height)})));assert.ok(ai.every(a=>a.finite));assert.ok(ai.some(a=>a.airborne));await capture('ai-C-drop',[-23,12,-32],[0,-4,15]);
 await p.evaluate(()=>{window.verticalQA.fixture(.032);window.verticalQA.overhead();});await p.screenshot({path:folder+'/track-overhead.png'});
 await p.evaluate(()=>window.verticalQA.fixture(.80,null,0));await capture('C-side',[65,18,-55],[0,0,32]);
 const buildings=await p.evaluate(()=>window.testGame.city.root.userData.buildings);assert.ok(buildings.find(b=>b.zone===4&&b.j===0).moved>0);
 assert.deepEqual(errors,[]);writeFileSync(folder+'/browser-results.json',JSON.stringify({s1,jumps,landing,ai,buildings,errors},null,2));console.log('Browser fixtures passed');
}finally{await browser.close();}
