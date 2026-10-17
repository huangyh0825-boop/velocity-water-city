import * as THREE from 'three';
import { Track, TAU } from './Track';
import { glassFacade } from '../environment/CityEnvironment';
import {CityTrack} from './CityTrack';
import {CityTrackView} from './CityTrackView';
export class TrackView {
  private gates: THREE.MeshBasicMaterial[] = [];
  private highlighted = -1;
  private splineView?:CityTrackView;
  constructor(scene: THREE.Scene, track: Track) {
    if(track instanceof CityTrack){this.splineView=new CityTrackView(scene,track);return;}
    const segments = 160;
    const wall = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#29465b', metalness: 0.5, roughness: 0.5 }), segments * 2);
    const rim = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#68dce7' }), segments * 2);
    const dummy = new THREE.Object3D();
    for (let side = 0; side < 2; side++) for (let i = 0; i < segments; i++) {
      const angle = (i + 0.5) / segments * TAU;
      const radius = track.radius + (side ? 1 : -1) * (track.halfWidth + 1);
      dummy.position.set(Math.cos(angle) * radius, 0.7, Math.sin(angle) * radius);
      dummy.rotation.y = -angle; dummy.scale.set(2, 2.2, radius * TAU / segments + 0.1);
      dummy.updateMatrix(); wall.setMatrixAt(side * segments + i, dummy.matrix);
      dummy.position.y = 1.84; dummy.scale.y = 0.08; dummy.updateMatrix(); rim.setMatrixAt(side * segments + i, dummy.matrix);
    }
    scene.add(wall, rim);
    const island = new THREE.Mesh(new THREE.CylinderGeometry(76, 80, 4, 64), new THREE.MeshStandardMaterial({ color: '#afc5ce', roughness: 0.8 }));
    island.position.y = 0; scene.add(island);
    const city = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#d9eef7',map:glassFacade(), metalness: 0.18, roughness: 0.3 }), 28);
    const roofs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#a6f5f2' }), 28);
    for (let i = 0; i < 28; i++) {
      const angle = i / 28 * TAU, radius = 35 + (i % 3) * 14, height = 14 + (i * 7 % 37);
      dummy.position.set(Math.cos(angle) * radius, height / 2 + 2, Math.sin(angle) * radius);
      dummy.rotation.y = -angle; dummy.scale.set(9, height, 12); dummy.updateMatrix(); city.setMatrixAt(i, dummy.matrix);
      dummy.position.y = height + 2; dummy.scale.y = 0.2; dummy.updateMatrix(); roofs.setMatrixAt(i, dummy.matrix);
    }
    scene.add(city, roofs);
    // Checkpoint gates are logical only; never regenerate suspended CP panels.
    // Lightweight arrows show the intended travel direction on the water.
    const arrowGeometry = new THREE.BufferGeometry();
    arrowGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
      -1.4, -1, 0, 0, 1.5, 0, 0, -0.2, 0,
      0, -0.2, 0, 0, 1.5, 0, 1.4, -1, 0,
    ], 3));
    const arrows = new THREE.InstancedMesh(arrowGeometry, new THREE.MeshBasicMaterial({ color: '#b3eef1', transparent: true, opacity: 0.5, side: THREE.DoubleSide }), 32);
    for (let i = 0; i < 32; i++) {
      const angle = i / 32 * TAU, point = track.point(angle);
      dummy.position.set(point.x, 0.24, point.z); dummy.rotation.set(-Math.PI / 2, 0, Math.PI - angle); dummy.scale.setScalar(1.5); dummy.updateMatrix(); arrows.setMatrixAt(i, dummy.matrix);
    }
    scene.add(arrows);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(track.halfWidth * 2, 1.2), new THREE.MeshBasicMaterial({ color: '#fff2cb', transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    line.rotation.x = -Math.PI / 2; line.position.set(track.radius, 0.26, 0); scene.add(line);
  }
  highlight(index: number) {
    if(this.splineView){this.splineView.highlight(index);return;}
    if (this.highlighted === index) return;
    this.gates.forEach((material, i) => material.color.set(i === index ? '#97fff2' : i === 0 ? '#ffe4a0' : '#547d90'));
    this.highlighted = index;
  }
}
