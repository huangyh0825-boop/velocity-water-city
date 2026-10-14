import * as THREE from 'three';
export class Water {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private standard=new THREE.PlaneGeometry(2600,2600,160,160);
  private lightweight=new THREE.PlaneGeometry(2600,2600,64,64);
  constructor(scene: THREE.Scene) {
    this.material = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 },detail:{value:1} },
      vertexShader: `uniform float time; varying vec3 world; varying float wave;
        void main() { vec3 p = position; wave = sin(p.x*.055+p.y*.024+time*.9);
        p.z += wave*.065+sin(p.x*-.034+p.y*.061-time*.65)*.045; vec4 w = modelMatrix*vec4(p,1.); world=w.xyz;
        gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float time;uniform float detail;varying vec3 world;varying float wave;
        void main(){vec2 p=world.xz;
          vec2 slope=vec2(.7,.4)*cos(dot(p,vec2(.7,.4))+time*1.4)*.075
                   +vec2(-.35,.85)*cos(dot(p,vec2(-.35,.85))-time*.95)*.06;
          if(detail>.5){slope+=vec2(1.6,-.55)*cos(dot(p,vec2(1.6,-.55))+time*2.)*.032;
            slope+=vec2(.23,.18)*cos(dot(p,vec2(.23,.18))-time*.65)*.13;}
          vec3 normal=normalize(vec3(-slope.x,1.,-slope.y));
          vec3 view=normalize(cameraPosition-world),sun=normalize(vec3(-.45,.8,.4));
          float fresnel=pow(1.-max(0.,dot(normal,view)),3.);
          float light=max(0.,dot(normal,sun));
          float broad=sin(dot(p,vec2(.042,-.03))+time*.38)*.5+.5;
          vec3 col=mix(vec3(.012,.15,.23),vec3(.026,.29,.38),broad*.55+light*.35);
          col=mix(col,vec3(.15,.43,.58),fresnel*.45);
          col+=vec3(1.,.94,.78)*pow(max(0.,dot(reflect(-sun,normal),view)),85.)*.65;
          float fog=1.-exp(-length(cameraPosition-world)*.0015);col=mix(col,vec3(.50,.74,.83),fog);
          gl_FragColor=vec4(col,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(this.standard, this.material);
    this.mesh.rotation.x = -Math.PI / 2; scene.add(this.mesh);
  }
  update(time: number) { this.material.uniforms.time.value = time; }
  setLow(low:boolean){this.mesh.geometry=low?this.lightweight:this.standard;this.material.uniforms.detail.value=low?0:1;}
  dispose(){this.standard.dispose();this.lightweight.dispose();this.material.dispose();}
}
