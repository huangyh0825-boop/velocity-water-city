import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import * as THREE from 'three';
test('authored GLBs load finite curved geometry, keep physical hull size and reduce low LOD triangles',async()=>{
 let standard=0,low=0;
 for(const name of ['watercraft','watercraft-low','rider','rider-low']){const bytes=readFileSync(new URL(`../public/models/${name}.glb`,import.meta.url)),buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),g=await new GLTFLoader().parseAsync(buffer,'');let triangles=0;
  g.scene.traverse(o=>{if(o instanceof THREE.Mesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));}});
  if(name==='watercraft'){standard=triangles;const b=new THREE.Box3().setFromObject(g.scene);assert.ok(b.max.x<.85&&b.min.x>-.85&&b.max.z<2.7&&b.min.z> -2.7);}
  if(name==='watercraft-low')low=triangles;
  if(name.startsWith('rider'))for(const node of ['RiderTorso','UpperArm_-1','UpperArm_1','Forearm_-1','Forearm_1'])assert.ok(g.scene.getObjectByName(node));
 }
 assert.ok(standard>10000&&low<standard*.7);
});
