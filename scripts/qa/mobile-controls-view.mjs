// Private test entry; no game references are exported from the production entry.
import '../../src/style.css';import '../../src/ui/race.css';import '../../src/ui/phase3.css';
import {GameApplication} from '../../src/app/GameApplication';
const app=new GameApplication(document.querySelector('#app'));
window.mobileQA={
 ready:()=>!!app.game?.initialized,
 snapshot(){const g=app.game;return{...g.input.state,boost:g.input.boost,touchMode:g.input.touchMode,speed:g.craft.model.speed,phase:g.race.phase,energy:g.nitro.energy,airborne:g.flight.airborne,used:g.tricks.used,quality:g.low?'low':'standard',assets:[g.craft,...g.aiCraft].map(c=>c.asset?.userData.visualAsset),profile:g.qualityProfile,pixelRatio:g.renderer.getPixelRatio(),waterSegments:g.water.mesh.geometry.parameters.widthSegments};},
 freeze(){app.game.paused=true;},
 place(){const g=app.game;g.paused=true;g.track.spawn(g.craft.model,.06*Math.PI*2);g.ramps.place(g.craft.model,g.flight);g.tricks.reset();g.nitro.reset();g.race.phase='racing';this.update();},
 render(){const g=app.game;g.craftMotion.reset();g.aiMotion.forEach(m=>m.reset());g.camera.update(0,g.craft.model,true,g.flight.height,false,g.track.surface(g.craft.model).height);g.previous=0;g.accumulator=0;g.paused=false;g.frame(performance.now());g.paused=true;cancelAnimationFrame(g.frameId);},
 update(){const g=app.game;g.hud.update(g.craft.model,g.race,false,g.nitro,g.flight,g.tricks);},
 drive(steps=90){const g=app.game;for(let i=0;i<steps;i++)g.session.step(1/60,g.controls.sample());this.update();},
 flight(){const g=app.game;g.flight.airborne=true;g.flight.legalLaunch=true;g.flight.height=g.craft.model.y+8;g.flight.verticalSpeed=5;g.tricks.beginJump();this.update();},
 finish(){const g=app.game;g.race.phase='finished';g.race.player.finishTime=60;this.update();}
};
