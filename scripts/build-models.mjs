// Original curve-authored meshes, baked to portable GLB. No downloaded art assets.
import * as T from 'three';import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';import {mkdirSync,writeFileSync} from 'node:fs';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(v=>{this.result=`data:${blob.type};base64,${Buffer.from(v).toString('base64')}`;this.onloadend?.();});}};
const materials={silver:new T.MeshStandardMaterial({name:'Titanium',color:'#bacdd8',metalness:.82,roughness:.24}),paint:new T.MeshStandardMaterial({name:'Paint',color:'#126bba',metalness:.55,roughness:.25}),rubber:new T.MeshStandardMaterial({name:'Elastomer',color:'#152331',roughness:.8}),suit:new T.MeshStandardMaterial({name:'Suit',color:'#101e30',roughness:.65}),armor:new T.MeshStandardMaterial({name:'Armor',color:'#205d88',metalness:.35,roughness:.35}),glass:new T.MeshStandardMaterial({name:'Glass',color:'#153e55',metalness:.55,roughness:.12}),light:new T.MeshStandardMaterial({name:'Light',color:'#85f7ff',emissive:'#32bded',emissiveIntensity:1.3,roughness:.2})};
function mesh(parent,name,geometry,material,x=0,y=0,z=0){const m=new T.Mesh(geometry,material);m.name=name;m.position.set(x,y,z);parent.add(m);return m;}
/** Sections encode longitudinal position, half beam, half depth. Catmull interpolation
 * and superelliptic cross sections create a continuous manifold, rather than lathed balls. */
