import * as THREE from 'three';
/** Original periodic capillary/ripple spectrum. Mipmaps suppress distant shimmer. */
export function waterNormalData(size=256){
 const data=new Uint8Array(size*size*4),waves=[[3,1,.12],[2,-5,.075],[7,4,.045],[-11,5,.024],[17,13,.012],[-23,9,.007]];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  let dx=0,dy=0;for(const [kx,ky,a]of waves){const c=Math.cos((x*kx+y*ky)/size*Math.PI*2+.7*kx);dx+=kx*a*c;dy+=ky*a*c;}
  const n=new THREE.Vector3(-dx*.36,-dy*.36,1).normalize(),i=(y*size+x)*4;data[i]=Math.round((n.x*.5+.5)*255);data[i+1]=Math.round((n.y*.5+.5)*255);data[i+2]=Math.round((n.z*.5+.5)*255);data[i+3]=255;
 }return data;
}
export function waterNormalTexture(){const texture=new THREE.DataTexture(waterNormalData(),256,256);texture.name='Original tiled water normal spectrum';texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;return texture;}
