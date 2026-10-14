import {audioMix,distanceGain} from './AudioMix';
export interface AudioState { speed:number; throttle:number; boost:boolean; grounded:boolean; running:boolean;airborne?:boolean }
export class AudioController {
  enabled=true;
  volume=0.35;
  context:AudioContext|null=null;
  private master:GainNode|null=null;
  private limiter:DynamicsCompressorNode|null=null;
  private engine:OscillatorNode[]=[];
  private engineGain:GainNode|null=null;
  private engineFilter:BiquadFilterNode|null=null;
  private streams:{gain:GainNode;filter:BiquadFilterNode}[]=[];
  private noise:AudioBuffer|null=null;
  private noiseSource:AudioBufferSourceNode|null=null;
  private voices=new Set<AudioScheduledSourceNode>();
  private wasBoost=false;
  private paused=false;
  private aiChannels=new Map<string,{osc:OscillatorNode;engine:GainNode;water:GainNode;wind:GainNode;boost:GainNode;pan:StereoPannerNode;wasBoost:boolean}>();
  get activeVoices() {return this.voices.size;}
  get loopCount() {return this.context?3+this.aiChannels.size:0;}
  private target(param:AudioParam,value:number,timeConstant=0.08) { const now=this.context!.currentTime;param.cancelScheduledValues(now);param.setTargetAtTime(value,now,timeConstant); }
  async unlock() {
    if(!this.enabled) return;
    try {
      if(!this.context) {
        const Constructor=window.AudioContext ?? (window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
        if(!Constructor) return;
        const ctx=this.context=new Constructor(); this.master=ctx.createGain();this.master.gain.value=this.volume;
        const limiter=this.limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-10;limiter.knee.value=12;limiter.ratio.value=6;limiter.attack.value=.006;limiter.release.value=.18;
        this.master.connect(limiter);limiter.connect(ctx.destination);
        const engineFilter=this.engineFilter=ctx.createBiquadFilter();engineFilter.type='lowpass';engineFilter.frequency.value=600;
        this.engineGain=ctx.createGain();this.engineGain.gain.value=0;engineFilter.connect(this.engineGain);this.engineGain.connect(this.master);
        for(const [type,multiple] of [['sawtooth',1],['triangle',2]] as const) {const osc=ctx.createOscillator();osc.type=type;osc.frequency.value=45*multiple;osc.connect(engineFilter);osc.start();this.engine.push(osc);}
        this.noise=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);const samples=this.noise.getChannelData(0);let seed=712391;
        for(let i=0;i<samples.length;i++){seed=(seed*1664525+1013904223)>>>0;samples[i]=seed/2147483648-1;}
        this.noiseSource=ctx.createBufferSource();this.noiseSource.buffer=this.noise;this.noiseSource.loop=true;
        for(const [type,frequency] of [['lowpass',600],['highpass',1800],['bandpass',1100],['highpass',3000]] as const) { const filter=ctx.createBiquadFilter();filter.type=type;filter.frequency.value=frequency;filter.Q.value=.5;const gain=ctx.createGain();gain.gain.value=0;this.noiseSource.connect(filter);filter.connect(gain);gain.connect(this.master);this.streams.push({filter,gain}); }
        this.noiseSource.start();
      }
      if(this.context.state==='suspended' && !this.paused) await this.context.resume();
    } catch { /* Unsupported/denied audio must never interrupt the race. */ }
  }
  setEnabled(enabled:boolean) {this.enabled=enabled;if(enabled)void this.unlock();if(this.master)this.target(this.master.gain,enabled&&!this.paused?this.volume:0);}
  setVolume(volume:number) {this.volume=Math.max(0,Math.min(1,volume));if(this.master)this.target(this.master.gain,this.enabled&&!this.paused?this.volume:0);}
  setPaused(paused:boolean) {this.paused=paused;if(this.master)this.target(this.master.gain,paused||!this.enabled?0:this.volume);}
  update(state:AudioState) {
    if(!this.context || this.context.state!=='running' || !this.engineGain) return;
    const ratio=Math.max(0,Math.min(1.2,state.speed/50)),running=state.running&&!this.paused&&this.enabled;
    const mix=audioMix(state);
    this.engine.forEach((osc,i)=>this.target(osc.frequency,mix.rpm*(i+1)));
    if(this.engineFilter)this.target(this.engineFilter.frequency,450+ratio*1150+state.throttle*120,.12);
    this.target(this.engineGain.gain,running?mix.engine:0);
    const water=running&&state.grounded;
    this.target(this.streams[0].gain.gain,running?mix.water:0, state.grounded?.1:.035);
    this.target(this.streams[0].filter.frequency,500+ratio*900);
    this.target(this.streams[1].gain.gain,running?mix.breaking:0,state.grounded?.1:.035);
    this.target(this.streams[3].gain.gain,running?mix.wind:0,.07);
    this.target(this.streams[2].gain.gain,running && state.boost ? 0.10 : 0,0.04);
    if(running&&state.boost&&!this.wasBoost)this.event('nitro',25);
    this.wasBoost=running&&state.boost;
  }
  event(kind:'takeoff'|'landing'|'collision'|'nitro',strength:number,volume=1) {
    volume=Math.max(0,Math.min(1,volume));
    const ctx=this.context;if(!ctx || ctx.state!=='running' || !this.enabled || this.paused || !this.noise || this.voices.size>=6||volume<.001)return false;
    const source=ctx.createBufferSource();source.buffer=this.noise;
    const filter=ctx.createBiquadFilter();filter.type=kind==='collision'?'lowpass':'bandpass';filter.frequency.value=kind==='collision'?250:kind==='landing'?650:kind==='nitro'?1700:1000;
    const gain=ctx.createGain(),duration=kind==='landing' ? 0.4 : kind==='collision' ? 0.16 : 0.22,now=ctx.currentTime;
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(Math.min(.24,.055+strength*.003)*volume,now+.015);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    source.connect(filter);filter.connect(gain);gain.connect(this.master!);this.voices.add(source);
    source.onended=()=>{this.voices.delete(source);source.disconnect();filter.disconnect();gain.disconnect();};source.start(now);source.stop(now+duration);return true;
  }
  updateAI(states:readonly (AudioState&{id:string;distance:number;pan:number})[]){
    const ctx=this.context;if(!ctx||ctx.state!=='running'||!this.noiseSource||typeof ctx.createStereoPanner!=='function')return;
    for(const s of states){
      let c=this.aiChannels.get(s.id);
      if(!c){if(this.aiChannels.size>=4)continue;
        const osc=ctx.createOscillator(),engine=ctx.createGain(),pan=ctx.createStereoPanner();osc.type='triangle';engine.gain.value=0;osc.connect(engine);engine.connect(pan);pan.connect(this.master!);
        const gains=[600,3000,1100].map((frequency,i)=>{const filter=ctx.createBiquadFilter(),gain=ctx.createGain();filter.type=i===1?'highpass':'bandpass';filter.frequency.value=frequency;gain.gain.value=0;this.noiseSource!.connect(filter);filter.connect(gain);gain.connect(pan);return gain;});
        osc.start();c={osc,engine,water:gains[0],wind:gains[1],boost:gains[2],pan,wasBoost:false};this.aiChannels.set(s.id,c);
      }
      const m=audioMix(s),gain=s.running&&this.enabled&&!this.paused?distanceGain(s.distance)*.45:0;
      this.target(c.osc.frequency,m.rpm);this.target(c.engine.gain,m.engine*gain);
      this.target(c.water.gain,(m.water+m.breaking)*gain,s.grounded?.1:.035);
      this.target(c.wind.gain,m.wind*gain);this.target(c.boost.gain,m.boost*gain);this.target(c.pan.pan,Math.max(-1,Math.min(1,s.pan)));
      if(s.boost&&s.running&&!c.wasBoost)this.event('nitro',25,gain);c.wasBoost=s.boost&&s.running;
    }
  }
  countdown(value:number){
    const ctx=this.context;if(!ctx||ctx.state!=='running'||!this.enabled||this.paused||this.voices.size>=6)return false;
    const source=ctx.createOscillator(),gain=ctx.createGain(),now=ctx.currentTime,duration=value===0?.35:.16;
    source.type='sine';source.frequency.value=value===0?880:520;
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.16,now+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    source.connect(gain);gain.connect(this.master!);this.voices.add(source);
    source.onended=()=>{this.voices.delete(source);source.disconnect();gain.disconnect();};source.start(now);source.stop(now+duration);return true;
  }
  reset() {this.wasBoost=false;for(const source of this.voices){try{source.stop();}catch{}}this.voices.clear();if(this.engineGain)this.target(this.engineGain.gain,0);this.streams.forEach(s=>this.target(s.gain.gain,0));for(const c of this.aiChannels.values()){c.wasBoost=false;for(const gain of [c.engine,c.water,c.wind,c.boost])this.target(gain.gain,0);}}
  dispose() {this.reset();this.engine.forEach(osc=>osc.stop());for(const c of this.aiChannels.values())c.osc.stop();this.noiseSource?.stop();if(this.context)void this.context.close();}
}