function loft(sections,rings=48,sides=32,power=.85){
 const c=new T.CatmullRomCurve3(sections.map(s=>new T.Vector3(...s)),false,'centripetal'),v=[],uv=[],index=[];
 for(let i=0;i<=rings;i++){const p=c.getPoint(i/rings);for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2,cos=Math.cos(a),sin=Math.sin(a);v.push(Math.sign(cos)*Math.abs(cos)**power*p.y,Math.sign(sin)*Math.abs(sin)**power*p.z,p.x);uv.push(j/sides,i/rings);}}
 for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;index.push(a,a+1,b,b,a+1,b+1);}
 // End caps are explicit, keeping the exported silhouette closed.
 for(const [i,reverse] of [[0,true],[rings,false]]){const p=c.getPoint(i/rings),center=v.length/3;v.push(0,0,p.x);uv.push(.5,i/rings);for(let j=0;j<sides;j++){const a=i*(sides+1)+j;index.push(center,reverse?a+1:a,reverse?a:a+1);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return g;
}
function rounded(w,h,depth,r){const s=new T.Shape();s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);return new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:.015,bevelThickness:.012,bevelSegments:2,steps:1,curveSegments:6});}
function limb(parent,name,a,b,r,material,detail){const g=loft([[-.5,r*.72,r*.65],[-.30,r,r*.85],[.05,r*.9,r],[.35,r*.8,r*.75],[.5,r*.68,r*.65]],detail?20:10,detail?16:10);g.rotateX(-Math.PI/2);const m=mesh(parent,name,g,material);m.position.copy(a).add(b).multiplyScalar(.5);m.scale.y=a.distanceTo(b);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());return m;}
function boat(detail){const group=new T.Group();group.name='Racecraft';const rings=detail?64:28,sides=detail?32:16;
 mesh(group,'ContinuousHull',loft([[-2.16,.46,.12],[-1.65,.70,.26],[-.65,.78,.31],[.5,.72,.29],[1.45,.48,.22],[2.30,.17,.09],[2.55,.018,.025]],rings,sides),materials.silver,0,.17,0);
 mesh(group,'SculptedDeck',loft([[-1.8,.35,.09],[-1.05,.52,.17],[-.2,.61,.23],[.65,.57,.19],[1.65,.32,.14],[2.37,.018,.025]],rings,sides),materials.paint,0,.59,0);
 const seat=mesh(group,'Saddle',rounded(.54,1.2,.16,.18),materials.rubber,0,.82,-.55);seat.rotation.x=-Math.PI/2;
 const column=mesh(group,'SteeringColumn',rounded(.16,.38,.12,.06),materials.silver,0,.95,.50);column.rotation.x=-.25;
 const bar=mesh(group,'Handlebar',new T.CylinderGeometry(.05,.05,.92,16),materials.rubber,0,1.16,.48);bar.rotation.z=Math.PI/2;
 const cockpit=mesh(group,'InstrumentPod',rounded(.48,.22,.08,.06),materials.rubber,0,1.0,.68);cockpit.rotation.x=-.32;
 const display=mesh(group,'TelemetryGlass',rounded(.36,.12,.016,.035),materials.glass,0,1.09,.68);display.rotation.x=-Math.PI/2+.3;
 const windshield=mesh(group,'CurvedWindscreen',loft([[-.25,.21,.015],[0,.37,.025],[.28,.22,.012]],20,16),materials.glass,0,1.0,.85);windshield.rotation.x=-.55;
 for(const side of [-1,1]){
  const seam=new T.CatmullRomCurve3([new T.Vector3(side*.46,.54,-1.6),new T.Vector3(side*.74,.49,-.5),new T.Vector3(side*.63,.52,.8),new T.Vector3(side*.18,.40,2.1)]);
  mesh(group,`PanelSeam_${side}`,new T.TubeGeometry(seam,detail?48:20,.009,5,false),materials.rubber);
  const strip=new T.CatmullRomCurve3([new T.Vector3(side*.48,.63,-1.25),new T.Vector3(side*.66,.61,0),new T.Vector3(side*.4,.61,1.2)]);
  mesh(group,`LightRibbon_${side}`,new T.TubeGeometry(strip,32,.022,6,false),materials.light);
  const foot=mesh(group,`Footwell_${side}`,rounded(.25,1.15,.06,.07),materials.rubber,side*.66,.39,-.1);foot.rotation.x=-Math.PI/2;
  const nozzle=mesh(group,`Impeller_${side}`,new T.CylinderGeometry(.19,.24,.5,detail?24:12),materials.rubber,side*.35,.25,-1.98);nozzle.rotation.x=Math.PI/2;
  mesh(group,`NozzleRing_${side}`,new T.TorusGeometry(.20,.038,8,detail?32:16),materials.silver,side*.35,.25,-2.22);
  mesh(group,`NozzleGlow_${side}`,new T.TorusGeometry(.14,.016,6,24),materials.light,side*.35,.25,-2.24);
  for(let i=0;i<4;i++){const vent=mesh(group,`Vent_${side}_${i}`,rounded(.045,.30,.035,.018),materials.rubber,side*.56,.66,.3+i*.15);vent.rotation.z=side*.4;}
 }
 return group;
}
function rider(detail){const root=new T.Group();root.name='Racer';const torso=new T.Group();torso.name='RiderTorso';torso.position.y=.1;root.add(torso);
 const body=mesh(torso,'TailoredSuit',loft([[0,.16,.13],[.12,.20,.15],[.40,.25,.19],[.65,.29,.18],[.78,.19,.13]],detail?36:18,detail?24:12),materials.suit,0,.02,.035);body.rotation.x=-Math.PI/2;
 const chest=mesh(torso,'ChestArmor',loft([[0,.17,.045],[.20,.22,.065],[.38,.21,.05]],24,16),materials.armor,0,.33,.20);chest.rotation.x=-Math.PI/2;
 const neck=mesh(torso,'NeckSeal',new T.CylinderGeometry(.105,.12,.12,16),materials.rubber,0,.83,.04);
 const helmet=mesh(torso,'FullFaceHelmet',new T.SphereGeometry(.21,detail?32:16,detail?20:12),materials.silver,0,1.01,.04);helmet.scale.set(.94,1.04,1.09);
 const visor=mesh(torso,'Visor',new T.SphereGeometry(.218,detail?32:16,12,0,Math.PI,Math.PI*.33,Math.PI*.34),materials.glass,0,1.01,.055);visor.scale.set(.94,1.04,1.09);
 for(const side of [-1,1]){
  const ear=mesh(torso,`HelmetSeal_${side}`,new T.CylinderGeometry(.045,.045,.025,16),materials.armor,side*.198,1.005,.025);ear.rotation.z=Math.PI/2;
  limb(root,`Thigh_${side}`,new T.Vector3(side*.16,.02,.04),new T.Vector3(side*.59,-.12,.42),.13,materials.suit,detail);
  limb(root,`Shin_${side}`,new T.Vector3(side*.59,-.12,.42),new T.Vector3(side*.68,-.53,.56),.105,materials.armor,detail);
  const boot=mesh(root,`Boot_${side}`,loft([[-.18,.07,.06],[-.04,.10,.08],[.15,.09,.055],[.23,.04,.045]],18,16),materials.rubber,side*.68,-.50,.59);
  limb(root,`UpperArm_${side}`,new T.Vector3(),new T.Vector3(0,1,0),.087,materials.armor,detail);
  limb(root,`Forearm_${side}`,new T.Vector3(),new T.Vector3(0,1,0),.073,materials.suit,detail);
  const glove=mesh(root,`Glove_${side}`,loft([[-.08,.05,.05],[0,.075,.07],[.10,.045,.04]],12,12),materials.rubber,side*.4,.14,.93);glove.rotation.x=-.25;
 }
 return root;
}
mkdirSync('public/models',{recursive:true});
const manifest=[];
for(const detail of [true,false])for(const [name,build] of [['watercraft',boat],['rider',rider]]){
 const scene=new T.Scene(),model=build(detail);
 if(name==='watercraft'){model.updateMatrixWorld(true);const batches=new Map();for(const m of [...model.children]){const g=(m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone()).applyMatrix4(m.matrixWorld);const list=batches.get(m.material)??[];list.push(g);batches.set(m.material,list);}model.clear();for(const [mat,parts]of batches)mesh(model,`Surface_${mat.name}`,mergeGeometries(parts,false),mat);}
 scene.add(model);let triangles=0,draws=0;scene.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;draws++;}});
 const binary=await new GLTFExporter().parseAsync(scene,{binary:true});const path=`public/models/${name}${detail?'':'-low'}.glb`;writeFileSync(path,Buffer.from(binary));manifest.push({file:path,bytes:binary.byteLength,triangles,draws});console.log(path,binary.byteLength,triangles,draws);
}
writeFileSync('public/models/manifest.json',JSON.stringify({author:'Original project artwork',method:'Curve-authored manifold lofts and layered articulated racer',assets:manifest},null,2));
