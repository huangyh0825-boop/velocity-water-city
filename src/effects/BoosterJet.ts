import * as THREE from 'three';import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
/** Pressure core and flowing sheath in one additive draw, anchored to the
 * authored outlet. No extra light or per-frame scene search. */
export class BoosterJet {
 readonly object=new THREE.Group();private material:THREE.ShaderMaterial;private revision=-1;private scratch=new THREE.Vector3();
 constructor(private parent:THREE.Object3D){
  const layers=[0,1].map(layer=>{const length=layer?1.65:2.65,g=new THREE.ConeGeometry(layer?.105:.235,length,16,4,true);g.rotateX(-Math.PI/2);g.translate(0,0,-length/2);g.setAttribute('core',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(layer),1));return g;});
  const geometry=mergeGeometries(layers,false)!;layers.forEach(g=>g.dispose());
  this.material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,forceSinglePass:true,uniforms:{time:{value:0}},
   vertexShader:'attribute float core;varying vec2 jetUV;varying float jetCore;void main(){jetUV=uv;jetCore=core;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:`uniform float time;varying vec2 jetUV;varying float jetCore;void main(){float z=jetUV.y;
    float head=smoothstep(0.,.035,z),tail=1.-smoothstep(.44,1.,z),pulse=.82+.18*sin(time*17.-z*18.);
    float rings=pow(.5+.5*sin(z*53.-time*28.),6.);float strand=.68+.32*sin(jetUV.x*37.7-z*21.+time*8.);
    float pressure=exp(-pow((z-.16)/.055,2.))*.18;
    float a=head*tail*pulse*mix(.24*strand+.16*rings+pressure,.72,jetCore);
    vec3 color=mix(vec3(.025,.32,.80),vec3(.50,.95,1.),jetCore+.20*rings);gl_FragColor=vec4(color,a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
  const mesh=new THREE.Mesh(geometry,this.material);mesh.name='pressure-core-and-sheath';this.object.name='nitro-pressure-jet';this.object.add(mesh);parent.add(this.object);this.object.visible=false;
 }
 update(time:number,active:boolean){
  const revision=this.parent.userData.visualRevision??0;if(revision!==this.revision){this.revision=revision;const socket=this.parent.getObjectByName('JetOutlet');if(socket)this.object.position.copy(this.parent.worldToLocal(socket.getWorldPosition(this.scratch)));else this.object.position.set(0,.25,-2.3);}
  this.object.visible=active;if(!active)return;this.material.uniforms.time.value=time;this.object.scale.set(1,1,.96+Math.sin(time*21)*.035);
 }
}
