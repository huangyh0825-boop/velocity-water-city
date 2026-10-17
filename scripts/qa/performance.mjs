import '/src/style.css';import '/src/ui/race.css';import '/src/ui/phase3.css';
import * as THREE from 'three';import {Game} from '/src/core/Game.ts';

const game=new Game(document.querySelector('#app'));game.paused=true;cancelAnimationFrame(game.frameId);
window.testGame=game;
const ready=async()=>{while(!game.citySample.loaded||![game.craft,...game.aiCraft].every(c=>c.assetLoaded))await new Promise(r=>setTimeout(r,30));};
let tick=0,cameraPose;
const world=(m,x,y,z)=>new THREE.Vector3(m.x+Math.cos(m.heading)*x+Math.sin(m.heading)*z,y,m.z-Math.sin(m.heading)*x+Math.cos(m.heading)*z);
function setup(name){
 let seed=982451653;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const g=game;g.restart();cancelAnimationFrame(g.frameId);g.paused=false;g.time=0;g.previous=0;g.accumulator=0;g.race.phase='racing';g.race.elapsed=0;tick=0;cameraPose=undefined;
 g.camera.camera.fov=58;g.camera.camera.updateProjectionMatrix();
 const d=g.citySample.density;d.previous.fill(-1);d.lastTime=-Infinity;d.lastCamera.set(Infinity,Infinity,Infinity);d.interiors.lastCamera.set(Infinity,Infinity,Infinity);g.citySample.interiorRevision=-1;
 g.track.spawn(g.craft.model,.041*Math.PI*2);
 const m=g.craft.model;let speed=name==='normal'?100/3.6:178/3.6;
 if(['idle','district'].includes(name))speed=0;
 Object.assign(m,{speed,vx:Math.sin(m.heading)*speed,vz:Math.cos(m.heading)*speed,yawRate:0});
 for(const[i,ai]of g.ai.entries()){
  g.track.spawn(ai.model,.041*Math.PI*2-160/g.track.radius);
  ai.flight.reset();ai.tricks.reset();ai.nitro.reset();
  if(name==='five'||name==='collision'){
   const offset=[[-4,3],[4,3],[-5,11],[5,11]][i];const p=world(m,offset[0],0,offset[1]);
   Object.assign(ai.model,{x:p.x,z:p.z,heading:m.heading,speed:42,vx:Math.sin(m.heading)*42,vz:Math.cos(m.heading)*42,yawRate:0});
  }
  g.aiMotion[i].reset();
 }
 if(name==='collision'){
  const ai=g.ai[0],p=world(m,.7,0,.6);Object.assign(ai.model,{x:p.x,z:p.z,speed:20,vx:Math.sin(m.heading)*20,vz:Math.cos(m.heading)*20});g.aiMotion[0].reset();
 }
 if(name==='jump'){
  const r=g.ramps.data[0];Object.assign(m,{x:r.lip.x-Math.sin(r.heading)*18,z:r.lip.z-Math.cos(r.heading)*18,heading:r.heading,speed:48,vx:Math.sin(r.heading)*48,vz:Math.cos(r.heading)*48});
 }
 if(name==='idle'||name==='district'){g.race.phase='countdown';g.race.countdown=10000;}
 if(name==='district')cameraPose={offset:[-45,28,-55],target:[0,16,20]};
 g.craftMotion.reset();g.camera.update(0,m,true);
 const input={throttle:['idle','district'].includes(name)?0:name==='normal'?.4:1,brake:0,steer:0};
 Object.defineProperty(g.input,'state',{configurable:true,get:()=>input});Object.defineProperty(g.input,'boost',{configurable:true,get:()=>name==='boost'});g.nitro.energy=100;
 for(const c of [g.craft,...g.aiCraft]){c.rider.previousTime=0;c.rider.previousSpeed=c.model.speed;c.rider.lean=.15;c.rider.bank=0;c.rider.elapsed=false;c.visualTime=0;c.landingCompression=0;}
 g.craft.sync(0);g.aiCraft.forEach((c,i)=>c.sync(0,g.ai[i].model));
 // Freeze only the QA camera for the district fixture; game camera itself is unchanged.
 if(cameraPose){const real=g.camera.update.bind(g.camera);g.camera.update=(...args)=>{real(...args);g.camera.camera.position.copy(world(m,...cameraPose.offset));g.camera.camera.lookAt(world(m,...cameraPose.target));};g.camera._qaOriginal=real;}
}
function restoreCamera(){if(game.camera._qaOriginal){game.camera.update=game.camera._qaOriginal;delete game.camera._qaOriginal;}}
function step(){
 const g=game;tick++;
 if(g.flight.airborne&&!g.tricks.active&&!g.tricks.completed)g.tricks.request(g.flight);
 g.frame(tick*1000/60);cancelAnimationFrame(g.frameId);
}

