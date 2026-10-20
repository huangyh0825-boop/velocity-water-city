import'/src/style.css';import'/src/ui/race.css';import'/src/ui/phase3.css';
import{GameApplication}from'/src/app/GameApplication';
// Private test entry. Production index.html exposes no game or application hook.
window.appQA=new GameApplication(document.querySelector('#app'));
