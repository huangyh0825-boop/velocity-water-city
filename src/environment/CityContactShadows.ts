import * as THREE from 'three';
import {type CitySite} from './CityDensityLayout';

/** Static land-only foundation occlusion; one pass, no screen-space history or lights. */
export class CityContactShadows {
 readonly mesh:THREE.Mesh;
 constructor(sites:CitySite[]){
  const points:number[]=[],uv:number[]=[];
  for(const s of sites.filter(s=>s.layer!=='skyline')){
   const corners=[[-1,-1],[1,-1],[-1,1],[1,1]];
   for(const i of [0,2,1,1,2,3]){
    const [u,v]=corners[i],x=u*s.rx*1.06,z=v*s.rz*1.06;points.push(s.x+x*Math.cos(s.heading)+z*Math.sin(s.heading),.303,s.z-x*Math.sin(s.heading)+z*Math.cos(s.heading));uv.push(u*.5+.5,v*.5+.5);
   }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,
   vertexShader:'varying vec2 contactUV;void main(){contactUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:'varying vec2 contactUV;void main(){vec2 d=abs(contactUV*2.-1.);float a=(1.-smoothstep(.67,1.,max(d.x,d.y)))*.25;gl_FragColor=vec4(.025,.043,.060,a);}'
  });this.mesh=new THREE.Mesh(geometry,material);this.mesh.name='district-foundation-contact-shadows';
 }
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();(this.mesh.material as THREE.Material).dispose();}
}