/** Non-nesting timer queries: pause parent at recursive mirror-render boundaries. */
function instrument(){
 const g=game,r=g.renderer,gl=r.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
 const original=r.render.bind(r),frames=[],pending=[];let frame,stack=[],active,gpuEvery=0,serial=0;
 function begin(label){if(ext&&frame?.gpuMeasured){const query=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,query);active={query,label,frame};}}
 function end(){if(active){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(active);active=undefined;}}
 function poll(){if(!ext)return;const disjoint=gl.getParameter(ext.GPU_DISJOINT_EXT);for(let i=pending.length-1;i>=0;i--){const q=pending[i];if(gl.getQueryParameter(q.query,gl.QUERY_RESULT_AVAILABLE)){if(!disjoint){const ms=gl.getQueryParameter(q.query,gl.QUERY_RESULT)/1e6;q.frame.gpu[q.label]=(q.frame.gpu[q.label]??0)+ms;}else q.frame.disjoint=true;gl.deleteQuery(q.query);pending.splice(i,1);}}}
 r.info.autoReset=false;
 r.render=(scene,camera)=>{
  if(!frame)return original(scene,camera);
  const label=camera===g.camera.camera?'main':camera.layers.mask!==(1<<0)?'racerShadow':'reflection';
  if(active)end();stack.push(label);begin(label);const t=performance.now();
  try{return original(scene,camera);}finally{frame.cpu[label]=(frame.cpu[label]??0)+performance.now()-t;end();stack.pop();if(stack.length)begin(stack.at(-1));}
 };
 const before=g.water.mesh.onBeforeRender,after=g.water.mesh.onAfterRender;
 g.water.mesh.onBeforeRender=function(...args){before.apply(this,args);if(frame){end();stack.push('waterSurface');begin('waterSurface');}};
 g.water.mesh.onAfterRender=function(...args){after.apply(this,args);if(frame){end();stack.pop();if(stack.length)begin(stack.at(-1));}};
 const logic=[];const wrap=(owner,key,label)=>{const original=owner[key].bind(owner);owner[key]=(...args)=>{if(!frame)return original(...args);const t=performance.now();try{return original(...args);}finally{frame.cpu[label]=(frame.cpu[label]??0)+performance.now()-t;}};};
 wrap(g.craft.model,'update','physicsPlayer');wrap(g.collisions,'resolve','collisions');for(const ai of g.ai)wrap(ai,'update','ai');
 wrap(g.craft,'sync','riderVisual');for(const c of g.aiCraft)wrap(c,'sync','riderVisual');wrap(g.water,'update','waterCPU');wrap(g.citySample,'update','districtCPU');
 return{frames,ext:!!ext,configure(every){gpuEvery=every;serial=0;},start(){poll();r.info.reset();frame={cpu:{},gpu:{},gpuMeasured:gpuEvery>0&&serial++%gpuEvery===0};return frame;},end(t,interval){frame.cpu.frame=performance.now()-t;frame.interval=interval;frame.draws=r.info.render.calls;frame.triangles=r.info.render.triangles;frame.points=r.info.render.points;frame.memory={...r.info.memory};frames.push(frame);frame=undefined;},async finish(){for(let i=0;i<100&&pending.length;i++){await new Promise(requestAnimationFrame);poll();}return{pending:pending.length};}};
}
let instrumentation;
async function run(name,{warmup=180,samples=180,gpuEvery=0}={}){
 await ready();if(!instrumentation)instrumentation=instrument();restoreCamera();setup(name);
 for(let i=0;i<warmup;i++){await new Promise(requestAnimationFrame);step();}
 restoreCamera();setup(name);instrumentation.configure(gpuEvery);const start=instrumentation.frames.length;let previous;
 for(let i=0;i<samples;i++){
  const now=await new Promise(requestAnimationFrame);const t=performance.now();instrumentation.start();step();instrumentation.end(t,previous===undefined?undefined:now-previous);previous=now;
 }
 const drain=await instrumentation.finish();game.paused=true;restoreCamera();return{scenario:name,schedule:'one fixed 60Hz physics step per rendered sample; identical replay before/after',timerQuery:instrumentation.ext,drain,frames:instrumentation.frames.slice(start),state:{kmh:game.craft.model.speed*3.6,lap:game.race.player.lap,phase:game.race.phase,energy:game.nitro.energy},heap:performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize}:null};
}
async function shot(name){
 await ready();restoreCamera();setup(['five','wake'].includes(name)?(name==='five'?'five':'high'):'idle');
 // Same simulation clock, wave phase, wake history, light and camera on both builds.
 for(let i=0;i<72;i++)step();game.paused=true;
 const g=game,m=g.craft.model;
 const poses={waterNear:[-5,2,-5,1,0,12],waterFar:[-6,1.1,-9,0,0,65],wake:[-4,3.4,-7,0,.2,-1],racer:[-3.2,2,3.2,0,.95,0],district:[-40,26,-55,0,16,20],five:[-11,5,-12,0,.9,5]};const v=poses[name];
 g.camera.camera.fov=42;g.camera.camera.updateProjectionMatrix();g.camera.camera.position.copy(world(m,...v.slice(0,3)));g.camera.camera.lookAt(world(m,...v.slice(3)));g.camera.camera.updateMatrixWorld();g.citySample.update(g.time,g.camera.camera);g.water.update(g.time);
 g.heroLighting.update(g.renderer,g.scene,g.craft.visual);g.aiCraft.forEach((c,i)=>g.aiLighting[i].update(g.renderer,g.scene,c.visual));
 for(let i=0;i<3;i++)g.renderer.render(g.scene,g.camera.camera);
 return{time:g.time,pixelRatio:g.renderer.getPixelRatio(),fov:g.camera.camera.fov,camera:g.camera.camera.position.toArray(),target:world(m,...v.slice(3)).toArray(),size:g.renderer.getDrawingBufferSize(new THREE.Vector2()).toArray()};
}
window.perfQA={ready,run,shot,setup,step,metadata(){const gl=game.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');return{revision:__PERF_REV__,gpu:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null,webgl:gl.getParameter(gl.VERSION),timer:!!gl.getExtension('EXT_disjoint_timer_query_webgl2'),viewport:[innerWidth,innerHeight],dpr:game.renderer.getPixelRatio()};}};
