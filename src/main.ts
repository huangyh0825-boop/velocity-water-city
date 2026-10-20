import './style.css';
import './ui/race.css';
import './ui/phase3.css';
import{GameApplication}from'./app/GameApplication';
const app=new GameApplication(document.querySelector<HTMLElement>('#app')!);
if(import.meta.hot)import.meta.hot.dispose(()=>app.dispose());
