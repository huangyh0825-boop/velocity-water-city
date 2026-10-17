import{createRequire}from'node:module';import{writeFileSync}from'node:fs';
const{chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE??'playwright'),browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});await page.goto('http://127.0.0.1:5173/scripts/qa/vertical.html');await page.waitForFunction(()=>window.verticalQA);await page.evaluate(()=>window.verticalQA.ready());
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),g=window.testGame,ray=new T.Raycaster(),meshes=[],original=[];
  g.city.root.updateMatrixWorld(true);g.city.root.traverse(o=>{if(o.isMesh&&o.visible&&o.geometry?.getAttribute('position')){meshes.push(o);for(const m of Array.isArray(o.material)?o.material:[o.material]){original.push([m,m.side]);m.side=T.DoubleSide;}}});
  const hits=[];
  for(const route of [{id:null,samples:g.track.samples},...g.track.shortcuts.map(c=>({id:c.id,samples:c.samples}))])for(let i=0;i<route.samples.length;i++){
   const p=route.samples[i];if((p.y??0)<.5)continue;
   for(const lane of [-Math.max(0,p.width-3),0,Math.max(0,p.width-3)]){
    const at=g.track.routePoint(p.angle,lane,route.id),origin=new T.Vector3(at.x,at.y+1.4,at.z);
    for(const yaw of [p.heading,p.heading+Math.PI/2,p.heading+Math.PI,p.heading-Math.PI/2]){
     const d=new T.Vector3(Math.sin(yaw),0,Math.cos(yaw));ray.set(origin,d);ray.far=100;
     for(const mesh of meshes){const h=ray.intersectObject(mesh,false)[0];if(!h||!h.face)continue;const normal=h.face.normal.clone().transformDirection(mesh.matrixWorld);if(normal.dot(d)>.1){hits.push({route:route.id,t:p.angle/(Math.PI*2),q:route.id?(p.angle-g.track.shortcuts.find(c=>c.id===route.id).from)/(g.track.shortcuts.find(c=>c.id===route.id).to-g.track.shortcuts.find(c=>c.id===route.id).from):null,lane,x:at.x,y:at.y,z:at.z,material:mesh.material.name||mesh.material.color?.getHexString(),mesh:mesh.uuid,exitDistance:h.distance});break;}}
     if(hits.at(-1)?.x===at.x)break;
    }
   }
  }
  for(const[m,side]of original)m.side=side;
  return{method:'Horizontal rays from hull height inside closed district solids; first hit is an outward exit face. Candidate conflicts require visual verification.',hits};
 });
 writeFileSync('docs/track-repair-plan/obstacle-scan.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 if(result.hits.length){const hit=result.hits[Math.floor(result.hits.length/2)];await page.evaluate(h=>{window.verticalQA.fixture(h.route?h.q:h.t,h.route,0);window.verticalQA.view([0,5.7,-13],[0,1,8],true);},hit);await page.screenshot({path:'docs/track-repair-plan/current-obstacle.png'});await page.evaluate(()=>window.verticalQA.view([-48,28,-28],[0,3,12]));await page.screenshot({path:'docs/track-repair-plan/current-obstacle-context.png'});}
 await page.evaluate(()=>{window.verticalQA.fixture(.89,'tunnel-cut',0);window.verticalQA.view([-20,25,-30],[0,0,10]);});await page.screenshot({path:'docs/track-repair-plan/current-shortcut-exit.png'});
}finally{await browser.close();}
