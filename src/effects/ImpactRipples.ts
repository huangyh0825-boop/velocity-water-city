import * as THREE from 'three';import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';import {waterWaveGLSL} from './WaterSurface';
/** Eight bounded pressure rings, displaced by the exact water spectrum. */
export class ImpactRipples{
 readonly mesh:THREE.InstancedMesh;private material:THREE.ShaderMaterial;private ages=new Float32Array(8).fill(10);private strength=new Float32Array(8);private centers=Array.from({length:8},()=>new THREE.Vector3());private cursor=0;private dummy=new THREE.Object3D();private opacity=new THREE.InstancedBufferAttribute(new Float32Array(8),1);
 constructor(scene:THREE.Scene){const sheet=new THREE.PlaneGeometry(1,1,24,24);sheet.rotateX(-Math.PI/2);const crown=new THREE.CylinderGeometry(.37,.34,1,40,2,true);crown.translate(0,.5,0);
  for(const[g,kind]of[[sheet,0],[crown,1]] as const)g.setAttribute('crown',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(kind),1));
  const geometry=mergeGeometries([sheet,crown],false)!;sheet.dispose();crown.dispose();geometry.setAttribute('ringOpacity',this.opacity);geometry.setAttribute('impactAge',new THREE.InstancedBufferAttribute(this.ages,1));
  this.material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,uniforms:{time:{value:0}},vertexShader:`uniform float time;attribute float ringOpacity;attribute float impactAge;attribute float crown;varying float opacity;varying vec2 ringUV;varying float isCrown;varying float age;${waterWaveGLSL}
   void main(){ringUV=uv;opacity=ringOpacity;isCrown=crown;age=impactAge;vec3 local=position;if(crown>.5)local.y*=max(0.,sin(min(1.,impactAge/.6)*3.14159265))*.85;vec4 w=modelMatrix*instanceMatrix*vec4(local,1.);float h;vec2 slope;waterWaves(w.xz,time,h,slope);w.y+=h+.035;gl_Position=projectionMatrix*viewMatrix*w;}`,
   fragmentShader:`varying float opacity;varying vec2 ringUV;varying float isCrown;varying float age;void main(){float a;
    if(isCrown>.5){float strands=smoothstep(.1,.8,sin(ringUV.x*125.+age*4.));a=opacity*1.8*strands*smoothstep(0.,.1,ringUV.y)*(1.-smoothstep(.65,1.,ringUV.y));}
    else{float r=length(ringUV-.5)*2.,edge=abs(r-.76);float foam=exp(-edge*edge/ .003);float broken=.55+.45*sin(atan(ringUV.y-.5,ringUV.x-.5)*29.+r*32.);a=foam*broken*opacity;}
    if(a<.008)discard;gl_FragColor=vec4(.77,.92,.94,a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
  this.mesh=new THREE.InstancedMesh(geometry,this.material,8);this.mesh.name='water-impact-pressure-rings';this.mesh.frustumCulled=false;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.reset();scene.add(this.mesh);
 }
 bindTime(time:{value:number}){this.material.uniforms.time=time;}
 burst(x:number,z:number,strength:number,height:number,kind:'landing'|'collision'|'takeoff'){const i=this.cursor++%8;this.centers[i].set(x,height,z);this.ages[i]=0;this.strength[i]=Math.min(1,strength/18)*(kind==='takeoff'?.45:1);}
 update(dt:number){let changed=false,active=false;for(let i=0;i<8;i++){if(this.ages[i]>=1.2)continue;changed=true;this.ages[i]+=dt;const t=this.ages[i]/1.2,radius=.55+this.strength[i]*.65+this.ages[i]*3.2;this.dummy.position.copy(this.centers[i]);this.dummy.scale.set(radius*2,1,radius*2);this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);this.opacity.setX(i,t>=1?0:Math.min(1,t*8)*.32*Math.pow(1-t,1.5)*this.strength[i]);if(t<1)active=true;}
  this.mesh.count=active?8:0;if(changed){this.mesh.instanceMatrix.needsUpdate=true;this.opacity.needsUpdate=true;this.mesh.geometry.getAttribute('impactAge').needsUpdate=true;}
 }
 setLow(low:boolean){this.mesh.visible=!low;this.reset();}
 reset(){this.ages.fill(10);this.opacity.array.fill(0);this.opacity.needsUpdate=true;this.mesh.count=0;for(let i=0;i<8;i++){this.dummy.scale.setScalar(0);this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);}this.mesh.instanceMatrix.needsUpdate=true;}
}
