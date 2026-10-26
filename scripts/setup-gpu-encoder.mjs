import {mkdir,readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
// Optional offline authoring dependency. Production builds use checked-in KTX2
// files and never download or execute this encoder.
const root='.qa/tools/ktx2-encoder',archive=root+'/package.tgz',integrity='gEWkw2YUlhKO4hXhqVLQQWJ+fGJObsXIwz0pGjJMclnQ4MQU3SAtN1MzutjFxO3ejWvxHyvFk5kr8+RtLmHiTA==';
await mkdir(root,{recursive:true});
try{await readFile(archive);}catch{execFileSync(process.platform==='win32'?'curl.exe':'curl',['-fL','--retry','2','https://registry.npmjs.org/ktx2-encoder/-/ktx2-encoder-0.6.0.tgz','-o',archive],{stdio:'inherit'});}
const hash=createHash('sha512').update(await readFile(archive)).digest('base64');if(hash!==integrity)throw Error('Encoder archive integrity mismatch; extraction refused.');
execFileSync('tar',['-xf',archive,'-C',root,'package/dist/basis/basis_encoder.js','package/dist/basis/basis_encoder.wasm'],{stdio:'inherit'});console.log('Pinned offline UASTC encoder ready; project dependencies unchanged.');
