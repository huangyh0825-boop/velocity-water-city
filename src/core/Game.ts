import * as THREE from 'three';
import { createScene } from './Scene';
import { Watercraft } from '../player/Watercraft';
import { FollowCamera } from '../camera/FollowCamera';
import { InputController } from '../controls/InputController';
import { Water } from '../effects/Water';
import { Wake } from '../effects/Wake';
import { Hud } from '../ui/Hud';
import { Track } from '../track/Track';
import { CityTrack } from '../track/CityTrack';
import { TrackView } from '../track/TrackView';
import {createCityOpponents} from '../ai/CityOpponents';
import type{AIController}from'../ai/AIController';
import{NetworkRaceSession,onlinePeers,type OnlineGameOptions}from'../gameplay/NetworkRaceSession';
import{onlineRacerColor}from'../gameplay/RacerColors';
import{LocalRaceSession,IDLE_COMMAND}from'../gameplay/LocalRaceSession';
import{LocalRaceControls}from'../controls/LocalRaceControls';
import{trainingOptions,type TrainingOptions,type TrainingRun}from'../modes/TrainingOptions';
import { MotionInterpolation } from '../player/MotionInterpolation';
import { BoatCollisions, type BoatBody } from '../physics/BoatCollisions';
import { FlightController } from '../player/FlightController';
import { Ramps } from '../track/Ramps';
import { TrickController } from '../player/TrickController';
import { NitroController } from '../player/NitroController';
import { BoosterJet } from '../effects/BoosterJet';
import { Spray } from '../effects/Spray';
import { EventLimiter } from '../effects/EventLimiter';
import { AudioController } from '../audio/AudioController';
import { RampDebug } from '../debug/RampDebug';
import { CityEnvironment } from '../environment/CityEnvironment';
import {CityDistricts} from '../environment/CityDistricts';
import {CitySample} from '../environment/CitySample';
import { CountdownCue } from '../audio/CountdownCue';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {distanceGain} from '../audio/AudioMix';
import {HeroLighting} from '../player/HeroLighting';
import {VerticalTrackView} from '../track/VerticalTrackView';
import {LoadingScreen} from '../ui/LoadingScreen';
import {CameraObstacles} from '../camera/CameraObstacles';
import {yieldToBrowser} from './yieldToBrowser';
import {RenderPassMaterials} from './RenderPassMaterials';
import {watchAssetActivity,assetWaitExpired} from './AssetActivity';
import {renderQuality,renderPixelRatio} from './RenderQuality';
import {cacheStaticTransforms} from './StaticTransforms';
export interface GameOptions extends Partial<TrainingOptions>{online?:OnlineGameOptions;playerId?:string;onHome?:()=>void;onRunStart?:()=>void;onRunEnd?:(run:TrainingRun)=>void}
export class Game {
  readonly ready:Promise<void>;
  private initialized=false;private disposed=false;
  private releaseAssetActivity=watchAssetActivity();
  private renderer: THREE.WebGLRenderer;
  private renderPassMaterials:RenderPassMaterials;
  private scene = createScene();
  private track = new CityTrack();
  private city=new CityDistricts(this.scene,this.track);
  private citySample=new CitySample(this.scene,this.track,loaded=>this.city.setSampleLoaded(loaded));
  private trackView = new TrackView(this.scene, this.track);
  private craft:Watercraft;
  private flight = new FlightController();
  private tricks = new TrickController();
  private nitro = new NitroController();
  private jet:BoosterJet;
  private ramps = new Ramps(this.track, this.scene);
  private craftMotion:MotionInterpolation;
  private ai:AIController[];
  private aiCraft:Watercraft[];
  private aiJets:BoosterJet[];
  private aiMotion:MotionInterpolation[];
  private collisions = new BoatCollisions();
  private bodies:BoatBody[];
  private session:LocalRaceSession|NetworkRaceSession;
  markOnlineLoaded(){if(this.session instanceof NetworkRaceSession)this.session.markLoaded();}
  private get race(){return this.session.race;}
  private runStarted=false;private runRecorded=false;
  private camera = new FollowCamera();
  private mobile=matchMedia('(pointer: coarse)').matches;
  private qualityProfile=renderQuality(this.mobile,false);
  private heroLighting=new HeroLighting(2,this.qualityProfile.racerShadowSize);
  private aiLighting:HeroLighting[];
  private input = new InputController();
  private controls=new LocalRaceControls(this.input);
  private water = new Water(this.scene);
  private verticalView=new VerticalTrackView(this.scene,this.track,this.water);
  private wake = new Wake(this.scene);
  private spray = new Spray(this.scene);
  private impactLimiter = new EventLimiter();
  private audio = new AudioController();
  private countdownCue=new CountdownCue();
  private activateAudio = () => { void this.audio.unlock(); };
  private hud: Hud;
  private debug:RampDebug;
  private previous = 0; private accumulator = 0; private time = 0;
  private paused = document.hidden; private low = false; private wallContact = false;
  private frameId = 0;
  private reflection?:THREE.WebGLRenderTarget;
  constructor(private root: HTMLElement,private loading=new LoadingScreen(root),private options:GameOptions={}) {
    this.craft=new Watercraft(this.scene,options.online?onlineRacerColor(options.online.race,options.online.memberId):'#126bba');
    this.jet=new BoosterJet(this.craft.visual);this.craftMotion=new MotionInterpolation(this.craft.model);
    const config=trainingOptions(options);this.ai=options.online?onlinePeers(this.track,options.online):createCityOpponents(this.track,config.difficulty);
    this.aiCraft=this.ai.map((ai,i)=>{const craft=new Watercraft(this.scene,options.online?onlineRacerColor(options.online.race,ai.id):['#ee7953','#a583ed','#f6cc61','#55c8a2'][i],ai.model);craft.rider.root.name='ai-rider';return craft;});
    this.aiJets=this.aiCraft.map(c=>new BoosterJet(c.visual));this.aiMotion=this.ai.map(a=>new MotionInterpolation(a.model));this.aiLighting=this.aiCraft.map((_,i)=>new HeroLighting(3+i,this.qualityProfile.racerShadowSize));
    this.bodies=[{id:'player',model:this.craft.model},...this.ai.map(a=>({id:a.id,model:a.model}))];
    const state={track:this.track,player:this.craft.model,flight:this.flight,tricks:this.tricks,nitro:this.nitro,ai:this.ai,ramps:this.ramps,collisions:this.collisions,bodies:this.bodies};
    this.session=options.online?new NetworkRaceSession({...state,ai:[],bodies:[state.bodies[0]]},this.ai,options.online):new LocalRaceSession(state,config,options.playerId??'你 / PLAYER');
    loading.begin('renderer');
    this.water.bindWake(this.wake.pool);this.wake.setSurfaceIntegrated(true);
    this.renderer = new THREE.WebGLRenderer({ antialias: !matchMedia('(pointer: coarse)').matches, stencil:true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderPassMaterials=new RenderPassMaterials(this.renderer);
    this.renderer.autoClear = true; // Clear every frame; no history accumulation or motion blur.
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.citySample.configureSun(this.scene);
    const sun=this.scene.children.find(o=>o instanceof THREE.DirectionalLight) as THREE.DirectionalLight|undefined;
    sun?.shadow.mapSize.set(this.qualityProfile.cityShadowSize,this.qualityProfile.cityShadowSize);
    this.water.setBudget(this.qualityProfile.waterSegments,this.qualityProfile.reflectionSize);
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=.95;
    const generator=new THREE.PMREMGenerator(this.renderer),room=new RoomEnvironment();this.reflection=generator.fromScene(room,.04);this.scene.environment=this.reflection.texture;room.dispose();generator.dispose();
    this.renderer.domElement.className = 'game-canvas';
    this.renderer.domElement.setAttribute('aria-label', '3D 城市水道竞速场景');
    root.append(this.renderer.domElement);
    loading.complete('renderer');loading.complete('track');
    this.ai.forEach(ai=>ai.setRamps(this.ramps));
    this.restart();
    this.hud = new Hud(root, this.input, this.restart, this.recover, low => { if(this.low===low)return;this.low = low;this.qualityProfile=renderQuality(this.mobile,low); this.spray.setLow(low);this.wake.setLow(low);this.water.setLow(low);this.water.setBudget(this.qualityProfile.waterSegments,this.qualityProfile.reflectionSize);this.city.setLow(low);void this.citySample.setLow(low).then(()=>this.citySample.bakeReflections(this.renderer,this.scene));this.renderer.shadowMap.enabled=!low;void this.craft.setQuality(low);this.aiCraft.forEach(c=>void c.setQuality(low)); this.resize(); },this.audio,options.onHome,!!options.online);
    this.debug=new RampDebug(root);this.ramps.onDecision=value=>this.debug.record(value);
    window.addEventListener('pointerdown',this.activateAudio);
    window.addEventListener('keydown',this.activateAudio);
    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', this.visibility);
    this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost);
    this.resize(); this.camera.update(0, this.craft.model, true);
    this.ready=this.initialize().catch(error=>{if(!this.disposed){this.loading.fail(error);console.error('Game startup failed',error);}throw error;});
    // Consumers may await ready; also handle rejection when embedded without a host.
    void this.ready.catch(()=>{});
    this.frameId = requestAnimationFrame(this.frame);
  }
  private async initialize(){
    const startupStarted=performance.now(),racers=[this.craft,...this.aiCraft];
    const wait=async(check:()=>boolean,error:()=>string)=>{
      while(!check()){
        if(this.disposed)throw Error('启动已取消');const reason=error()||racers.find(c=>c.assetError)?.assetError;if(reason)throw Error(reason);
        if(assetWaitExpired(startupStarted))throw Error('资源下载长时间没有进展，请检查网络后重试');
        await new Promise(resolve=>setTimeout(resolve,40));
      }
    };
    this.loading.begin('city');await wait(()=>this.citySample.loaded,()=>this.citySample.error||this.citySample.density.error);this.loading.complete('city');
    this.loading.begin('racers');await wait(()=>racers.every(c=>c.assetLoaded),()=>racers.map(c=>c.assetError).find(Boolean)??'');this.loading.complete('racers');
    this.loading.begin('textures');const textures=new Set<THREE.Texture>();
    this.scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points)for(const m of Array.isArray(o.material)?o.material:[o.material]){
      for(const value of Object.values(m))if(value instanceof THREE.Texture)textures.add(value);
      if(m instanceof THREE.ShaderMaterial)for(const uniform of Object.values(m.uniforms))if(uniform.value instanceof THREE.Texture)textures.add(uniform.value);
    }});
    textures.add(this.citySample.density.glass.atlas);let uploadStart=performance.now();
    for(const texture of textures){this.renderer.initTexture(texture);if(performance.now()-uploadStart>8){await yieldToBrowser();if(this.disposed)return;uploadStart=performance.now();}}this.loading.complete('textures');
    this.loading.begin('effects');this.water.update(0);racers.forEach(c=>c.sync(0));this.loading.complete('effects');
    this.loading.begin('shaders');await yieldToBrowser();
    this.citySample.density.enableBatches(this.renderer);
    cacheStaticTransforms(this.citySample.root);cacheStaticTransforms(this.city.root);cacheStaticTransforms(this.verticalView.root);
    const jets=[this.jet,...this.aiJets];jets.forEach(j=>j.object.visible=true);
    let timeout:ReturnType<typeof setTimeout>|undefined;
    try{await Promise.race([this.renderer.compileAsync(this.scene,this.camera.camera),new Promise<never>((_,reject)=>{timeout=setTimeout(()=>reject(Error('Shader 初始化超时，请确认硬件加速可用后重试')),90000);})]);}finally{clearTimeout(timeout);jets.forEach(j=>j.object.visible=false);}
    this.loading.complete('shaders');
    this.loading.begin('reflection');await yieldToBrowser();await this.citySample.bakeReflections(this.renderer,this.scene);this.loading.complete('reflection');
    if(!this.low){this.heroLighting.update(this.renderer,this.scene,this.craft.visual);this.aiCraft.forEach((c,i)=>this.aiLighting[i].update(this.renderer,this.scene,c.visual));}
    await this.renderer.compileAsync(this.scene,this.camera.camera);await yieldToBrowser();this.renderer.render(this.scene,this.camera.camera);
    this.loading.begin('scene');if(this.disposed)return;this.camera.obstacles=CameraObstacles.from(this.track,this.citySample.density.sites,this.scene);this.restart();this.initialized=true;this.previous=0;this.accumulator=0;
    this.hud.update(this.craft.model,this.race,false,this.nitro,this.flight,this.tricks,this.session instanceof NetworkRaceSession?this.session.message:undefined);this.loading.complete('scene');this.loading.finish();
  }
  private restart = () => {
    this.recordRun();this.runStarted=this.runRecorded=false;this.input.clear();this.session.restart();
    this.spray.reset(); this.impactLimiter.reset();
    this.audio.reset();
    this.countdownCue.reset();
    this.debug?.reset();
    this.craftMotion.reset(); this.aiMotion.forEach(motion => motion.reset());
    this.wake.reset(); this.wallContact = false; this.accumulator = 0; this.previous = 0;
    this.camera.update(0, this.craft.model, true);
  };
  private recover = () => {
    if(!this.session.recover())return;this.input.clear();
    this.spray.reset();
    this.craftMotion.reset();
    this.wake.reset(); this.wallContact = false;
    this.camera.update(0, this.craft.model, true,this.flight.height,false,this.track.surface(this.craft.model).height);
  };
  private resize = () => {
    const width = this.root.clientWidth, height = this.root.clientHeight;
    this.renderer.setPixelRatio(renderPixelRatio(this.qualityProfile,devicePixelRatio,width,height));
    this.renderer.setSize(width, height); this.camera.resize(width, height);
  };
  private visibility = () => { this.paused = document.hidden;if(this.paused)this.saveProgress(); this.audio.setPaused(this.paused); this.input.clear(); this.previous = 0; this.accumulator = 0; this.craftMotion.reset(); this.aiMotion.forEach(motion => motion.reset()); };
  private contextLost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(this.frameId); this.root.insertAdjacentHTML('beforeend', '<div class="error">图形连接中断，请刷新页面重新比赛。</div>'); };
  private recordRun(){if(this.runStarted&&!this.runRecorded){this.runRecorded=true;this.options.onRunEnd?.(this.session.summary());}}
  saveProgress(){if(this.runStarted&&!this.runRecorded)this.options.onRunEnd?.(this.session.summary());}
  private frame = (now: number) => {
    this.frameId = requestAnimationFrame(this.frame);
    if (this.paused||!this.initialized) return;
    const dt = this.previous ? Math.min((now - this.previous) / 1000, 0.1) : 0;
    this.previous = now; this.accumulator += dt;
    const input = this.input.state, step = 1 / 60;
    while (this.accumulator >= step) {
      const canDrive = this.race.phase === 'racing';
      if(canDrive){this.craftMotion.capture();this.aiMotion.forEach(m=>m.capture());}
      const result=this.session.step(step,canDrive?this.controls.sample(input):IDLE_COMMAND);
      if(result.started&&!this.runStarted){this.runStarted=true;this.options.onRunStart?.();}
      this.wallContact=result.wallContact;
      const cue=this.session instanceof NetworkRaceSession&&this.session.message?null:this.countdownCue.update(this.race.phase,this.race.countdown);if(cue!==null)this.audio.countdown(cue);
      if (canDrive) {
        this.ai.forEach(ai=>{
          const volume=distanceGain(Math.hypot(ai.model.x-this.craft.model.x,ai.model.z-this.craft.model.z,ai.flight.height-this.flight.height))*.55;
          if(ai.flight.takeoff){this.spray.burst(ai.model.x,ai.model.z,ai.model.speed*.65,'takeoff',ai.flight.height);this.audio.event('takeoff',ai.model.speed,volume);}
          if(ai.flight.landed&&Math.abs(ai.flight.height-this.track.surface(ai.model).height)<.3){this.spray.burst(ai.model.x,ai.model.z,ai.flight.landingSpeed,'landing',ai.flight.height);this.audio.event('landing',ai.flight.landingSpeed,volume);}
          else if(ai.flight.landed)this.audio.event('collision',ai.flight.landingSpeed,volume);
        });
        this.ai.forEach((ai,i)=>{if(ai.flight.landed)this.aiCraft[i].land();});
        for(const event of this.collisions.events) if(event.strength>2 && this.impactLimiter.accept(event.key,this.time)) {if(Math.abs(event.height-this.track.surface(event).height)<1.2)this.spray.burst(event.x,event.z,event.strength,'collision',event.height);this.audio.event('collision',event.strength,distanceGain(Math.hypot(event.x-this.craft.model.x,event.z-this.craft.model.z,event.height-this.flight.height)));}
        if(this.flight.takeoff) {this.spray.burst(this.craft.model.x,this.craft.model.z,this.craft.model.speed,'takeoff',this.flight.height);this.audio.event('takeoff',this.craft.model.speed);}
        if(this.flight.landed) {
          this.craft.land();
          const waterLanding=Math.abs(this.flight.height-this.track.surface(this.craft.model).height)<.3;
          if(waterLanding)this.spray.burst(this.craft.model.x,this.craft.model.z,this.flight.landingSpeed,'landing',this.flight.height);
          this.audio.event(waterLanding?'landing':'collision',this.flight.landingSpeed);
        }
        if (result.finished) {this.recordRun();this.input.clear();this.craftMotion.reset();this.aiMotion.forEach(motion=>motion.reset());}
      }
      const waterSources=[{id:'player',model:this.craft.model,grounded:canDrive&&Math.abs(this.flight.height-this.track.surface(this.craft.model).height)<.3&&!this.flight.airborne,height:this.flight.height},
        ...this.ai.map(ai=>({id:ai.id,model:ai.model,grounded:canDrive&&Math.abs(ai.flight.height-this.track.surface(ai.model).height)<.3&&!ai.flight.airborne,height:ai.flight.height,weight:.65}))];
      this.wake.updateAll(step,waterSources);this.spray.updateAll(step,waterSources);
      this.time += step; this.accumulator -= step;
    }
    const displayTime = this.time + this.accumulator;
    if(this.session instanceof NetworkRaceSession&&this.session.consumeCorrection())this.craftMotion.reset();
    const displayModel = this.craftMotion.sample(this.accumulator / step);
    if(this.session instanceof NetworkRaceSession)this.session.applyVisualOffset(displayModel);
    const ground=this.track.surface(this.craft.model).height;
    this.craft.sync(displayTime, displayModel, this.flight.displayHeight(this.accumulator / step), this.tricks.rotation,ground,this.flight.airborne?0:this.ramps.slope(this.craft.model));
    this.aiCraft.forEach((craft, i) => craft.sync(displayTime, this.aiMotion[i].sample(this.accumulator / step),this.ai[i].flight.displayHeight(this.accumulator/step),this.session instanceof NetworkRaceSession?this.session.rotation(this.ai[i].id):this.ai[i].tricks.rotation,this.track.surface(this.ai[i].model).height,this.ai[i].flight.airborne?0:this.ramps.slope(this.ai[i].model)));
    this.jet.update(displayTime,this.nitro.active);
    this.aiJets.forEach((jet,i)=>jet.update(displayTime,this.ai[i].nitro.active));
    this.audio.update({speed:this.craft.model.speed,throttle:input.throttle,boost:this.nitro.active,grounded:!this.flight.airborne&&Math.abs(this.flight.height-ground)<.3,airborne:this.flight.airborne,running:this.race.phase==='racing'});
    this.audio.updateAI(this.ai.map(ai=>{const dx=ai.model.x-this.craft.model.x,dz=ai.model.z-this.craft.model.z,distance=Math.hypot(dx,dz,ai.flight.height-this.flight.height);return{id:ai.id,speed:ai.model.speed,throttle:1,boost:ai.nitro.active,airborne:ai.flight.airborne,grounded:!ai.flight.airborne&&Math.abs(ai.flight.height-this.track.surface(ai.model).height)<.3,running:this.race.phase==='racing',distance,pan:(dx*Math.cos(this.craft.model.heading)-dz*Math.sin(this.craft.model.heading))/Math.max(10,distance)};}));
    this.water.update(displayTime);this.camera.update(dt, displayModel,false,this.flight.displayHeight(this.accumulator/step),this.nitro.active,ground);this.citySample.update(displayTime,this.camera.camera);
    this.trackView.highlight(this.race.nextCheckpoint());
    this.hud.update(this.craft.model, this.race, this.wallContact,this.nitro,this.flight,this.tricks,this.session instanceof NetworkRaceSession?this.session.message:undefined);
    if(!this.low&&this.craft.assetLoaded)this.heroLighting.update(this.renderer,this.scene,this.craft.visual);
    if(!this.low)this.aiCraft.forEach((craft,i)=>{if(craft.assetLoaded)this.aiLighting[i].updateVisible(this.renderer,this.scene,craft.visual,this.camera.camera);});
    this.renderer.render(this.scene, this.camera.camera);
  };
  dispose() {
    this.recordRun();
    this.disposed=true;if(this.session instanceof NetworkRaceSession)this.session.dispose();
    this.releaseAssetActivity();
    this.renderPassMaterials.dispose();
    this.heroLighting.dispose();this.aiLighting.forEach(light=>light.dispose());
    this.citySample.dispose();
    this.craft.dispose();this.aiCraft.forEach(c=>c.dispose());this.reflection?.dispose();
    cancelAnimationFrame(this.frameId); this.input.dispose();
    this.debug.dispose();
    window.removeEventListener('pointerdown',this.activateAudio);window.removeEventListener('keydown',this.activateAudio);this.audio.dispose();
    window.removeEventListener('resize', this.resize); document.removeEventListener('visibilitychange', this.visibility);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost);
    this.scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Points) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(material => { const map = (material as THREE.MeshBasicMaterial).map; map?.dispose(); material.dispose(); }); } });
    this.renderer.dispose(); this.root.replaceChildren();
    this.water.dispose();
  }
}
