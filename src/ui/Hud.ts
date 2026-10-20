import { InputController } from '../controls/InputController';
import { DrivingModel, MAX_SPEED } from '../player/DrivingModel';
import { RaceController } from '../race/RaceController';
import { formatTime } from './formatTime';
import { NitroController } from '../player/NitroController';
import { FlightController } from '../player/FlightController';
import { TrickController } from '../player/TrickController';
import { AudioController } from '../audio/AudioController';
export class Hud {
  private speed: HTMLElement; private bar: HTMLElement; private status: HTMLElement;
  private rank: HTMLElement; private lap: HTMLElement; private time: HTMLElement; private countdown: HTMLElement;
  private result: HTMLElement; private resultShown = false;
  private nitroBar: HTMLElement; private nitroLabel: HTMLElement;
  constructor(root: HTMLElement, input: InputController, restart: () => void, recover: () => void, quality: (low: boolean) => void, audio?:AudioController,onHome?:()=>void) {
    root.insertAdjacentHTML('beforeend', `
      <header class="topbar"><div class="brand"><span class="brand-icon">≋</span><div><strong>极速水城<span>未来竞速</span></strong><small>VELOCITY / WATER CITY</small></div></div><div class="phase"><i></i> 单人训练 <span>曙光都市</span></div></header>
      <div class="race-hud" aria-label="比赛信息"><div><small>POS</small><strong id="rank">1 / 5</strong></div><div><small>LAP</small><strong id="lap">1 / 3</strong></div><div><small>TIME</small><strong id="race-time">00:00.00</strong></div></div>
      <div class="tools">${onHome?'<button id="home" type="button">返回首页</button>':''}<button id="quality" type="button">画质 · 标准</button><button id="recover" type="button">返回赛道 ↺</button><button id="reset" type="button">重新比赛</button></div>
      <div class="audio-controls"><button id="sound" type="button" aria-pressed="true">声音 · 开</button><label>音量 <input id="volume" type="range" min="0" max="100" value="35" aria-label="总音量"></label></div>
      <div class="countdown" id="countdown" aria-live="polite"></div>
      <div class="trick-toast" id="trick-toast" hidden aria-live="polite"></div>
      <div class="speedometer"><div class="speed-label">VELOCITY</div><div><strong id="speed">000</strong><span>KM/H</span></div><div class="speed-track"><i id="speed-bar"></i></div><small id="status">准备起航</small><div class="nitro-label">NITRO <b id="nitro-label">40%</b></div><div class="nitro-track" role="meter" aria-label="氮气能量" aria-valuemin="0" aria-valuemax="100"><i id="nitro-bar"></i></div></div>
      <div class="keyboard"><span><kbd>W</kbd> 加速</span><span><kbd>S</kbd> 减速</span><span><kbd>A</kbd><kbd>D</kbd> 转向</span><span><kbd>␣</kbd> 空中特技</span><span><kbd>⇧</kbd> 氮气</span></div>
      <div class="touch steering"><button data-action="left" aria-label="左转">‹</button><button data-action="right" aria-label="右转">›</button></div>
      <div class="touch pedals"><button data-action="brake" aria-label="减速" class="brake">减速</button><button data-action="throttle" aria-label="加速" class="throttle">⌃<span>加速</span></button></div>
      <div class="touch abilities"><button data-action="trick" aria-label="空中特技">特技</button><button data-action="nitro" aria-label="氮气加速">氮气</button></div>
      <div class="rotate-hint">↻ 横屏驾驶，视野更开阔</div>
      <footer>曙光都市 · 顺向通过全部检查点 <span>4.75 KM / SIX DISTRICTS</span></footer>
      <section id="result" class="result" hidden role="dialog" aria-modal="true" aria-labelledby="result-title"><div class="result-card"><small>RACE COMPLETE</small><h1 id="result-title">比赛完成</h1><p id="result-summary"></p><div id="result-table"></div><p class="result-note">玩家完赛时结算 · 未完赛选手按赛程进度排序</p><button id="race-again" type="button">再赛一场 →</button>${onHome?'<button id="result-home" type="button" style="margin-top:10px;background:transparent">返回首页</button>':''}</div></section>`);
    root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => input.bindButton(button, button.dataset.action!));
    root.querySelector('#reset')!.addEventListener('click', restart);
    root.querySelector('#race-again')!.addEventListener('click', restart);
    root.querySelector('#recover')!.addEventListener('click', recover);
    root.querySelector('#home')?.addEventListener('click',()=>onHome?.());
    root.querySelector('#result-home')?.addEventListener('click',()=>onHome?.());
    root.querySelector<HTMLButtonElement>('#sound')!.addEventListener('click',event=>{if(!audio)return;audio.setEnabled(!audio.enabled);const button=event.currentTarget as HTMLButtonElement;button.textContent=`声音 · ${audio.enabled?'开':'关'}`;button.setAttribute('aria-pressed',String(audio.enabled));});
    root.querySelector<HTMLInputElement>('#volume')!.addEventListener('input',event=>audio?.setVolume(Number((event.currentTarget as HTMLInputElement).value)/100));
    let low = matchMedia('(pointer: coarse)').matches;
    const button = root.querySelector<HTMLButtonElement>('#quality')!;
    const apply = () => { button.textContent = `画质 · ${low ? '低' : '标准'}`; quality(low); };
    button.addEventListener('click', () => { low = !low; apply(); }); apply();
    const get = (selector: string) => root.querySelector<HTMLElement>(selector)!;
    this.speed = get('#speed'); this.bar = get('#speed-bar'); this.status = get('#status');
    this.rank = get('#rank'); this.lap = get('#lap'); this.time = get('#race-time'); this.countdown = get('#countdown'); this.result = get('#result');
    this.nitroBar=get('#nitro-bar'); this.nitroLabel=get('#nitro-label');
  }
  update(model: DrivingModel, race: RaceController, wallContact: boolean, nitro?:NitroController, flight?:FlightController, tricks?:TrickController) {
    const toast=this.result.parentElement!.querySelector<HTMLElement>('#trick-toast')!;
    toast.hidden=!tricks || tricks.feedbackTime<=0 || race.phase!=='racing'; if(!toast.hidden) toast.textContent=tricks!.message;
    this.speed.textContent = String(Math.round(model.speed * 3.6)).padStart(3, '0');
    this.bar.style.width = `${Math.min(1,model.speed / MAX_SPEED) * 100}%`;
    if(nitro) { this.nitroBar.style.width=`${nitro.energy}%`; this.nitroLabel.textContent=`${Math.ceil(nitro.energy)}%`; this.nitroBar.parentElement!.classList.toggle('boosting',nitro.active); this.nitroBar.parentElement!.setAttribute('aria-valuenow',String(Math.round(nitro.energy))); }
    this.rank.textContent = `${race.playerRank} / ${race.racers.length}`;
    this.lap.textContent = `${race.lap()} / ${race.laps}`;
    this.time.textContent = formatTime(race.player.finishTime ?? race.elapsed);
    const gate = race.nextCheckpoint(), angle = race.track.angle(model);
    const heading=race.track.heading(angle),forwardSpeed = Math.sin(heading) * model.vx + Math.cos(heading) * model.vz;
    this.status.textContent = race.phase === 'countdown' ? '准备起航 · 沿水道箭头行驶' : race.phase === 'finished' ? `${race.laps} 圈完成` : wallContact ? '触碰边界 · 转向返回水道' : forwardSpeed < -1 ? '逆向行驶 · 请调转方向' : gate === 0 ? '下一检查点 · 起终点' : `下一检查点 · CP ${String(gate).padStart(2,'0')} / ${race.track.checkpointCount-1}`;
    if(race.phase==='racing' && flight?.airborne) this.status.textContent=`${tricks?.message ?? '腾空'} · ${flight.remainingTime.toFixed(1)}s`;
    const text = race.phase === 'countdown' ? String(Math.ceil(race.countdown)) : race.phase === 'racing' && race.elapsed < 0.8 ? 'GO' : '';
    if (this.countdown.dataset.value !== text) {
      this.countdown.dataset.value = text;
      this.countdown.innerHTML = text ? `<strong>${text}</strong><small>${race.phase === 'countdown' ? `${race.laps} 圈训练 · 顺箭头方向出发` : '沿青色检查点前进'}</small>` : '';
    }
    if (race.phase === 'finished' && !this.resultShown) {
      this.resultShown = true; this.result.hidden = false;
      this.result.querySelector('#result-summary')!.textContent = `第 ${race.playerRank} 名 / ${race.racers.length} 位选手 · ${formatTime(race.player.finishTime!)}${race.bestTime===null?'':` · 本赛道最佳 ${formatTime(race.bestTime)}`}`;
      const table = document.createElement('table'); table.innerHTML = '<thead><tr><th>POS</th><th>选手</th><th>TIME</th></tr></thead>';
      const body = table.createTBody();
      race.standings().forEach((racer, i) => {
        const row = body.insertRow(); if (racer.id === race.playerId) row.className = 'player-result';
        for (const value of [String(i + 1).padStart(2, '0'), racer.name, racer.finishTime === null ? '未完赛' : formatTime(racer.finishTime)]) row.insertCell().textContent = value;
      });
      this.result.querySelector('#result-table')!.replaceChildren(table);
      this.result.querySelector<HTMLButtonElement>('#race-again')!.focus();
    } else if (race.phase !== 'finished' && this.resultShown) { this.resultShown = false; this.result.hidden = true; }
  }
}
