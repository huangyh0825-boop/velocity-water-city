import * as THREE from 'three';

/** Rounded metal perimeter; readable front/back surfaces retain their own UVs. */
export class ScreenHousing {
 readonly root=new THREE.Group();
 private material=new THREE.MeshStandardMaterial({color:'#34444e',metalness:.75,roughness:.42});
 constructor(){this.root.name='sample-screen-housings';}
 add(width:number,height:number,position:THREE.Vector3,heading:number){
  const outline=(w:number,h:number,r:number)=>{
   const s=new THREE.Shape(),x=-w/2,y=-h/2;
   s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;
  };
  const shape=outline(width+.32,height+.32,.16);shape.holes.push(new THREE.Path(outline(width-.02,height-.02,.035).getPoints(3)));
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.26,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.025,bevelThickness:.025,curveSegments:3});geometry.translate(0,0,-.13);
  const frame=new THREE.Mesh(geometry,this.material);frame.position.copy(position);frame.rotation.y=heading;frame.castShadow=frame.receiveShadow=true;this.root.add(frame);
 }
 dispose(){for(const child of this.root.children)(child as THREE.Mesh).geometry.dispose();this.material.dispose();this.root.removeFromParent();}
}
