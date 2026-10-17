import * as THREE from 'three';
export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#b0dbea'); scene.fog = new THREE.FogExp2('#b0dbea', 0.0011);
  scene.add(new THREE.HemisphereLight('#dcf7ff', '#22485a', 2.8));
  const sun = new THREE.DirectionalLight('#fff3d3', 3); sun.position.set(-100, 140, 100); scene.add(sun);
  // Authored whole-city modules supply the skyline instead of box placeholders.
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
