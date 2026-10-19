import './style.css';
import './ui/race.css';
import './ui/phase3.css';
import {LoadingScreen} from './ui/LoadingScreen';
const root = document.querySelector<HTMLElement>('#app')!;
const loading=new LoadingScreen(root);
async function start(){try{
 // Paint the loader before importing and synchronously building the large scene.
 await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
 const {Game}=await import('./core/Game');const game=new Game(root,loading);
 if(import.meta.hot)import.meta.hot.dispose(()=>game.dispose());
 await game.ready;
}catch(error){console.error(error);loading.fail(error);}}
void start();
