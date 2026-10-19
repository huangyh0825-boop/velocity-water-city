import {loadPlaywright} from './qa-playwright.mjs';
import {writeFileSync} from 'node:fs';
const {chromium}=loadPlaywright(),browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const p=await browser.newPage({viewport:{width:1600,height:1000}}),cdp=await p.context().newCDPSession(p);
 await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:2000});await cdp.send('Profiler.start');
 await p.goto('http://127.0.0.1:5177/scripts/qa/vertical.html',{waitUntil:'commit'});await p.waitForFunction(()=>window.verticalQA,null,{timeout:180000});await p.evaluate(()=>window.verticalQA.ready());
 const {profile}=await cdp.send('Profiler.stop');writeFileSync('docs/startup-performance/startup.cpuprofile',JSON.stringify(profile));
 const top=profile.nodes.map(n=>({...n.callFrame,hits:n.hitCount??0})).sort((a,b)=>b.hits-a.hits).slice(0,35);writeFileSync('docs/startup-performance/startup-cpu.json',JSON.stringify(top,null,2));console.log(JSON.stringify(top.slice(0,22),null,2));
}finally{await browser.close()}
