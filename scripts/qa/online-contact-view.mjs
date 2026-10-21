// Private QA entry only. The normal production entry exports no game handles.
import '../../src/style.css';import '../../src/ui/race.css';import '../../src/ui/phase3.css';
import {GameApplication} from '../../src/app/GameApplication';
const app=new GameApplication(document.querySelector('#app'));
const samples=[];let watched=false;
window.contactQA={
 ready(){return !!app.game?.initialized;},
 watch(){const g=app.game;if(watched||!g)return;watched=true;const step=g.session.step.bind(g.session);g.session.step=(dt,input)=>{const result=step(dt,input);samples.push({speed:g.craft.model.speed,x:g.craft.model.x,z:g.craft.model.z,contact:g.collisions.hasContact('player')});return result;};},
 colors(){const g=app.game,ids=[g.session.online.memberId,...g.ai.map(a=>a.id)];return [g.craft,...g.aiCraft].map((c,i)=>{const colors=new Set();c.visual.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.name==='Paint'&&m.color)colors.add('#'+m.color.getHexString());});return{id:ids[i],colors:[...colors]};});},
 summary(){const g=app.game;return{samples:samples.length,contactSteps:samples.filter(s=>s.contact).length,maxPhysicalStep:Math.max(0,...samples.slice(1).map((s,i)=>Math.hypot(s.x-samples[i].x,s.z-samples[i].z))),quality:g.low?'low':'standard',waterVertices:g.water.mesh.geometry.attributes.position.count,phase:g.race.phase,player:{x:g.craft.model.x,z:g.craft.model.z,speed:g.craft.model.speed},input:g.input.state,remoteBodies:g.session.state.remoteBodies?.length};},
};
