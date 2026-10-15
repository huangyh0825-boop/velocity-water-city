import * as THREE from 'three';
import {waterNormalTexture} from './WaterNormals';
export class Water {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private standard=new THREE.PlaneGeometry(2600,2600,160,160);
  private lightweight=new THREE.PlaneGeometry(2600,2600,64,64);
  private normals=waterNormalTexture();private reflection?:THREE.WebGLCubeRenderTarget;private low=false;private capturing=false;
  constructor(scene: THREE.Scene) {
    this.material = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 },detail:{value:1},ripples:{value:this.normals},cityReflection:{value:null},hasReflection:{value:0},reflectionOrigin:{value:new THREE.Vector3()} },
      vertexShader: `uniform float time; varying vec3 world; varying float wave;
        void main() { vec3 p = position; wave = sin(p.x*.055+p.y*.024+time*.9);
        p.z += wave*.065+sin(p.x*-.034+p.y*.061-time*.65)*.045; vec4 w = modelMatrix*vec4(p,1.); world=w.xyz;
        gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float time;uniform float detail;uniform sampler2D ripples;uniform samplerCube cityReflection;uniform float hasReflection;uniform vec3 reflectionOrigin;varying vec3 world;varying float wave;
        void main(){vec2 p=world.xz;
          float distanceToEye=length(cameraPosition-world),nearDetail=1.-smoothstep(45.,180.,distanceToEye);
          vec2 slope=vec2(.7,.4)*cos(dot(p,vec2(.7,.4))+time*1.4)*.045
                   +vec2(-.35,.85)*cos(dot(p,vec2(-.35,.85))-time*.95)*.045;
          vec3 n1=texture2D(ripples,p*.055+vec2(time*.012,time*-.008)).xyz*2.-1.;
          slope+=n1.xy*.38;
          if(detail>.5){vec3 n2=texture2D(ripples,p*.135+vec2(time*-.019,time*.011)).xyz*2.-1.;slope+=n2.xy*.23*nearDetail;}
          vec3 normal=normalize(vec3(-slope.x,1.,-slope.y));
          vec3 view=normalize(cameraPosition-world),sun=normalize(vec3(-.45,.8,.4));
          float fresnel=.02+.98*pow(1.-max(0.,dot(normal,view)),5.);
          float light=max(0.,dot(normal,sun));
          float broad=sin(dot(p,vec2(.026,-.018))+time*.20)*.5+.5;
          float crossed=sin(dot(p,vec2(-.044,.031))-time*.15)*.5+.5;
          vec3 col=mix(vec3(.018,.19,.235),vec3(.035,.34,.38),broad*.48+crossed*.14+light*.19);
          vec3 reflected=reflect(-view,normal);vec3 sky=mix(vec3(.46,.66,.72),vec3(.09,.30,.47),smoothstep(0.,.75,reflected.y));
          if(hasReflection>.5){float local=1.-smoothstep(180.,360.,length(world.xz-reflectionOrigin.xz));vec3 city=textureCube(cityReflection,reflected).rgb;sky=mix(sky,city,local*.48);}
          col=mix(col,sky,clamp(fresnel*.66,0.,.78));
          float glint=pow(max(0.,dot(reflect(-sun,normal),view)),detail>.5?155.:90.);
          col+=vec3(1.,.92,.76)*glint*.58;
          col+=vec3(.035,.07,.055)*pow(max(0.,dot(-view,sun)),3.)*(.4+wave*.2);
          float fog=1.-exp(-length(cameraPosition-world)*.0015);col=mix(col,vec3(.50,.74,.83),fog);
          gl_FragColor=vec4(col,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(this.standard, this.material);
    this.mesh.rotation.x = -Math.PI / 2; scene.add(this.mesh);
    // One 128px static district cubemap, no reflection pass during normal driving.
    this.mesh.onBeforeRender=(renderer)=>{
      const district=scene.getObjectByName('blender-waterfront-sample');
      if(this.low||this.reflection||this.capturing||!district?.children.length)return;
      const hidden:THREE.Object3D[]=[];
      for(const child of scene.children){let racer=false;child.traverse(o=>{if(o instanceof THREE.SkinnedMesh)racer=true;});if(racer&&child.visible)hidden.push(child);}
      if(hidden.length<5)return;
      this.capturing=true;hidden.forEach(o=>o.visible=false);
      const target=new THREE.WebGLCubeRenderTarget(128,{generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
      const camera=new THREE.CubeCamera(2,700,target);camera.position.copy(district.position);camera.position.y=1.4;
      this.mesh.visible=false;
      try{camera.update(renderer,scene);this.reflection=target;this.material.uniforms.cityReflection.value=target.texture;this.material.uniforms.reflectionOrigin.value.copy(camera.position);this.material.uniforms.hasReflection.value=1;}
      finally{this.mesh.visible=true;hidden.forEach(o=>o.visible=true);this.capturing=false;if(!this.reflection)target.dispose();}
    };
  }
  update(time: number) { this.material.uniforms.time.value = time; }
  setLow(low:boolean){this.low=low;this.mesh.geometry=low?this.lightweight:this.standard;this.material.uniforms.detail.value=low?0:1;this.material.uniforms.hasReflection.value=low?0:this.reflection?1:0;}
  dispose(){this.standard.dispose();this.lightweight.dispose();this.normals.dispose();this.reflection?.dispose();this.material.dispose();}
}
