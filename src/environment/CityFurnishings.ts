import*as THREE from 'three';
import{mergeGeometries,mergeVertices}from'three/addons/utils/BufferGeometryUtils.js';
import{type CityPart}from'./CityMaterialBatch';
import{StaticPropInstances}from'./StaticPropInstances';
import{waterfrontLayout,type WaterfrontPocket}from'./WaterfrontLayout';
import{sampleLocal,type CitySite}from'./CityDensityLayout';
import{CityTrack}from'../track/CityTrack';
import{publicCitizens}from'./PublicCitizens';

/** Original public-space kit, shared PBR finishes and exact instance culling.
 * Pure scenery: it never registers a boat collider or writes a racing position. */
export class CityFurnishings{
 readonly root=new THREE.Group();readonly pockets:WaterfrontPocket[];readonly counts:Record<string,number>={};
 private batches:StaticPropInstances[]=[];private owned=new Set<THREE.Material>();private textures:THREE.Texture[]=[];private geometries:THREE.BufferGeometry[]=[];
 constructor(track:CityTrack,sites:CitySite[],shared:(name:string)=>THREE.Material|undefined,sample:THREE.Group,citizens:THREE.Group){
  this.root.name='inhabited-waterfront-spaces';this.pockets=waterfrontLayout(track,sites);
  const finish=(name:string,color:string,roughness:number,metalness=0)=>{const source=shared(name),m=source instanceof THREE.MeshStandardMaterial?source.clone():new THREE.MeshStandardMaterial();m.color.set(color);m.roughness=roughness;m.metalness=metalness;this.owned.add(m);return m;};
  const stone=finish('CC0_Concrete034','#929f9e',.87),dark=finish('CC0_Metal032','#263e48',.45,.7),silver=finish('CC0_Metal032','#b6c5c8',.32,.75),curb=finish('CC0_Concrete034','#5b727a',.82),rubber=finish('Graphite joint seals','#1e3037',.86);
  const texture=(kind:'wood'|'cloth'|'leaf')=>{const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d')!,im=x.createImageData(512,512);for(let y=0;y<512;y++)for(let i=0;i<512;i++){const k=(y*512+i)*4,n=kind==='wood'?.84+.07*Math.sin(i*.11+Math.sin(y*.012)*4)+.04*Math.sin(i*.63+y*.009):kind==='cloth'?.86+.08*Math.sin(i*Math.PI)*Math.cos(y*Math.PI/2)+.04*Math.cos(i*1.57+y*1.57):.74+.10*Math.sin(i*.018+y*.035)+.10*Math.cos(i*.13)*Math.cos(y*.08);im.data[k]=im.data[k+1]=im.data[k+2]=Math.round(n*255);im.data[k+3]=255;}x.putImageData(im,0,0);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;this.textures.push(t);return t;};
  const wood=new THREE.MeshStandardMaterial({color:'#916743',map:texture('wood'),roughness:.65}),clothMap=texture('cloth'),leafMap=texture('leaf');this.owned.add(wood);
  const foliage=new THREE.MeshStandardMaterial({color:'#477b42',map:leafMap,roughness:.92}),grass=new THREE.MeshStandardMaterial({color:'#829552',map:leafMap,roughness:.94,side:THREE.DoubleSide}),bark=new THREE.MeshStandardMaterial({color:'#6c6250',map:leafMap,roughness:.95});[foliage,grass,bark].forEach(m=>this.owned.add(m));
  const glow=new THREE.MeshBasicMaterial({color:'#b9eee8'});this.owned.add(glow);
  const parts=new Map<string,CityPart[]>();let pieces=new Map<THREE.Material,THREE.BufferGeometry[]>();const tint=new Map<THREE.Material,THREE.Color>();
  const add=(g:THREE.BufferGeometry,m:THREE.Material,x=0,y=0,z=0,sx=1,sy=1,sz=1,rotation=new THREE.Euler())=>{if(g.index){const original=g;g=g.toNonIndexed();original.dispose();}g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(rotation),new THREE.Vector3(sx,sy,sz)));const color=tint.get(m);if(color){const values=new Float32Array(g.attributes.position.count*3);for(let i=0;i<values.length;i+=3){values[i]=color.r;values[i+1]=color.g;values[i+2]=color.b;}g.setAttribute('color',new THREE.BufferAttribute(values,3));}const list=pieces.get(m)??[];list.push(g);pieces.set(m,list);};
  const done=(name:string,tier='near')=>{const list:CityPart[]=[];for(const[material,geometries]of pieces){const merged=mergeGeometries(geometries,false)!,geometry=mergeVertices(merged,1e-6);merged.dispose();this.geometries.push(geometry);list.push({geometry,material});geometries.forEach(g=>g.dispose());}parts.set(name+':'+tier,list);pieces=new Map();};
  const slab=(w:number,h:number,d:number,r=.07)=>{const s=new THREE.Shape(),bevel=Math.min(.02,h*.24);s.moveTo(-w/2+r,-d/2);s.lineTo(w/2-r,-d/2);s.quadraticCurveTo(w/2,-d/2,w/2,-d/2+r);s.lineTo(w/2,d/2-r);s.quadraticCurveTo(w/2,d/2,w/2-r,d/2);s.lineTo(-w/2+r,d/2);s.quadraticCurveTo(-w/2,d/2,-w/2,d/2-r);s.lineTo(-w/2,-d/2+r);s.quadraticCurveTo(-w/2,-d/2,-w/2+r,-d/2);const g=new THREE.ExtrudeGeometry(s,{depth:h-2*bevel,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,steps:1,curveSegments:4});g.rotateX(-Math.PI/2);g.translate(0,-h/2+bevel,0);return g;};
  const rod=(a:THREE.Vector3,b:THREE.Vector3,r:number,m:THREE.Material)=>{const points=[a,b],g=new THREE.TubeGeometry(new THREE.LineCurve3(a,b),1,r,6,false);add(g,m);};
  add(slab(6.4,.38,14.4),stone,0,.19,0);for(const x of [-3.05,3.05])add(slab(.12,.04,14.1,.03),silver,x,.4,0);for(let z=-6;z<=6;z+=1.2)add(new THREE.BoxGeometry(6.1,.012,.025),curb,0,.385,z);
  // A structural skirt and piles support the bays across small irregular quay
  // inlets; they remain strictly inside the reserved dry/non-racing footprint.
  for(const x of [-2.95,2.95]){add(slab(.22,.6,14.0,.04),curb,x,-.18,0);for(const z of [-6.5,6.5])add(new THREE.CylinderGeometry(.18,.24,1.1,10),dark,x,-.34,z);}done('quay-base');
  add(slab(14,.38,8.6),stone,0,.19,0);for(const x of [-6.8,6.8])add(slab(.13,.04,8.2,.03),silver,x,.4,0);for(let z=-3.6;z<=3.6;z+=1.2)add(new THREE.BoxGeometry(13.8,.012,.028),curb,0,.385,z);done('plaza-base');
  add(slab(2.9,.12,7.2),stone,0,.06,0);for(let z=-3;z<=3;z+=1.2)add(new THREE.BoxGeometry(2.75,.012,.025),curb,0,.125,z);done('rest-base');
  // Slatted benches with shaped supports, end caps and a separate back rest.
  for(let i=0;i<5;i++){add(slab(2.6,.07,.12,.035),wood,0,.48,-.28+i*.14);add(slab(2.6,.105,.09,.035),wood,0,.76+i*.075,.37,1,1,1,new THREE.Euler(-.15,0,0));}
  for(const side of [-1,1]){rod(new THREE.Vector3(side*.98,.05,-.24),new THREE.Vector3(side*.98,.52,-.24),.045,dark);rod(new THREE.Vector3(side*.98,.05,.28),new THREE.Vector3(side*.98,1.05,.39),.045,dark);add(slab(.36,.045,.8),silver,side*.98,.04,0);rod(new THREE.Vector3(side*1.18,.67,-.32),new THREE.Vector3(side*1.18,.67,.4),.035,silver);}done('bench');
  const planter=()=>{add(slab(1.6,.65,1.2,.12),curb,0,.325,0);add(slab(1.7,.08,1.3,.14),silver,0,.65,0);add(slab(1.45,.05,1.05,.12),bark,0,.70,0);};
  const blade=(height:number,width:number)=>{const g=new THREE.PlaneGeometry(width,height,1,4),p=g.attributes.position;for(let i=0;i<p.count;i++){const t=(p.getY(i)+height/2)/height;p.setX(i,p.getX(i)*Math.sin(Math.PI*Math.max(.03,Math.min(.97,t))));p.setZ(i,Math.sin(t*Math.PI)*height*.16);}g.translate(0,height/2,0);g.computeVertexNormals();return g;};
  planter();for(let i=0;i<30;i++){const a=i*2.39996,r=.15+(i%6)*.085;add(blade(.45+(i%5)*.11,.08),grass,Math.cos(a)*r,.71,Math.sin(a)*r*.7,1,1,1,new THREE.Euler(.1*Math.sin(a),a,.14*Math.cos(a)));}done('reeds');
  planter();for(let i=0;i<22;i++){const a=i*2.39996,r=.1+(i%5)*.12;add(new THREE.SphereGeometry(.17,8,6),foliage,Math.cos(a)*r,.85+(i%3)*.07,Math.sin(a)*r*.7,1.35,1,.9);}done('flowerbox');
  // Small three-dimensional leaves with convex tops and shaded undersides;
  // three crown/branch silhouettes, rather than oversized crossed paper cards.
  for(let variant=0;variant<3;variant++)for(const tier of['near','mid']){
   planter();const tall=variant===1?1.23:variant===2?.88:1;
   const trunk=new THREE.CatmullRomCurve3([new THREE.Vector3(0,.69,0),new THREE.Vector3(-.04,1.6,0),new THREE.Vector3(.08,2.7*tall,.05),new THREE.Vector3(.02,3.8*tall,.02)]);add(new THREE.TubeGeometry(trunk,10,.075,8,false),bark);
   for(let i=0;i<9;i++){const a=i*2.39996,y=(2.25+i*.12)*tall,r=variant===1?.65:1.0;add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(.03,y,0),new THREE.Vector3(Math.cos(a)*r*.5,y+.23,Math.sin(a)*r*.5),new THREE.Vector3(Math.cos(a)*r,y+.45,Math.sin(a)*r)]),5,.027,6,false),bark);}
   for(let i=0;i<660;i++){const a=i*2.39996,r=Math.sqrt((i%67)/67)*(variant===1?.82:1.35),y=(3.35+.67*Math.sin(i*.79))*tall;
    add(new THREE.SphereGeometry(1,tier==='near'?6:4,tier==='near'?3:2),i%5?foliage:grass,Math.cos(a)*r,y,Math.sin(a)*r*.85,.15+(i%3)*.015,.018,.055,new THREE.Euler(Math.sin(i)*.7,a,Math.cos(i)*.6));}
   done(variant?'tree-'+variant:'tree',tier);
  }
  add(slab(3.6,.32,2.3,.3),curb,0,.16,0);add(slab(3.35,.07,2.05,.26),bark,0,.34,0);
  for(let i=0;i<28;i++){const a=i*2.39996,r=.24+(i%7)*.17;add(new THREE.SphereGeometry(.28,8,5),foliage,Math.cos(a)*r,.6+(i%4)*.1,Math.sin(a)*r*.58,1.1,.9,1.0);}
  for(let i=0;i<45;i++)add(blade(.32+(i%5)*.06,.045),grass,Math.sin(i*1.73)*1.4,.39,Math.cos(i*2.1)*.84,1,1,1,new THREE.Euler(0,i*.6,Math.sin(i)*.15));done('green-island');
  const lawn=new THREE.MeshStandardMaterial({color:'#657c50',map:leafMap,roughness:.96});this.owned.add(lawn);
  add(slab(2.9,.18,6,.28),curb,0,.09,0);add(slab(2.65,.055,5.75,.25),lawn,0,.2,0);
  for(let i=0;i<90;i++){const a=i*2.39996;add(blade(.15+(i%3)*.025,.028),grass,Math.sin(a)*1.2,.23,Math.cos(i*.79)*2.65,1,1,1,new THREE.Euler(.1,a,.12));}done('lawn-bed');
  add(slab(.58,.10,.58),silver,0,.05,0);add(new THREE.CylinderGeometry(.055,.095,4.4,10),dark,0,2.25,0);rod(new THREE.Vector3(0,4.45,0),new THREE.Vector3(.5,4.65,0),.055,silver);add(slab(.8,.10,.42),dark,.5,4.66,0);add(slab(.65,.025,.29),glow,.5,4.6,0);done('lamp');
  add(slab(.47,.85,.48),dark,0,.425,0);add(slab(.49,.08,.50),silver,0,.88,0);add(new THREE.BoxGeometry(.3,.15,.012),rubber,0,.67,-.25);for(const x of [-.15,.15])add(new THREE.BoxGeometry(.018,.6,.015),silver,x,.4,-.25);done('bin');
  for(const z of [-3,0,3]){add(new THREE.CylinderGeometry(.04,.06,1.1,8),silver,0,.55,z);add(slab(.3,.08,.35),dark,0,.04,z);}for(const y of [.5,1.05])rod(new THREE.Vector3(0,y,-3.1),new THREE.Vector3(0,y,3.1),.03,silver);done('railing');
  add(slab(.5,.1,.55),dark,0,.05,0);add(new THREE.CylinderGeometry(.12,.16,.8,10),silver,0,.5,0);add(new THREE.CylinderGeometry(.24,.24,.12,12),dark,0,.93,0);add(new THREE.TorusGeometry(.28,.05,6,18),silver,0,1.02,0,1,1,1,new THREE.Euler(Math.PI/2,0,0));done('mooring');
  add(slab(.8,.12,.65),dark,0,.06,0);add(slab(.36,1.55,.25),silver,0,.86,0);add(new THREE.TorusGeometry(.38,.10,7,24),wood,0,1.25,-.2);for(const y of [.65,.85])add(new THREE.BoxGeometry(.16,.04,.03),glow,0,y,-.15);done('rescue');
  const cv=document.createElement('canvas');cv.width=512;cv.height=256;const ctx=cv.getContext('2d')!;ctx.fillStyle='#113b48';ctx.fillRect(0,0,512,256);ctx.fillStyle='#9aeee2';ctx.fillRect(20,20,8,216);ctx.font='bold 38px sans-serif';ctx.fillText('WATERFRONT',48,78);ctx.font='22px sans-serif';ctx.fillText('PUBLIC DECK / CITY LIFE',48,119);for(let i=0;i<4;i++)ctx.fillRect(48+i*100,163,64,8);ctx.fillStyle='#c6b98a';ctx.font='20px sans-serif';ctx.fillText('REST   /   VIEW   /   EXPLORE',48,211);const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;this.textures.push(tex);const display=new THREE.MeshBasicMaterial({map:tex});this.owned.add(display);
  add(slab(.9,.08,.65),dark,0,.04,0);add(new THREE.CylinderGeometry(.07,.1,1.6,8),silver,0,.85,0);add(slab(1.1,.65,.12),dark,0,1.73,0);add(new THREE.PlaneGeometry(1,.5),display,0,1.73,-.09,1,1,1,new THREE.Euler(0,Math.PI,0));add(new THREE.PlaneGeometry(1,.5),display,0,1.73,.09);done('display');
  add(slab(18,.22,20,.28),stone,0,.11,0);for(let z=-9;z<=9;z+=1.25)add(new THREE.BoxGeometry(17.7,.012,.028),curb,0,.225,z);for(const x of[-8.5,8.5])add(slab(.11,.025,19.4),silver,x,.24,0);done('civic-base');
  const canopy=new THREE.MeshStandardMaterial({color:'#d0d6c6',map:clothMap,roughness:.88,side:THREE.DoubleSide});this.owned.add(canopy);
  // A curved public pergola, framed retail counter, utility dock and sculpture.
  for(const z of[-1.1,1.1]){const path=new THREE.CatmullRomCurve3([new THREE.Vector3(-1.6,0,z),new THREE.Vector3(-1.55,2.3,z),new THREE.Vector3(0,2.9,z),new THREE.Vector3(1.55,2.3,z),new THREE.Vector3(1.6,0,z)]);add(new THREE.TubeGeometry(path,24,.055,8,false),silver);}
  const roof=new THREE.PlaneGeometry(3.4,2.5,20,4);roof.rotateX(-Math.PI/2);for(let i=0;i<roof.attributes.position.count;i++){const x=roof.attributes.position.getX(i);roof.attributes.position.setY(i,2.85-.28*(x/1.7)**2);}roof.computeVertexNormals();add(roof,canopy);done('pergola');
  add(slab(2.9,.16,1.2,.15),dark,0,.08,0);add(slab(2.7,.92,1.03,.16),stone,0,.6,0);add(slab(2.95,.08,1.18,.12),wood,0,1.1,0);for(const x of[-1.1,0,1.1])add(slab(.12,.62,.05),silver,x,.6,-.54);add(new THREE.PlaneGeometry(1.5,.44),display,0,.72,-.565,1,1,1,new THREE.Euler(0,Math.PI,0));done('market-counter');
  add(slab(2.3,.16,1.5),dark,0,.08,0);for(const x of[-.6,.6]){add(slab(.96,1.65,1.12,.12),silver,x,.97,0);add(slab(.78,1.38,.06),dark,x,1,-.58);for(let i=0;i<6;i++)add(slab(.6,.035,.04),silver,x,.6+i*.12,-.625);add(new THREE.PlaneGeometry(.5,.3),display,x,1.42,-.63,1,1,1,new THREE.Euler(0,Math.PI,0));}add(new THREE.TorusGeometry(.25,.045,8,20),wood,1.0,1.0,0);done('utility-dock');
  add(slab(1.6,.25,1.6,.22),stone,0,.125,0);add(new THREE.TorusKnotGeometry(.55,.10,70,8,2,3),silver,0,1.18,0,1,1.5,1);add(new THREE.TorusGeometry(.62,.025,6,36),glow,0,.25,0,1,1,1,new THREE.Euler(Math.PI/2,0,0));done('public-art');
  publicCitizens(citizens,parts,this.owned,this.geometries,this.textures);
  const objects:{kind:string;tint:number}[]=[],poses:THREE.Matrix4[]=[],sampleHeading=track.heading(.06*Math.PI*2);
  // One-time contact query against the authored sample paving: its promenade is
  // higher than the global quay. Never bury planters/feet or change the terrain.
  sample.updateWorldMatrix(true,true);const ground=new Map<WaterfrontPocket,number>(),ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
  for(const p of this.pockets){const q=sampleLocal(track,p);let y=.18;
   if(Math.abs(q.z)<160&&Math.abs(q.x)<170){ray.set(sample.localToWorld(new THREE.Vector3(q.x,1.3,q.z)),down);ray.far=1.3;const hit=ray.intersectObject(sample,true)[0];if(hit)y=Math.max(y,sample.worldToLocal(hit.point.clone()).y+.015);}
   ground.set(p,y);
  }
  const place=(kind:string,p:WaterfrontPocket,x:number,z:number,rotation=0,scale=1,y=.4,stretchZ=1)=>{const h=p.heading,c=Math.cos(h),s=Math.sin(h),world={x:p.x+c*x+s*z,z:p.z-s*x+c*z},q=sampleLocal(track,world);objects.push({kind,tint:0});poses.push(new THREE.Matrix4().compose(new THREE.Vector3(q.x,y+ground.get(p)!,q.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),h+rotation-sampleHeading),new THREE.Vector3(scale,scale,scale*stretchZ)));this.counts[kind]=(this.counts[kind]??0)+1;};
  for(const p of this.pockets){
   if(p.id.startsWith('civic-')){
    const q=sampleLocal(track,p);objects.push({kind:'civic-base',tint:0});poses.push(new THREE.Matrix4().compose(new THREE.Vector3(q.x,ground.get(p)!,q.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p.heading-sampleHeading),new THREE.Vector3(p.rx/9,1,p.rz/10)));this.counts['civic-base']=(this.counts['civic-base']??0)+1;
    const y=.24,edge=p.rx-1.85,zedge=p.rz-1.75,tree=p.seed%3?'tree-'+p.seed%3:'tree';
    if(p.kind==='park'){
     for(const side of[-1,1]){place('lawn-bed',p,side*edge,0,0,.9,y,Math.max(.6,(p.rz-1.4)/2.7));place(tree,p,side*edge,-side*zedge*.7,0,.8,y);place('bench',p,side*Math.max(0,edge-2.2),side*zedge*.45,edge>2.3?side*Math.PI/2:0,1,y);}
     if(p.rx>=7)place('public-art',p,0,0,0,1,y);
    }else if(p.kind==='market'){
     place('pergola',p,-edge*.5,zedge*.4,0,1,y);place('market-counter',p,-edge*.5,zedge*.4,0,1,y);place('green-island',p,edge,-zedge*.65,0,.8,y);place('bench',p,edge,zedge*.7,Math.PI/2,1,y);
    }else if(p.kind==='maintenance'){
     place('utility-dock',p,-edge,zedge*.6,0,1,y);place('rescue',p,edge,-zedge,Math.PI/2,1,y);place('reeds',p,edge,zedge,0,.9,y);place('bench',p,-edge,-zedge,0,1,y);
     if(p.rx>=7){place('pergola',p,edge,0,Math.PI/2,1,y);place('market-counter',p,edge,0,Math.PI/2,1,y);}
    }else{
     place('pergola',p,0,zedge*.5,0,1,y);place('bench',p,0,zedge*.5,0,1,y);place('public-art',p,-edge,-zedge*.5,0,.8,y);place(tree,p,edge,-zedge*.5,0,.8,y);place('green-island',p,edge,zedge*.6,Math.PI/2,.8,y);
    }
    place('lamp',p,p.rx-.7,p.rz-1,Math.PI,1,y);place('bin',p,-p.rx+.7,p.rz-.8,0,1,y);place('display',p,p.rx-.7,-p.rz+.8,0,1,y);
    const count=p.kind==='race-plaza'?5:p.kind==='maintenance'?1:3;
    for(let i=0;i<count;i++)place('spectator-'+(p.seed+i)%4,p,(i-(count-1)/2)*.9,-Math.min(2.8,p.rz*.6)+(i%2)*.45,p.side*Math.PI/2+Math.sin(i+p.seed)*.15,.95+(i%3)*.035,y);
   }else if(p.kind==='rest-stop'){
    place('rest-base',p,0,0,0,1,0);const facing=p.side*Math.PI/2;
    place('bench',p,p.side*.65,.4,facing,1,.14);
    place(p.district==='industrial'||p.district==='harbor'?'reeds':'flowerbox',p,0,-2.65,0,.72,.14);
    place('bin',p,p.side*.9,2.8,0,1,.14);
    for(let i=0;i<2;i++)place('spectator-'+(p.seed+i)%4,p,-p.side*.7,-.8+i*1.7,facing,.95,.14);
   }else if(p.kind==='courtyard'){
    // Library's wide paving is scaled only to the actual reserved apron width.
    const q=sampleLocal(track,p);objects.push({kind:'plaza-base',tint:0});poses.push(new THREE.Matrix4().compose(new THREE.Vector3(q.x,ground.get(p)!,q.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p.heading-sampleHeading),new THREE.Vector3(p.rx/7,1,1)));this.counts['plaza-base']=(this.counts['plaza-base']??0)+1;
    for(const side of [-1,1]){place('bench',p,side*Math.min(3.1,p.rx-1.5),.6);place(p.district==='industrial'?'reeds':'tree',p,side*(p.rx-1.6),2.4,0,.75);place('flowerbox',p,side*(p.rx-1.0),-2.7,Math.PI/2,.75);}place('lamp',p,p.rx-.55,3.3,Math.PI);place('display',p,-p.rx+.7,-2.6);place('bin',p,p.rx-.65,-2.5);
    for(let i=0;i<3;i++)place('spectator-'+(p.seed+i)%4,p,(i-1)*1.1,-1.7+(i%2)*.65,(i%2?.16:-.18),.94+(i%3)*.045);
   }else{
    place('quay-base',p,0,0,0,1,0);const facing=p.side*Math.PI/2;
    for(const z of [-3.8,3.8])place('railing',p,-p.side*3.0,z*.85);
    place('bench',p,p.side*1.6,2.9,facing);place('lamp',p,p.side*2.6,5.8,p.side>0?Math.PI:0);place('bin',p,p.side*2.5,1.1);place('display',p,p.side*1.6,-5.2,facing);
    place(p.kind==='service'?'reeds':'tree',p,p.side*1.0,-2.6);place('flowerbox',p,0,6.0,Math.PI/2);
    if(p.kind==='service'){place('mooring',p,-p.side*1.8,-4.4);place('rescue',p,-p.side*1.5,4.4,facing);}
    const count=p.kind==='viewing'?9:p.kind==='service'?3:6;
    for(let i=0;i<count;i++)place('spectator-'+(i+p.seed)%4,p,-p.side*(1.6+(i%2)*.55),-4.7+i*9.4/Math.max(1,count-1),facing+Math.sin(i*1.7+p.seed)*.22,.92+(i%4)*.035);
   }
  }
  // Indexed prototypes retain every triangle, normal and UV seam while avoiding
  // repeated vertex-shader work. Every instance shares these immutable buffers.
  const batch=new StaticPropInstances(parts,objects,poses);this.batches.push(batch);this.root.add(...batch.meshes);
 }
 prepare(camera:THREE.Camera,sun:THREE.DirectionalLight|undefined,renderer:THREE.WebGLRenderer){for(const batch of this.batches)batch.prepare(this.root,camera,sun,renderer);}
 dispose(){this.root.removeFromParent();this.batches.forEach(b=>b.dispose());this.geometries.forEach(g=>g.dispose());this.owned.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());}
}
