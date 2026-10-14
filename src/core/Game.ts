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
import { RaceController } from '../race/RaceController';
import { AIController } from '../ai/AIController';
import { SPEED_TUNING, kmhToMps } from '../config/speed';
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
export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = createScene();
  private track = new CityTrack();
  private city=new CityDistricts(this.scene,this.track);
  private citySample=new CitySample(this.scene,this.track,loaded=>this.city.setSampleLoaded(loaded));
  private trackView = new TrackView(this.scene, this.track);
  private craft = new Watercraft(this.scene);
  private flight = new FlightController();
  private tricks = new TrickController();
  private nitro = new NitroController();
  private jet = new BoosterJet(this.craft.visual);
  private ramps = new Ramps(this.track, this.scene);
  private craftMotion = new MotionInterpolation(this.craft.model);
  private ai = [
    new AIController('ai-1', '霓虹 / NEON', kmhToMps(SPEED_TUNING.normalAI.maxKmh[0]), -7, this.track, -0.02),
    new AIController('ai-2', '脉冲 / PULSE', kmhToMps(SPEED_TUNING.normalAI.maxKmh[1]), 7, this.track, -0.02),
    new AIController('ai-3', '极光 / AURORA', kmhToMps(SPEED_TUNING.normalAI.maxKmh[2]), -7, this.track, -0.029),
    new AIController('ai-4', '回声 / ECHO', kmhToMps(SPEED_TUNING.normalAI.maxKmh[3]), 7, this.track, -0.029),
  ];
  private aiCraft = this.ai.map((ai, i) => new Watercraft(this.scene, ['#ee7953', '#a583ed', '#f6cc61', '#55c8a2'][i], ai.model,true));
  private aiJets = this.aiCraft.map(craft=>new BoosterJet(craft.visual));
  private aiMotion = this.ai.map(ai => new MotionInterpolation(ai.model));
  private collisions = new BoatCollisions();
  private bodies: BoatBody[] = [{ id: 'player', model: this.craft.model }, ...this.ai.map(ai => ({ id: ai.id, model: ai.model }))];
  private race!: RaceController;
  private camera = new FollowCamera();
  private input = new InputController();
  private water = new Water(this.scene);
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
  constructor(private root: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: !matchMedia('(pointer: coarse)').matches, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.autoClear = true; // Clear every frame; no history accumulation or motion blur.
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.citySample.configureSun(this.scene);
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1;
    const generator=new THREE.PMREMGenerator(this.renderer),room=new RoomEnvironment();this.reflection=generator.fromScene(room,.04);this.scene.environment=this.reflection.texture;room.dispose();generator.dispose();
    this.renderer.domElement.className = 'game-canvas';
    this.renderer.domElement.setAttribute('aria-label', '3D 城市水道三圈竞速场景');
    root.append(this.renderer.domElement);
    this.ai.forEach(ai=>ai.setRamps(this.ramps));
    this.restart();
    this.hud = new Hud(root, this.input, this.restart, this.recover, low => { this.low = low; this.spray.setLow(low);this.wake.setLow(low);this.water.setLow(low);this.city.setLow(low);void this.citySample.setLow(low);this.renderer.shadowMap.enabled=!low;void this.craft.setQuality(low);this.aiCraft.forEach(c=>void c.setQuality(true)); this.resize(); },this.audio);
    this.debug=new RampDebug(root);this.ramps.onDecision=value=>this.debug.record(value);
    window.addEventListener('pointerdown',this.activateAudio);
    window.addEventListener('keydown',this.activateAudio);
    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', this.visibility);
    this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost);
    this.resize(); this.camera.update(0, this.craft.model, true);
    this.frameId = requestAnimationFrame(this.frame);
  }
  private restart = () => {
    this.input.clear(); this.track.spawn(this.craft.model); this.ai.forEach(ai => ai.reset());
    this.flight.reset(); this.bodies[0].height = 0;
    this.bodies.forEach(body=>body.height=0);this.ramps.decisions.clear();
    this.tricks.reset(); this.nitro.reset();
    this.spray.reset(); this.impactLimiter.reset();
    this.audio.reset();
    this.countdownCue.reset();
    this.debug?.reset();
    this.craftMotion.reset(); this.aiMotion.forEach(motion => motion.reset());
    this.race = new RaceController(this.track, [{ id: 'player', name: '你 / PLAYER', position: this.craft.model }, ...this.ai.map(ai => ({ id: ai.id, name: ai.name, position: ai.model }))]);
    this.wake.reset(); this.wallContact = false; this.accumulator = 0; this.previous = 0;
    this.camera.update(0, this.craft.model, true);
  };
  private recover = () => {
    if (this.race.phase !== 'racing') return;
    const angle = this.race.player.passed === 0 ? -0.014 : this.track.checkpointAngle(this.race.player.passed % this.track.checkpointCount) + 10/this.track.radius;
    this.input.clear(); this.track.spawn(this.craft.model, angle);
    this.flight.reset(); this.bodies[0].height = 0;
    this.tricks.reset(); this.nitro.active=false;
    this.spray.reset();
    this.craftMotion.reset();
    this.race.syncPosition('player', this.craft.model); this.wake.reset(); this.wallContact = false;
    this.camera.update(0, this.craft.model, true);
  };
  private resize = () => {
    const width = this.root.clientWidth, height = this.root.clientHeight;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.low ? 1 : 1.75));
    this.renderer.setSize(width, height); this.camera.resize(width, height);
  };
  private visibility = () => { this.paused = document.hidden; this.audio.setPaused(this.paused); this.input.clear(); this.previous = 0; this.accumulator = 0; this.craftMotion.reset(); this.aiMotion.forEach(motion => motion.reset()); };
  private contextLost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(this.frameId); this.root.insertAdjacentHTML('beforeend', '<div class="error">图形连接中断，请刷新页面重新比赛。</div>'); };
  private frame = (now: number) => {
    this.frameId = requestAnimationFrame(this.frame);
    if (this.paused) return;
    const dt = this.previous ? Math.min((now - this.previous) / 1000, 0.1) : 0;
    this.previous = now; this.accumulator += dt;
    const input = this.input.state, step = 1 / 60;
    while (this.accumulator >= step) {
      const canDrive = this.race.phase === 'racing'; this.race.tick(step);
      const cue=this.countdownCue.update(this.race.phase,this.race.countdown);if(cue!==null)this.audio.countdown(cue);
      if (canDrive) {
        this.craftMotion.capture(); this.aiMotion.forEach(motion => motion.capture());
        this.collisions.capture(this.bodies);
        const before = { x: this.craft.model.x, z: this.craft.model.z };
        this.flight.beginStep(step);
        this.nitro.update(step,this.input.boost);
        this.craft.model.update(step, input, this.nitro.active); this.wallContact = this.track.constrain(this.craft.model);
        this.ramps.prepare(this.craft.model,this.flight);this.bodies[0].height=this.flight.height;
        // Finished AI keep moving until the player's result screen; their recorded times stay frozen.
        // A stopped solid boat on the finish line would permanently block following AI.
        const aiWall = this.ai.map((ai,i) => { ai.update(step,this.bodies,this.race.racers.find(r=>r.id===ai.id)?.finishTime===null); const wall=this.track.constrain(ai.model);this.bodies[i+1].height=ai.flight.height;return wall; });
        this.collisions.resolve(this.bodies, step, model => {
          if (!this.track.constrain(model)) return;
          if (model === this.craft.model) this.wallContact = true;
          const i=this.ai.findIndex(ai=>ai.model===model);if(i>=0)aiWall[i]=true;
        });
        this.ramps.update(before,this.craft.model,this.flight,'player',this.collisions.sweptPath('player'),this.collisions.movementAllowance('player'));this.bodies[0].height=this.flight.height;
        this.ai.forEach((ai,i)=>{ai.finishStep(this.collisions.sweptPath(ai.id),this.collisions.movementAllowance(ai.id));this.bodies[i+1].height=ai.flight.height;});
        this.ai.forEach((ai,i)=>ai.updateActions(step,!aiWall[i]&&ai.model.speed>8&&!this.collisions.hasContact(ai.id),this.race.racers.find(r=>r.id===ai.id)?.finishTime===null));
        if(this.flight.takeoff)this.tricks.beginJump();if(this.input.consumeTrickPress())this.tricks.request(this.flight);this.tricks.update(step);
        this.ai.forEach(ai => { if (this.collisions.hasContact(ai.id)) ai.onContact(); });
        this.ai.forEach(ai=>{
          const volume=distanceGain(Math.hypot(ai.model.x-this.craft.model.x,ai.model.z-this.craft.model.z,ai.flight.height-this.flight.height))*.55;
          if(ai.flight.takeoff){this.spray.burst(ai.model.x,ai.model.z,ai.model.speed*.65,'takeoff');this.audio.event('takeoff',ai.model.speed,volume);}
          if(ai.flight.landed&&ai.flight.height<.2){this.spray.burst(ai.model.x,ai.model.z,ai.flight.landingSpeed,'landing');this.audio.event('landing',ai.flight.landingSpeed,volume);}
          else if(ai.flight.landed)this.audio.event('collision',ai.flight.landingSpeed,volume);
        });
        this.ai.forEach((ai,i)=>{if(ai.flight.landed)this.aiCraft[i].land();});
        for(const event of this.collisions.events) if(event.strength>2 && this.impactLimiter.accept(event.key,this.time)) {if(event.height<1.2)this.spray.burst(event.x,event.z,event.strength,'collision');this.audio.event('collision',event.strength,distanceGain(Math.hypot(event.x-this.craft.model.x,event.z-this.craft.model.z,event.height-this.flight.height)));}
        if(this.flight.takeoff) {this.spray.burst(this.craft.model.x,this.craft.model.z,this.craft.model.speed,'takeoff');this.audio.event('takeoff',this.craft.model.speed);}
        if(this.flight.landed) {
          this.craft.land();
          if(this.flight.height<.2)this.spray.burst(this.craft.model.x,this.craft.model.z,this.flight.landingSpeed,'landing');
          this.audio.event(this.flight.height<.2?'landing':'collision',this.flight.landingSpeed);
          const result=this.tricks.land(!this.wallContact && this.craft.model.speed>8 && !this.collisions.hasContact('player'));
          this.nitro.reward(result.reward);
          if(result.penalty) { this.craft.model.speed*=0.72; this.craft.model.vx*=0.72; this.craft.model.vz*=0.72; }
        }
        this.race.record('player', this.craft.model, step, this.collisions.movementAllowance('player'));
        this.ai.forEach(ai => this.race.record(ai.id, ai.model, step, this.collisions.movementAllowance(ai.id)));
        this.race.completeStep();
        if (this.race.phase === 'finished') { this.input.clear(); this.nitro.active=false;this.ai.forEach(ai=>ai.nitro.active=false); this.craft.model.speed = 0; this.craftMotion.reset(); this.aiMotion.forEach(motion => motion.reset()); }
      }
      const waterSources=[{id:'player',model:this.craft.model,grounded:canDrive&&this.flight.height<.2&&!this.flight.airborne},
        ...this.ai.map(ai=>({id:ai.id,model:ai.model,grounded:canDrive&&ai.flight.height<.2&&!ai.flight.airborne,weight:.65}))];
      this.wake.updateAll(step,waterSources);this.spray.updateAll(step,waterSources);
      this.time += step; this.accumulator -= step;
    }
    const displayTime = this.time + this.accumulator;
    const displayModel = this.craftMotion.sample(this.accumulator / step);
    this.craft.sync(displayTime, displayModel, this.flight.displayHeight(this.accumulator / step), this.tricks.rotation);
    this.aiCraft.forEach((craft, i) => craft.sync(displayTime, this.aiMotion[i].sample(this.accumulator / step),this.ai[i].flight.displayHeight(this.accumulator/step),this.ai[i].tricks.rotation));
    this.jet.update(displayTime,this.nitro.active);
    this.aiJets.forEach((jet,i)=>jet.update(displayTime,this.ai[i].nitro.active));
    this.audio.update({speed:this.craft.model.speed,throttle:input.throttle,boost:this.nitro.active,grounded:!this.flight.airborne&&this.flight.height<.2,airborne:this.flight.airborne,running:this.race.phase==='racing'});
    this.audio.updateAI(this.ai.map(ai=>{const dx=ai.model.x-this.craft.model.x,dz=ai.model.z-this.craft.model.z,distance=Math.hypot(dx,dz,ai.flight.height-this.flight.height);return{id:ai.id,speed:ai.model.speed,throttle:1,boost:ai.nitro.active,airborne:ai.flight.airborne,grounded:!ai.flight.airborne&&ai.flight.height<.2,running:this.race.phase==='racing',distance,pan:(dx*Math.cos(this.craft.model.heading)-dz*Math.sin(this.craft.model.heading))/Math.max(10,distance)};}));
    this.water.update(displayTime); this.camera.update(dt, displayModel,false,this.flight.displayHeight(this.accumulator/step),this.nitro.active);
    this.trackView.highlight(this.race.nextCheckpoint());
    this.hud.update(this.craft.model, this.race, this.wallContact,this.nitro,this.flight,this.tricks); this.renderer.render(this.scene, this.camera.camera);
  };
  dispose() {
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
