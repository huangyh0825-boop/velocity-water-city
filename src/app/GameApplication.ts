import{HomeScreen}from'../ui/HomeScreen';
import{ProfileStore}from'../profile/DeviceProfile';
import{LoadingScreen}from'../ui/LoadingScreen';
import type{Game}from'../core/Game';
import type{TrainingOptions}from'../modes/TrainingOptions';
import type{LobbyClient}from'../lobby/LobbyClient';
import type{LobbyConnection}from'../lobby/types';
/** Mode lifecycle. Heavy rendering is imported only when entering training. */
export class GameApplication {
 private home?:HomeScreen;private game?:Game;private generation=0;
 private onlineLobby?:LobbyClient;
 // Let a reload retain its reconnect seat; only an explicit Home/leave exits a race.
 private pageHide=()=>this.game?.saveProgress();
 constructor(private root:HTMLElement,readonly profile=new ProfileStore()){window.addEventListener('pagehide',this.pageHide);this.showHome();}
 private showHome=()=>{this.generation++;this.game?.dispose();this.game=undefined;void this.onlineLobby?.leave();this.onlineLobby=undefined;this.home?.dispose();this.root.replaceChildren();this.home=new HomeScreen(this.root,this.profile,this.startTraining,this.startOnline);};
 private startOnline=async(lobby:LobbyClient,connection:LobbyConnection)=>{
  const race=connection.room.race;if(!race)return;const token=++this.generation;this.onlineLobby=lobby;
  this.home?.dispose(true);this.home=undefined;this.root.replaceChildren();const loading=new LoadingScreen(this.root,this.showHome);
  try{await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));const {Game}=await import('../core/Game');if(token!==this.generation)return;
   this.game=new Game(this.root,loading,{laps:race.laps,difficulty:'hard',playerId:this.profile.data.playerId,onHome:this.showHome,online:{lobby,race,memberId:connection.memberId}});
   await this.game.ready;if(token===this.generation)this.game.markOnlineLoaded();
  }catch(error){if(token===this.generation){void lobby.raceCommand('race.failed',race.id).catch(()=>{});console.error(error);loading.fail(error);}}
 };
 private startTraining=async(options:TrainingOptions)=>{
  const token=++this.generation;this.home?.dispose();this.home=undefined;this.root.replaceChildren();const loading=new LoadingScreen(this.root,this.showHome);let attempt:string|undefined;
  try{await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));const{Game}=await import('../core/Game');if(token!==this.generation)return;
   this.game=new Game(this.root,loading,{...options,playerId:this.profile.data.playerId,onHome:this.showHome,onRunStart:()=>{attempt=this.profile.start();},onRunEnd:run=>{if(attempt)this.profile.record(attempt,run);}});await this.game.ready;
  }catch(error){if(token===this.generation){console.error(error);loading.fail(error);}}
 };
 dispose(){this.generation++;window.removeEventListener('pagehide',this.pageHide);void this.onlineLobby?.leave();this.home?.dispose();this.game?.dispose();this.root.replaceChildren();}
}
