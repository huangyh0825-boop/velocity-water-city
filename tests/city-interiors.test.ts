import {test} from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {CityTrack} from '../src/track/CityTrack';
import {CITY_MODULES,citySites} from '../src/environment/CityDensityLayout';
import {INTERIOR_BAYS,interiorSites} from '../src/environment/CityInteriors';
import {CityContactShadows} from '../src/environment/CityContactShadows';
import {CityGlass} from '../src/environment/CityGlass';

test('occupied bays stay in reserved visual footprints and cover both banks without changing buildings',()=>{
 const track=new CityTrack(),sites=citySites(track),before=JSON.stringify(sites),selected=interiorSites(sites);
 assert.equal(selected.length,9);assert.equal(new Set(selected.map(s=>s.kind)).size,5);assert.equal(new Set(selected.map(s=>s.id)).size,selected.length);
 for(const s of selected){const b=INTERIOR_BAYS[s.kind]!,m=CITY_MODULES[s.kind];assert.ok(Math.abs(b.x)+b.width/2+.1<=m.rx);assert.ok(b.back-b.depth-.1>=-m.rz);assert.ok(b.floor+b.height<=m.height);assert.notEqual(s.layer,'skyline');}
 assert.deepEqual(new Set(selected.map(s=>s.side)),new Set([-1,1]));assert.equal(JSON.stringify(sites),before);
});

test('foundation contact occlusion stays off racing water and contains only finite static land geometry',()=>{
 const track=new CityTrack(),sites=citySites(track),contacts=new CityContactShadows(sites),positions=contacts.mesh.geometry.attributes.position,c=track.point(.06*Math.PI*2),h=track.heading(.06*Math.PI*2);
 assert.equal(positions.count,sites.filter(s=>s.layer!=='skyline').length*6);
 for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i);assert.ok([x,z,positions.getY(i)].every(Number.isFinite));assert.equal(track.contains({x:c.x+Math.cos(h)*x+Math.sin(h)*z,z:c.z-Math.sin(h)*x+Math.cos(h)*z},-1),false);}
 assert.equal((contacts.mesh.material as THREE.Material).depthWrite,false);contacts.dispose();
});

test('glass shader setup is idempotent and keeps distinct low quality programs and one shared atlas',()=>{
 const atlas=new THREE.Texture(),glass=Object.assign(Object.create(CityGlass.prototype),{atlas}) as CityGlass;
 const a=new THREE.MeshPhysicalMaterial(),b=new THREE.MeshStandardMaterial();a.name='Blue laminated glazing';b.name='Silver blue glazing';glass.prepare(a,false);glass.prepare(b,true);
 const callback=a.onBeforeCompile;glass.prepare(a,false);assert.equal(a.onBeforeCompile,callback);assert.notEqual(a.customProgramCacheKey(),b.customProgramCacheKey());assert.equal(a.transparent,false);assert.equal(a.metalness,0);assert.ok(a.envMapIntensity<.5);
 for(const material of [a,b]){const shader:any={uniforms:{},vertexShader:THREE.ShaderLib.physical.vertexShader,fragmentShader:THREE.ShaderLib.physical.fragmentShader};material.onBeforeCompile(shader,null as any);assert.equal(shader.uniforms.cityRoomAtlas.value,atlas);assert.match(shader.vertexShader,/vCityRoomUV=/);assert.match(shader.fragmentShader,/smoothstep\(95.0,175.0/);assert.match(shader.fragmentShader,material===a?/#define CITY_ROOM_DETAIL 1/:/#define CITY_ROOM_DETAIL 0/);}
 const wall=new THREE.MeshStandardMaterial();wall.name='CC0_Concrete034';glass.prepare(wall,false);assert.equal(wall.userData.cityRoomGlass,undefined);a.dispose();b.dispose();wall.dispose();atlas.dispose();
});
