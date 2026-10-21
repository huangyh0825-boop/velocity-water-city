import {loadPlaywright} from './qa-playwright.mjs';
import {preview} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const output=process.env.QA_OUTPUT??'work/shortcut-tutorial';await mkdir(output,{recursive:true});
const server=process.env.QA_URL?undefined:await preview({preview:{host:'127.0.0.1',port:5293,strictPort:true}});
const base=process.env.QA_URL??'http://127.0.0.1:5293/',{chromium}=loadPlaywright(),browser=await chromium.launch({channel:'msedge',headless:true}),report={url:base,checks:{},errors:[]};
try{
 for(const [label,viewport,isMobile] of [['desktop',{width:1440,height:900},false],['phone',{width:390,height:844},true],['landscape',{width:844,height:390},true]]){
  const context=await browser.newContext({viewport,isMobile,hasTouch:isMobile}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base);
  assert.equal(await page.locator('#profile-dialog').evaluate(d=>d.open),true);assert.equal(await page.locator('#driving-tutorial').evaluate(d=>d.open),false);
  await page.getByLabel('游戏 ID',{exact:true}).fill('教程验收');await page.getByRole('button',{name:'保存 ID'}).click();assert.equal(await page.locator('#driving-tutorial').evaluate(d=>d.open),true);
  assert.equal(await page.locator('.tutorial-panels li').count(),4);assert.ok((await page.locator('.tutorial-intro').innerText()).includes('氮气加速'));
  assert.equal(await page.locator('#driving-tutorial').evaluate(d=>d.scrollWidth<=d.clientWidth+1),true);
  await page.screenshot({path:`${output}/tutorial-${label}.png`});await page.locator('.tutorial-done').click();
  await page.reload();assert.equal(await page.locator('#driving-tutorial').evaluate(d=>d.open),false);await page.locator('#show-tutorial').click();assert.equal(await page.locator('#driving-tutorial').evaluate(d=>d.open),true);await page.getByRole('button',{name:'关闭玩法教程'}).click();
  report.checks[label]={firstAfterId:true,onePageFourPanels:true,noHorizontalOverflow:true,rememberedAfterReload:true,reopenFromHome:true};
  if(!isMobile){await page.locator('#training-laps').fill('1');await page.locator('#start-training').click();await page.waitForFunction(()=>!!document.querySelector('.game-canvas')&&!document.querySelector('.boot-screen'),undefined,{timeout:240000});assert.equal(await page.locator('.keyboard .wide-key').innerText(),'左Shift');assert.equal(await page.locator('.keyboard .wide-key').evaluate(k=>k.scrollWidth<=k.clientWidth),true);await page.screenshot({path:`${output}/training-keyboard.png`});await page.locator('#home').click();assert.equal(await page.locator('#driving-tutorial').evaluate(d=>d.open),false);report.checks.trainingAndKeyboard=true;}
  await context.close();
 }
 // An existing named profile also sees the new tutorial exactly once.
 const context=await browser.newContext(),page=await context.newPage();await page.goto(base);await page.getByLabel('游戏 ID',{exact:true}).fill('已有玩家');await page.getByRole('button',{name:'保存 ID'}).click();await page.locator('.tutorial-done').click();await page.evaluate(()=>localStorage.removeItem('velocity-water-city:tutorial:v1'));await page.reload();assert.equal(await page.locator('#profile-dialog').evaluate(d=>d.open),false);assert.equal(await page.locator('#driving-tutorial').evaluate(d=>d.open),true);await page.keyboard.press('Escape');await page.reload();assert.equal(await page.locator('#driving-tutorial').evaluate(d=>d.open),false);report.checks.existingProfileAndEscape=true;await context.close();
 assert.deepEqual(report.errors,[]);await writeFile(output+'/tutorial.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();await server?.close();}
