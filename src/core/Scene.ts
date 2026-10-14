import * as THREE from 'three';
export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#b0dbea'); scene.fog = new THREE.FogExp2('#b0dbea', 0.0011);
  scene.add(new THREE.HemisphereLight('#dcf7ff', '#22485a', 2.8));
  const sun = new THREE.DirectionalLight('#fff3d3', 3); sun.position.set(-100, 140, 100); scene.add(sun);
  const buildings = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#9bb9c9', metalness: 0.35, roughness: 0.6 }), 100);
  const crowns = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#69e4e8' }), 100);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 100; i++) {
    const angle = i / 100 * Math.PI * 2;
    const radius = 880 + Math.sin(i * 7.3) * 80;
    const height = 25 + (Math.sin(i * 13.7) * 0.5 + 0.5) * 115;
    const width = 14 + (i % 4) * 5;
    dummy.position.set(Math.sin(angle) * radius, height / 2 - 2, Math.cos(angle) * radius);
    dummy.scale.set(width, height, width); dummy.rotation.y = angle; dummy.updateMatrix(); buildings.setMatrixAt(i, dummy.matrix);
    dummy.position.y = height; dummy.scale.set(width + 0.4, 1.5, width + 0.4); dummy.updateMatrix(); crowns.setMatrixAt(i, dummy.matrix);
  }
  scene.add(buildings, crowns);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(1500,24,12),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
    vertexShader:`varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 direction;void main(){vec3 d=normalize(direction);
      vec3 col=mix(vec3(.65,.82,.89),vec3(.13,.44,.69),smoothstep(0.,.8,d.y));
      float sun=dot(d,normalize(vec3(-.45,.8,.4)));col+=vec3(.9,.82,.65)*pow(max(0.,sun),800.);
      gl_FragColor=vec4(col,1.);
      #include <colorspace_fragment>
    }`}));sky.name='clear-day-sky';scene.add(sky);
  return scene;
}
