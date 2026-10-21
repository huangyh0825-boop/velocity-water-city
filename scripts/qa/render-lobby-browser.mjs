import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {loadPlaywright} from './qa-playwright.mjs';
import {createLobbyServer} from '../../dist-lobby/lobby.mjs';

const {chromium}=loadPlaywright();
const output=process.env.QA_OUTPUT??'work/render-lobby-browser';await mkdir(output,{recursive:true});
let server,port;const publicDir=fileURLToPath(new URL('../../dist-lobby/public/',import.meta.url));
async function local(){server=createLobbyServer({publicDir});server.listen(port??0,'127.0.0.1');await once(server,'listening');port=server.address().port;return `http://127.0.0.1:${port}`;}
const base=process.env.QA_URL??await local();
const browser=await chromium.launch({channel:'msedge',headless:true});
const contextA=await browser.newContext({acceptDownloads:true}),contextB=await browser.newContext({acceptDownloads:true,viewport:{width:390,height:844}});
const a=await contextA.newPage(),b=await contextB.newPage();
const errors=[];for(const page of [a,b])page.on('pageerror',e=>errors.push(e.message));
const code=String(1000+Math.floor(Math.random()*9000));
const results={url:base,code,checkedAt:new Date().toISOString(),testNetwork:'本机自动化浏览器；不代表中国大陆无 VPN 网络',checks:{},mainlandNoVpn:'pending-real-user-test'};
async function setup(page,name){await page.goto(base,{waitUntil:'domcontentloaded',timeout:180_000});await page.locator('#region').fill('本机自动化测试（非国内实测）');await page.locator('#network').fill('开发电脑浏览器；VPN 情况未判定');await page.locator('#player').fill(name);await page.locator('#code').fill(code);}
async function connected(page){await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('已进入'),undefined,{timeout:180_000});}
async function report(page){const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#download').click()]);const raw=await readFile(await download.path(),'utf8');assert.ok(!/resumeKey|deviceId|keyHash|"token"/.test(raw));return JSON.parse(raw);}
try{
 await Promise.all([setup(a,'房主测试'),setup(b,'访客测试')]);
 if(server){let n=0;await a.route('**/api/lobby/health',async route=>{if(++n===1)await route.fulfill({status:503,body:'waking'});else if(n===2)await route.fulfill({status:200,body:'<!doctype html>Render waking'});else await route.continue();});}
 await a.locator('#connect').click();await connected(a);await b.locator('#connect').click();await connected(b);
 if(server){const coldReport=await report(a);assert.ok(coldReport.log.filter(r=>r.message.includes('次连接未完成')).length>=2);results.checks.wake503AndLoadingHtmlRetry=true;results.wakeReport=coldReport;}
 await a.waitForFunction(()=>document.querySelectorAll('#members li').length===2);await b.waitForFunction(()=>document.querySelectorAll('#members li').length===2);
 results.checks.joinAndSync=true;
 await b.locator('#ready').click();await a.waitForFunction(()=>[...document.querySelectorAll('#members li')].some(x=>x.textContent.includes('访客测试')&&x.textContent.includes('已准备')));
 await b.locator('#player').fill('改名测试');await b.locator('#rename').click();await a.waitForFunction(()=>document.querySelector('#members').textContent.includes('改名测试'));results.checks.readyAndRename=true;
 await contextB.setOffline(true);await a.waitForFunction(()=>document.querySelector('#members').textContent.includes('已掉线'));
 await contextB.setOffline(false);await connected(b);await a.waitForFunction(()=>!document.querySelector('#members').textContent.includes('已掉线'));results.checks.offlineAndRejoin=true;
 if(server){
  const ws=await fetch(base+'/api/lobby/health');const before=await ws.json();
  await new Promise(resolve=>server.close(resolve));await local();
  await connected(a);await connected(b);await a.waitForFunction(()=>document.querySelectorAll('#members li').length===2);
  const after=await(await fetch(base+'/api/lobby/health')).json();assert.notEqual(before.instance,after.instance);
  await a.waitForFunction(()=>document.querySelector('#log').textContent.includes('原房间席位已失效'));
  results.checks.restartClearsRoomAndAutoRejoins=true;
 }
 await a.locator('#leave').click();await b.waitForFunction(()=>document.querySelectorAll('#members li').length===1&&document.querySelector('#members').textContent.includes('房主'));results.checks.hostMigration=true;
 if(process.env.QA_STABILITY_SECONDS){
  const duration=Number(process.env.QA_STABILITY_SECONDS);assert.ok([300,600].includes(duration));
  await b.locator('#duration').selectOption(String(duration));await b.locator('#stability').click();
  console.log(JSON.stringify({phase:'browser-stability',seconds:duration,url:base}));
  await b.waitForFunction(()=>document.querySelector('#stabilityStatus').textContent.includes('本次连续连接通过'),undefined,{timeout:(duration+45)*1000});
  results.checks.foregroundStability=true;
 }
 const downloaded=await report(b);assert.equal(downloaded.vpnOffSelfConfirmed,false);assert.equal(downloaded.metrics.http,'成功');assert.equal(downloaded.metrics.wss,'成功');results.report=downloaded;
 const dimensions=await b.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(dimensions.scroll<=dimensions.width);results.checks.mobileLayout=true;
 await b.screenshot({path:output+'/mobile.png',fullPage:true});await a.screenshot({path:output+'/desktop.png',fullPage:true});
 await b.locator('#leave').click();assert.equal(errors.length,0,errors.join('\n'));results.checks.noPageErrors=true;
 await writeFile(output+'/result.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}catch(e){results.error=e.message;await writeFile(output+'/failure.json',JSON.stringify(results,null,2));throw e;}
finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
