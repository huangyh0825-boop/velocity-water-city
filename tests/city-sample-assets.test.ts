import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {Matrix4,Quaternion,Vector3} from 'three';import {CityTrack} from '../src/track/CityTrack';import {CITY_SAMPLE,inCitySample} from '../src/environment/CitySample';

function glb(path:string){const bytes=readFileSync(path),length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length).toString()),bin=bytes.subarray(28+length);return{bytes,json,bin};}
test('Blender sample GLBs contain legal PBR maps, actual geometry LOD and clear the unchanged canal',()=>{
 const track=new CityTrack(),route=JSON.parse(readFileSync('assets/city-sample/source/route.json','utf8').replace(/^\uFEFF/,'')),center=track.point(CITY_SAMPLE.center*Math.PI*2),heading=track.heading(CITY_SAMPLE.center*Math.PI*2);
 assert.ok(Math.hypot(center.x-route.center.x,center.z-route.center.z)<1e-5);assert.ok(Math.abs(heading-route.h)<1e-8);assert.equal(inCitySample(track,CITY_SAMPLE.center*Math.PI*2),true);assert.equal(inCitySample(track,.2*Math.PI*2),false);
 const counts:number[]=[];
 for(const file of ['waterfront.glb','waterfront-low.glb']){
  const {bytes,json,bin}=glb('public/models/city-sample/'+file);assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.ok(json.materials.some((m:any)=>m.normalTexture));assert.ok(json.materials.some((m:any)=>m.pbrMetallicRoughness.metallicRoughnessTexture));assert.ok(json.images.length>=7);assert.ok(json.meshes.length<=10);
  let triangles=0,bad=0;const world=new Matrix4().makeRotationY(heading).setPosition(center.x,0,center.z),point=new Vector3();
  const visit=(id:number,parent:Matrix4)=>{
   const node=json.nodes[id],local=node.matrix?new Matrix4().fromArray(node.matrix):new Matrix4().compose(new Vector3().fromArray(node.translation??[0,0,0]),new Quaternion().fromArray(node.rotation??[0,0,0,1]),new Vector3().fromArray(node.scale??[1,1,1])),matrix=parent.clone().multiply(local);
   if(node.mesh!==undefined)for(const primitive of json.meshes[node.mesh].primitives){const acc=json.accessors[primitive.attributes.POSITION],view=json.bufferViews[acc.bufferView],offset=(view.byteOffset??0)+(acc.byteOffset??0),stride=view.byteStride??12;assert.equal(acc.componentType,5126);triangles+=json.accessors[primitive.indices].count/3;
    for(let i=0;i<acc.count;i++){const at=offset+i*stride;point.set(bin.readFloatLE(at),bin.readFloatLE(at+4),bin.readFloatLE(at+8)).applyMatrix4(matrix);assert.ok([point.x,point.y,point.z].every(Number.isFinite));if(point.y<12&&point.y>-.15&&track.contains({x:point.x,z:point.z},1.3))bad++;}
   }
   for(const child of node.children??[])visit(child,matrix);
  };
  for(const root of json.scenes[json.scene??0].nodes)visit(root,world);assert.equal(bad,0,'no sample solid below 12m may enter the usable water corridor');counts.push(triangles);
 }
 assert.ok(counts[0]>100000&&counts[1]<counts[0]*.55);
});
