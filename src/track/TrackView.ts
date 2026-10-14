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
    for (let i = 0; i < track.checkpointCount; i++) {
      const group = new THREE.Group(), angle = track.checkpointAngle(i), point = track.point(angle);
      group.position.set(point.x, 0, point.z); group.rotation.y = track.heading(angle);
      const glow = new THREE.MeshBasicMaterial({ color: i === 0 ? '#ffe4a0' : '#547d90' }); this.gates.push(glow);
      for (const side of [-1, 1]) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(1, 14.6, 1.2), new THREE.MeshStandardMaterial({ color: '#345b73' }));
        pillar.position.set(side * track.halfWidth, 7, 0); group.add(pillar);
        const light = new THREE.Mesh(new THREE.BoxGeometry(0.15, 11.5, 1.3), glow); light.position.set(side * (track.halfWidth - 0.55), 7, 0); group.add(light);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(track.halfWidth * 2 + 1, 0.5, 1.2), glow); beam.position.y = 14.2; group.add(beam);
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#10364b'; ctx.fillRect(0, 0, 512, 96);
      ctx.fillStyle = '#ecfcff'; ctx.font = 'bold 42px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(i === 0 ? 'START / FINISH' : `CHECKPOINT 0${i}`, 256, 63);
      const labelGeometry = new THREE.PlaneGeometry(12, 2.25);
      const labelMaterial = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas) });
      for (const side of [-1, 1]) {
        const label = new THREE.Mesh(labelGeometry, labelMaterial);
        label.position.set(0, 12.8, side * 0.65); label.rotation.y = side === -1 ? Math.PI : 0; group.add(label);
      }
      scene.add(group);
    }
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
