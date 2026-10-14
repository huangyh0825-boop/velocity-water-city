import type { RampDecision } from '../track/Ramps';

export class RampDebug {
  enabled=false;
  readonly records: RampDecision[]=[];
  private latest=new Map<string,RampDecision>();
  private panel:HTMLPreElement;
  private key=(event:KeyboardEvent)=>{if(event.code==='F8'){event.preventDefault();this.enabled=!this.enabled;this.panel.hidden=!this.enabled;}};
  constructor(root:HTMLElement){
    this.enabled=new URLSearchParams(location.search).get('debugRamps')==='1';
    this.panel=document.createElement('pre');this.panel.hidden=!this.enabled;
    this.panel.style.cssText='position:absolute;left:4%;top:210px;max-width:580px;max-height:180px;overflow:auto;white-space:pre-wrap;background:#061c30d9;color:#b7fff2;padding:10px;font:10px monospace;z-index:4';
    root.append(this.panel);window.addEventListener('keydown',this.key);
  }
  record(value:RampDecision){
    if(!this.enabled)return;
    const previous=this.latest.get(value.boatId);
    this.records.push(value);if(this.records.length>240)this.records.shift();
    this.latest.set(value.boatId,value);
    // Full substep trajectories stay available in DevTools for significant decisions only.
    if(value.triggered||(previous?.reason!==value.reason&&value.reason!=='no-lip-crossing'))console.debug('[ramp]',value);
    const n=(x:number)=>x.toFixed(2),point=(p:{x:number;z:number})=>`(${n(p.x)},${n(p.z)})`;
    this.panel.textContent='F8: 关闭跳台调试 · 完整轨迹见控制台 [ramp]\n'+[...this.latest.values()].map(row=>
      `${row.boatId} / ${row.rampId} / ${row.state}: ${row.reason} ${row.triggered?'✓':''}\n`+
      `轨迹 ${point(row.path[0]??row.position)} → ${point(row.position)} · Δ碰撞=${n(row.correction)} · 支撑=${n(row.support)}\n`+
      `速=${n(row.speed)} vXZ=${point(row.horizontalVelocity)} h=${n(row.height)} vY=${n(row.verticalSpeed)}`
    ).join('\n');
  }
  reset(){this.records.length=0;this.latest.clear();this.panel.textContent='F8: 关闭跳台调试';}
  dispose(){window.removeEventListener('keydown',this.key);this.panel.remove();}
}
