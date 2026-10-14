import * as THREE from 'three';import {CityTrack} from '../track/CityTrack';
export class CityDistricts {
 readonly root=new THREE.Group();readonly details=new THREE.Group();
 constructor(scene:THREE.Scene,readonly track:CityTrack){this.root.add(this.details);scene.add(this.root);}
 setLow(low:boolean){this.details.visible=!low;}
}
