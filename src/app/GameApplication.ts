import{HomeScreen}from'../ui/HomeScreen';
import{ProfileStore}from'../profile/DeviceProfile';
import{LoadingScreen}from'../ui/LoadingScreen';
import type{Game}from'../core/Game';
import type{TrainingOptions}from'../modes/TrainingOptions';
/** Mode lifecycle. Heavy rendering is imported only when entering training. */
export class GameApplication {
 private home?:HomeScreen;private game?:Game;private generation=0;
 private pageHide=()=>this.game?.saveProgress();
 constructor(private root:HTMLElement,readonly profile=new ProfileStore()){window.addEventListener('pagehide',this.pageHide);this.showHome();}
 private showHome=()=>{this.generation++;this.game?.dispose();this.game=undefined;this.home?.dispose();this.root.replaceChildren();this.home=new HomeScreen(this.root,this.profile,this.startTraining);};
 private startTraining=async(options:TrainingOptions)=>{
  const token=++this.generation;this.home?.dispose();this.home=undefined;this.root.replaceChildren();const loading=new LoadingScreen(this.root,this.showHome);let attempt:string|undefined;
  try{await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));const{Game}=await import('../core/Game');if(token!==this.generation)return;
   this.game=new Game(this.root,loading,{...options,playerId:this.profile.data.playerId,onHome:this.showHome,onRunStart:()=>{attempt=this.profile.start();},onRunEnd:run=>{if(attempt)this.profile.record(attempt,run);}});await this.game.ready;
  }catch(error){if(token===this.generation){console.error(error);loading.fail(error);}}
 };
 dispose(){this.generation++;window.removeEventListener('pagehide',this.pageHide);this.home?.dispose();this.game?.dispose();this.root.replaceChildren();}
}
