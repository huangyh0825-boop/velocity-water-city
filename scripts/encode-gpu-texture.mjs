import {parentPort,workerData as job} from 'node:worker_threads';import {readFile,writeFile} from 'node:fs/promises';
import BASIS from '../.qa/tools/ktx2-encoder/package/dist/basis/basis_encoder.js';
const basis=await BASIS();basis.initializeBasis();const e=new basis.BasisEncoder(),start=performance.now();
try{e.setUASTC(true);e.setCreateKTX2File(true);e.setKTX2UASTCSupercompression(true);e.setMipGen(true);if(job.normal)e.setNormalMapPreset();e.setPerceptual(job.srgb);e.setKTX2AndBasisSRGBTransferFunc(job.srgb);e.setPackUASTCFlags(3);e.setRDOUASTC(false);e.setSliceSourceImage(0,new Uint8Array(await readFile(job.source)),0,0,1);
 const out=new Uint8Array(Math.ceil(job.width*job.height*4*4/3)+65536),length=e.encode(out);if(!length)throw Error('Texture encoding failed');await writeFile(job.target,out.subarray(0,length));parentPort.postMessage({...job,bytes:length,encodeMs:performance.now()-start});
}finally{e.delete();}
