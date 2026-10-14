import './style.css';
import './ui/race.css';
import './ui/phase3.css';
import { Game } from './core/Game';
const root = document.querySelector<HTMLElement>('#app')!;
try {
  const game = new Game(root);
  if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
} catch (error) {
  console.error(error);
  root.innerHTML = '<div class="error">无法启动 3D 场景。请使用支持 WebGL 的浏览器并开启硬件加速，然后刷新。</div>';
}
