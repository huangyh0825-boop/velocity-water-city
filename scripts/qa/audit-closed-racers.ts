import {visualGeometry} from '../../tests/helpers/visual-glb';import * as THREE from 'three';import {mkdir,writeFile} from 'node:fs/promises';
// Analysis only. Never changes a mesh, its triangle order or rendering side.
const {scene}=await visualGeometry('watercraft-efficient',true),report:any[]=[];
scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const g=o.geometry,p=g.getAttribute('position'),index=g.index!,weld=new Map<string,number>(),ids=new Uint32Array(p.count);
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(','),previous=weld.get(key);if(previous===undefined){ids[i]=weld.size;weld.set(key,ids[i]);}else ids[i]=previous;}
 const edges=new BigUint64Array(index.count);let count=0,degenerate=0;for(let i=0;i<index.count;i+=3){const a=ids[index.getX(i)],b=ids[index.getX(i+1)],c=ids[index.getX(i+2)];if(a===b||b===c||a===c){degenerate++;continue;}for(const[x,y]of[[a,b],[b,c],[c,a]]){const lo=Math.min(x,y),hi=Math.max(x,y);edges[count++]=(BigInt(lo)<<33n)|(BigInt(hi)<<1n)|BigInt(x>y?1:0);}}
 const sorted=edges.subarray(0,count);sorted.sort();let boundary=0,nonmanifold=0,inconsistent=0;for(let i=0;i<count;){let j=i+1;while(j<count&&(sorted[j]>>1n)===(sorted[i]>>1n))j++;if(j-i===1)boundary++;else if(j-i!==2)nonmanifold++;else if((sorted[i]^sorted[i+1])!==1n)inconsistent++;i=j;}
 const row={name:o.name,material:(o.material as THREE.Material).name,triangles:index.count/3,vertices:p.count,welded:weld.size,boundary,nonmanifold,inconsistent,degenerate,closed:!boundary&&!nonmanifold&&!inconsistent};report.push(row);console.log(row.material,row.closed?'closed':'keep double-sided',boundary,nonmanifold,inconsistent);
});
await mkdir('work/resource-quality/round2',{recursive:true});await writeFile('work/resource-quality/round2/closed-audit.json',JSON.stringify(report,null,2));
