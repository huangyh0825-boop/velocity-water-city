import * as THREE from 'three';

/** Product finishes use the original maps, UVs and team colour. The environment
 * strength is consumed by the existing local-lighting pass, not a new light. */
export function raceFinish(m:THREE.MeshStandardMaterial){
 const n=m.name,p=m instanceof THREE.MeshPhysicalMaterial?m:undefined;
 const normal=(v:number)=>{m.normalScale.set(v,Math.sign(m.normalScale.y||1)*v);};
 let environment=.65;
 if(n==='Paint'){m.metalness=.30;m.roughness=.76;normal(.18);environment=.95;if(p){p.clearcoat=.95;p.clearcoatRoughness=.13;}}
 else if(/Pearl ceramic silver/.test(n)){m.metalness=.26;m.roughness=.82;normal(.20);environment=.82;if(p){p.clearcoat=.58;p.clearcoatRoughness=.19;}}
 else if(/pearl helmet/.test(n)){m.color.set('#edf3f2');m.metalness=.15;m.roughness=.78;normal(.16);environment=.74;if(p){p.clearcoat=.82;p.clearcoatRoughness=.15;}}
 else if(/woven flotation|blue leather panels/.test(n)){m.metalness=0;m.roughness=.98;normal(.24);environment=.22;if(p)p.clearcoat=0;}
 else if(/woven protection|stretch racing textile|technical race suit/.test(n)){m.metalness=0;m.roughness=1;normal(.27);environment=.18;if(p)p.clearcoat=0;}
 else if(/rubber|saddle|leather|glove and boot/i.test(n)){m.metalness=0;m.roughness=.94;normal(.27);environment=.20;if(p)p.clearcoat=0;}
 else if(/Brushed titanium|satin hardware/.test(n)){m.metalness=.95;m.roughness=.85;normal(.22);environment=.90;}
 else if(/carbon composite/.test(n)){m.metalness=.08;m.roughness=.87;normal(.22);environment=.45;if(p){p.clearcoat=.28;p.clearcoatRoughness=.25;}}
 else if(/smoke optical visor|optical instrument shield/.test(n)){m.color.set('#c0d8df');m.opacity=.22;m.roughness=.065;m.metalness=.02;m.depthWrite=false;m.side=THREE.FrontSide;environment=.58;if(p){p.clearcoat=.86;p.clearcoatRoughness=.10;}}
 else if(/Warm facial skin/.test(n)){m.color.set('#bd937d');m.roughness=.58;m.metalness=0;environment=.18;if(p)p.specularIntensity=.35;}
 else if(/Ice navigation lens/.test(n)){m.emissive.set('#76e4ee');m.emissiveIntensity=.42;environment=.55;}
 else if(/Original LCD/.test(n)){m.emissive.set('#42aacb');m.emissiveIntensity=.12;environment=.35;}
 else if(/engineering polymer|graphite ceramic coating/.test(n)){m.roughness=.46;m.metalness=.08;environment=.42;if(p)p.clearcoat=.12;}
 m.userData.finishEnvironment=environment;
}
