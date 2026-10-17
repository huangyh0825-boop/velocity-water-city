import{CatmullRomCurve3,Vector3}from'three';import{elevation}from'../../src/track/Elevation';import{writeFileSync}from'node:fs';
const points=[[-250,-450],[-250,-160],[-300,100],[-100,310],[-270,500],[-80,730],[240,860],[650,860],[940,660],[1190,400],[1100,110],[820,-90],[790,-310],[1100,-430],[1070,-700],[700,-640],[280,-920],[-80,-820],[-440,-750],[-560,-570]],main=new CatmullRomCurve3(points.map(([x,z])=>new Vector3(x*.72,0,z*.72)),true,'centripetal');main.arcLengthDivisions=4096;
const a=main.getPointAt(.65),b=main.getPointAt(.86),ha=main.getTangentAt(.65),hb=main.getTangentAt(.86),right=new Vector3(ha.z,0,-ha.x),cut=new CatmullRomCurve3([a,a.clone().addScaledVector(ha,15),a.clone().addScaledVector(ha,90).addScaledVector(right,-20),a.clone().add(b).multiplyScalar(.5),b.clone().addScaledVector(hb,-45),b],false,'centripetal');cut.arcLengthDivisions=512;
const samples=Array.from({length:4096},(_,i)=>({p:main.getPointAt(i/4096),t:i/4096})),rows=[];let prior;
for(let i=1;i<128;i++){const q=i/128,p=cut.getPointAt(q),near=samples.reduce((u,v)=>p.distanceToSquared(v.p)<p.distanceToSquared(u.p)?v:u),tangent=main.getTangentAt(near.t),offset=(p.x-near.p.x)*tangent.z-(p.z-near.p.z)*tangent.x,deck=q<.07?0:q<.24?6-6*Math.cos(Math.PI*(q-.07)/.17):q<.40?12:q<.45?12+2*((q-.40)/.05)**2:0,ground=elevation(near.t,main.getLength()).height;
 if(i%8===0)console.log("SAMPLE",q,near.t,offset,deck,ground); if(prior&&prior.offset*offset<0)console.log('CROSS',q,near.t,deck,ground,'distance',p.distanceTo(near.p));
 if(q<.45&&q>.05&&p.distanceTo(near.p)<(near.t<.695?12:28)+6.5&&Math.abs(deck-ground)<6.5)rows.push({q,offset,deck,ground});prior={offset};
}
console.log({mainLength:main.getLength(),cutLength:cut.getLength(),clearanceConflicts:rows});
const sx=(x:number)=>70+(x+470)*.7,sy=(z:number)=>70+(z+710)*.7,path=(c:CatmullRomCurve3,n:number)=>Array.from({length:n+1},(_,i)=>{const p=c.getPointAt(i/n);return`${i?'L':'M'}${sx(p.x)},${sy(p.z)}`;}).join(' ');
writeFileSync('docs/vertical-track/crossover-plan.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1200"><rect width="1500" height="1200" fill="#112433"/><style>text{font:18px Microsoft YaHei,sans-serif;fill:#fff}</style><text x="40" y="32">规划修订：港湾控制点局部内移，形成高架桥跨线与14m腾空跨线</text><path d="${path(main,1024)}" stroke="#7bd7ed" stroke-width="12" fill="none"/><path d="${path(cut,128)}" stroke="#ca9aff" stroke-width="6" fill="none"/><text x="1050" y="170">主线仍约4.78km</text><text x="1050" y="210">仅局部调整港湾段</text><text x="1050" y="250">分叉净空：主线局部收窄至24m</text><text x="1050" y="290">S2 45%处起跳，50%处飞越主线</text><text x="1050" y="330">主线8m坡顶区 / S2落差14m</text><text x="1050" y="370">验证交叉处实际净空再实现</text></svg>`);







