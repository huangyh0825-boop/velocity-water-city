import * as THREE from 'three';
/** Original periodic capillary/ripple spectrum. Mipmaps suppress distant shimmer. */
export function waterNormalData(size=256){
 const data=new Uint8Array(size*size*4);
 const waves=Array.from({length:28},(_,i)=>{
  const angle=i*2.3999632297,k=3+(i%7)*3;
  return[Math.round(Math.cos(angle)*k),Math.round(Math.sin(angle)*k),.24/Math.pow(k,1.22),i*1.6180339887];
 });
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  let dx=0,dy=0;for(const [kx,ky,a,phase]of waves){const c=Math.cos((x*kx+y*ky)/size*Math.PI*2+phase);dx+=kx*a*c;dy+=ky*a*c;}
  const n=new THREE.Vector3(-dx*.36,-dy*.36,1).normalize(),i=(y*size+x)*4;data[i]=Math.round((n.x*.5+.5)*255);data[i+1]=Math.round((n.y*.5+.5)*255);data[i+2]=Math.round((n.z*.5+.5)*255);data[i+3]=255;
 }return data;
}
export function waterNormalTexture(){const texture=new THREE.DataTexture(waterNormalData(),256,256);texture.name='Original tiled water normal spectrum';texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;return texture;}
