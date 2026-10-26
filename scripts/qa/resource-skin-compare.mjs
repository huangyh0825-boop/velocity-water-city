import {preview} from 'vite';import {loadPlaywright} from './qa-playwright.mjs';import {mkdir,writeFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
const out='work/resource-quality/round2/skin-compare';await mkdir(out,{recursive:true});const{chromium}=loadPlaywright(),browser=await chromium.launch({channel:'msedge',headless:true}),report={errors:[],poses:[]};
try{for(const label of['round1','round2']){const web=await preview({build:{outDir:label==='round2'?(process.env.QA_BUILD_DIR??'.qa/resource-round2'):'.qa/resource-round1'},preview:{host:'127.0.0.1',port:5336,strictPort:true}}),context=await browser.newContext({viewport:{width:1600,height:1000}});
 try{const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.addInitScript(()=>{let seed=8128461;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);});await p.goto('http://127.0.0.1:5336/scripts/qa/vertical.html');await p.waitForFunction(()=>window.verticalQA,null,{timeout:240000});await p.evaluate(()=>window.verticalQA.ready());
  for(const [id,speed,yaw,air,offset]of[['idle',0,0,0,[1.35,2.25,2.1]],['fast',50,0,0,[-3.5,1.7,.1]],['left',40,.8,0,[1.35,2.25,2.1]],['right',40,-.8,0,[-2.8,2.1,-2.5]],['air',45,.3,4,[1.35,2.25,2.1]]]){
   const state=await p.evaluate(({speed,yaw,air,offset})=>{const g=window.testGame,q=window.verticalQA;q.fixture(.06,null,0,false);g.craft.model.speed=speed;g.craft.model.yawRate=yaw;g.craft.sync(12,g.craft.model,air,{pitch:0,yaw:0},0,0);g.time=12;q.view(offset,[0,1.4,0],false);g.camera.camera.fov=42;g.camera.camera.updateProjectionMatrix();g.renderer.render(g.scene,g.camera.camera);const bones=[];g.craft.rider.root.traverse(o=>{if(o.isBone)bones.push({name:o.name,matrix:o.matrixWorld.toArray()});});return bones;},{speed,yaw,air,offset});await p.screenshot({path:`${out}/${label}-${id}.png`});report.poses.push({label,id,bones:state});
  }
 }finally{await context.close();await web.close();}}
 const compare=`from PIL import Image,ImageChops,ImageStat
import json
from pathlib import Path
root=Path('work/resource-quality/round2/skin-compare')
rows=[]
for pose in ['idle','fast','left','right','air']:
 a=Image.open(root/('round1-'+pose+'.png')).convert('RGB');b=Image.open(root/('round2-'+pose+'.png')).convert('RGB');d=ImageChops.difference(a,b);means=ImageStat.Stat(d).mean;hist=d.histogram();large=sum(hist[c*256+i] for c in range(3) for i in range(16,256))/(a.width*a.height*3)
 rows.append(dict(pose=pose,meanAbsoluteChannelError=sum(means)/3,channelFractionDifferenceOver15=large,maxDifference=max(x[1] for x in d.getextrema())))
print(json.dumps(rows))`;
 report.pixelComparison=JSON.parse(execFileSync('C:/Users/17033/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',['-c',compare],{encoding:'utf8'}));
 for(const r of report.pixelComparison){assert.ok(r.meanAbsoluteChannelError<.25,JSON.stringify(r));assert.ok(r.channelFractionDifferenceOver15<.0005,JSON.stringify(r));}for(const before of report.poses.filter(p=>p.label==='round1'))assert.deepEqual(report.poses.find(p=>p.label==='round2'&&p.id===before.id).bones,before.bones);assert.deepEqual(report.errors,[]);report.completed=true;console.log(JSON.stringify(report.pixelComparison));await writeFile(out+'/result.json',JSON.stringify(report,null,2));
}catch(e){await writeFile(out+'/failure.json',JSON.stringify({...report,error:String(e.stack)},null,2));throw e;}finally{await browser.close();}
