import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import assert from 'node:assert/strict';

// Decode 8-bit RGB/RGBA browser PNGs without adding runtime dependencies.
function png(path){
 const b=readFileSync(path),data=[];let width,height,channels;
 for(let p=8;p<b.length;){const n=b.readUInt32BE(p),type=b.toString('ascii',p+4,p+8),part=b.subarray(p+8,p+8+n);if(type==='IHDR'){width=part.readUInt32BE(0);height=part.readUInt32BE(4);assert.equal(part[8],8);assert.equal(part[12],0);channels=part[9]===6?4:part[9]===2?3:0;assert.ok(channels);}if(type==='IDAT')data.push(part);p+=n+12;}
 const packed=inflateSync(Buffer.concat(data)),stride=width*channels,pixels=Buffer.alloc(stride*height);
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 let p=0;
 for(let y=0;y<height;y++){const filter=packed[p++];for(let x=0;x<stride;x++){const i=y*stride+x,a=x>=channels?pixels[i-channels]:0,b=y?pixels[i-stride]:0,c=y&&x>=channels?pixels[i-stride-channels]:0;pixels[i]=(packed[p++]+[0,a,b,(a+b)>>1,paeth(a,b,c)][filter])&255;}}
 return{width,height,channels,pixels};
}
const folder='docs/performance-review';mkdirSync(folder,{recursive:true});
const poses=readFileSync('.qa/performance/final-before/poses.json','utf8');assert.equal(poses,readFileSync('.qa/performance/final-after/poses.json','utf8'));
const names={waterNear:'水面近景',waterFar:'水面远景',wake:'高速尾浪',racer:'快艇与车手',district:'建筑密集区',five:'五艘快艇同屏'},differences={};
for(const [key]of Object.entries(names)){
 const paths=['before','after'].map(label=>`.qa/performance/final-${label}/${key}.png`),[a,b]=paths.map(png);assert.equal(a.width,b.width);assert.equal(a.height,b.height);assert.equal(a.channels,b.channels);
 let sum=0,max=0,changed=0,over1=0,over5=0;
 for(let i=0;i<a.width*a.height;i++){let delta=0;for(let c=0;c<3;c++){const d=Math.abs(a.pixels[i*a.channels+c]-b.pixels[i*b.channels+c]);sum+=d;max=Math.max(max,d);delta=Math.max(delta,d);}changed+=Number(delta>0);over1+=Number(delta>1);over5+=Number(delta>5);}
 differences[key]={width:a.width,height:a.height,identical:changed===0,changedPixels:changed,over1,over5,maxChannelDelta:max,meanAbsoluteRGB:sum/(a.width*a.height*3)};
 paths.forEach((p,i)=>copyFileSync(p,`${folder}/${key}-${i?'after':'before'}.png`));
}
const measurements={};for(const label of ['final-before','final-after','repeat-before','repeat-after']){
 const result=JSON.parse(readFileSync(`.qa/performance/${label}/results.json`));measurements[label]={metadata:result.metadata,summary:result.summary,errors:result.errors};
 copyFileSync(`.qa/performance/${label}/results.json`,`${folder}/${label}-raw.json`);
}
for(const pair of [['final-before','final-after'],['repeat-before','repeat-after']]){
 const[a,b]=pair.map(label=>measurements[label]);assert.equal(JSON.stringify({...a.metadata,revision:null}),JSON.stringify({...b.metadata,revision:null}));
 for(const name of Object.keys(a.summary)){for(const key of ['draws','triangles','state','memory'])assert.deepEqual(a.summary[name][key],b.summary[name][key],`${pair}/${name}/${key}`);}
}
writeFileSync(`${folder}/measurements.json`,JSON.stringify(measurements,null,2));writeFileSync(`${folder}/visual-diff.json`,JSON.stringify(differences,null,2));writeFileSync(`${folder}/poses.json`,poses);
const rows=Object.entries(measurements['final-before'].summary).map(([name,a])=>{const b=measurements['final-after'].summary[name];return `<tr><td>${name}</td><td>${a.fps.toFixed(1)} → ${b.fps.toFixed(1)}</td><td>${a.meanMs.toFixed(2)} → ${b.meanMs.toFixed(2)}</td><td>${a.onePercentLow.toFixed(1)} → ${b.onePercentLow.toFixed(1)}</td><td>${a.draws.toFixed(1)}</td></tr>`;}).join('');
const cards=Object.entries(names).map(([key,label])=>`<section><h2>${label}</h2><p>${differences[key].identical?'逐像素完全相同':`有差异的像素 ${differences[key].changedPixels} / 1600000，RGB平均绝对差 ${differences[key].meanAbsoluteRGB.toFixed(7)} / 255`}</p><div class="compare" style="--split:50%"><img src="${key}-before.png" alt="${label}优化前"><div class="overlay"><img src="${key}-after.png" alt="${label}优化后"></div><b>优化前</b><b class="right">优化后</b></div><label class="slider">拖动比较 <input type="range" min="0" max="100" value="50" aria-label="${label}前后分界"></label><p><a href="${key}-before.png">原图：优化前</a> · <a href="${key}-after.png">原图：优化后</a></p></section>`).join('');
writeFileSync(`${folder}/index.html`,`<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>极速水城 · 无降质性能对照</title><style>*{box-sizing:border-box}body{margin:0;background:#101b25;color:#e3edf3;font:16px/1.65 system-ui,sans-serif}main{max-width:1400px;margin:auto;padding:32px}h1{font-size:30px}h2{font-size:22px}a{color:#70d4ff}section{margin:40px 0;padding:20px;background:#182b39;border:1px solid #395366;border-radius:12px}.compare{position:relative;line-height:0}.compare img{width:100%;height:auto}.overlay{position:absolute;inset:0;clip-path:inset(0 0 0 var(--split))}.compare b{position:absolute;top:12px;left:12px;background:#001a2bce;padding:8px;line-height:1.3}.compare .right{left:auto;right:12px}.slider{display:flex;align-items:center;gap:16px;margin-top:16px}input{flex:1}table{border-collapse:collapse;width:100%;font-size:14px}td,th{padding:10px;border-bottom:1px solid #395366;text-align:left}small{color:#b4c7d5}</style><main><h1>极速水城 · 性能优化验收对照</h1><p>2026-10-17 · RTX 4060 Laptop GPU / Edge / WebGL2 / 1600 × 1000 / DPR 1 / 标准画质。模型与贴图文件保持原样；驾驶、AI、碰撞、赛道与比赛代码没有修改。</p><p>下面六组截图使用相同相机、1.1666667秒模拟时间、水面相位和随机种子。左右拖动分界线；原图可单独打开。<a href="visual-diff.json">像素差异</a> · <a href="poses.json">相机与时间</a> · <a href="measurements.json">性能汇总</a></p><h2>生产构建：确定性回放</h2><p>每个场景预热180帧后采样180帧；每帧推进一个60Hz物理步。FPS来自浏览器RAF间隔，GPU查询另跑，避免测量干扰。它是可重复渲染负载对照，不等同于真实玩家整圈平均帧率；真实循环结果及限制见上级目录的性能报告。1% Low仅取最慢两帧，短样本容易波动。</p><table><thead><tr><th>场景</th><th>平均FPS 前→后</th><th>平均帧时间ms 前→后</th><th>1% Low 前→后</th><th>Draw Calls（前后相同）</th></tr></thead><tbody>${rows}</tbody></table><p>五艇同屏依然受高精度模型与反射的GPU成本限制，未达到稳定60FPS。静止场景及部分1% Low没有改善；不宣称所有情况下均提速。</p>${cards}<p>本轮完成后停止开发，等待试玩；没有部署。</p></main><script>document.querySelectorAll('input').forEach(input=>input.addEventListener('input',()=>input.closest('section').querySelector('.compare').style.setProperty('--split',input.value+'%')));</script></html>`);
console.log(JSON.stringify({differences,matchedDrawsTrianglesStateAndMemory:true},null,2));
