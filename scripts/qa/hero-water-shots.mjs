import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)((process.env.PLAYWRIGHT_MODULE??'playwright'));
const browser=await chromium.launch({channel:'msedge',headless:true});
const mode=process.argv[2]??'before',folder='.qa/hero-water';mkdirSync(folder,{recursive:true});
try {
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:5173/scripts/qa/hero-water.html');
 await page.waitForFunction(()=>window.testGame?.citySample.loaded&&[window.testGame.craft,...window.testGame.aiCraft].every(c=>c.assetLoaded),{timeout:120000});
 await page.evaluate(()=>{const g=window.testGame;g.paused=true;g.track.spawn(g.craft.model,.041*Math.PI*2);Object.assign(g.craft.model,{speed:0,yawRate:0});g.craft.sync(0);g.aiCraft.forEach(c=>c.object.visible=false);g.water.update(0);g.camera.camera.fov=38;g.camera.camera.updateProjectionMatrix();});
 await page.addStyleTag({content:'.topbar,.race-hud,.tools,.audio-controls,.countdown,.keyboard,.speedometer,footer,.touch,.trick-toast{visibility:hidden!important}'});
 const poses={'front-left':[-2.8,1.9,3.1,0,.64,.1],'rear-right':[2.9,1.7,-3.2,0,.64,-.20],'side':[-4.6,1.05,0,0,.65,0],'pump':[1.10,.68,-3.12,0,.20,-1.90],'cockpit':[-.7,1.9,-.16,0,.90,.58],'rider-front':[.65,1.9,2.0,0,1.4,.23],'rider-side':[-2.1,1.70,-.10,0,1.33,.16],'mounted':[-3.4,2.2,3.4,0,.97,0],'water-close':[-6,2.4,-8,1,0,12],'water-grazing':[-6,.9,-9,0,0,40]};
 for(const [name,v] of Object.entries(poses)) {
  await page.evaluate(({name,v})=>{const g=window.testGame,m=g.craft.model,h=m.heading,w=(x,y,z)=>[m.x+Math.cos(h)*x+Math.sin(h)*z,y,m.z-Math.sin(h)*x+Math.cos(h)*z];g.craft.rider.root.visible=name.startsWith('rider')||name==='mounted';g.camera.camera.position.set(...w(...v.slice(0,3)));g.camera.camera.lookAt(...w(...v.slice(3)));g.citySample.update(0,g.camera.camera);g.heroLighting?.update(g.renderer,g.scene,g.craft.visual);g.renderer.render(g.scene,g.camera.camera);},{name,v});
  await page.screenshot({path:`${folder}/${mode}-${name}.png`});
 }
 writeFileSync(`${folder}/${mode}-shots.json`,JSON.stringify({poses,errors},null,2));console.log(JSON.stringify({mode,errors}));
}finally{await browser.close();}

