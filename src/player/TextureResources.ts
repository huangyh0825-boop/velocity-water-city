import * as THREE from 'three';import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {fetchAssetBytes} from './ModelTransport';import {assetCache} from './AssetCache';import {assetProgress,assetRetry} from '../core/AssetActivity';import {gpuTextures} from '../generated/gpuTextures';
type Entry={path:string;srgb:boolean;width:number;height:number};
const manifest=gpuTextures as {byURI:Record<string,Entry>;byHash:Record<string,Entry>};
const sources=new Map<string,Promise<THREE.Texture>>(),resolved=new Set<THREE.Texture>();let games=0,pending=0,loader:KTX2Loader|undefined,compressed=false;
/** Decoded sources are shared by glTF sampler clones, and released after the
 * last game and pending decode. No model, texture resolution or map is removed. */
export function retainTextureResources(renderer:THREE.WebGLRenderer){
 games++;compressed=renderer.extensions.has('EXT_texture_compression_bptc')||renderer.extensions.has('WEBGL_compressed_texture_astc')||renderer.extensions.has('WEBGL_compressed_texture_etc');
 if(compressed&&!loader)loader=new KTX2Loader().setTranscoderPath(new URL(`${import.meta.env.BASE_URL}decoders/basis/`,document.baseURI).href).setWorkerLimit(2).detectSupport(renderer);
 let released=false;return()=>{if(released)return;released=true;games--;cleanup();};
}
function cleanup(){if(games||pending)return;const images=new Set<unknown>();for(const t of resolved){t.dispose();const image=t.image;if(image&&!images.has(image)){images.add(image);if(typeof image.close==='function')image.close();}}resolved.clear();sources.clear();loader?.dispose();loader=undefined;compressed=false;}
const remember=(key:string,create:()=>Promise<THREE.Texture>)=>{let value=sources.get(key);if(!value){value=create().then(t=>{resolved.add(t);return t;}).catch(e=>{sources.delete(key);throw e;});sources.set(key,value);}return value;};
async function bitmap(url:string,data?:ArrayBuffer,key='image:'+url){return remember(key,async()=>{
 for(let attempt=0;;attempt++){const bytes=data??await fetchAssetBytes(url);try{const blob=new Blob([bytes]),texture=new THREE.Texture();
  const safari=/^((?!chrome|android).)*safari/i.test(navigator.userAgent),version=safari?Number(/Version\/(\d+)/.exec(navigator.userAgent)?.[1]??0):100;
  if(typeof createImageBitmap==='function'&&(!safari||version>=17))texture.image=await createImageBitmap(blob,{colorSpaceConversion:'none',premultiplyAlpha:'none'});
  else{const local=URL.createObjectURL(blob);try{texture.image=await new THREE.ImageLoader().loadAsync(local);}finally{URL.revokeObjectURL(local);}}
  texture.needsUpdate=true;assetProgress();return texture;
 }catch(error){data=undefined;await assetCache(url)?.clear();if(attempt>=1)throw error;assetRetry();}}
 });}
async function encoded(entry:Entry){const url=new URL(`${import.meta.env.BASE_URL}models/${entry.path}`,document.baseURI).href;return remember('ktx:'+url,async()=>{const bytes=await fetchAssetBytes(url);if(!loader)throw Error('Texture decoder no longer active');return new Promise<THREE.Texture>((resolve,reject)=>loader!.parse(bytes,resolve,reject));});}
export async function loadTextureSource(url:string){pending++;try{
 const uri=new URL(url,document.baseURI).pathname.split('/models/')[1],direct=uri?manifest.byURI[decodeURIComponent(uri)]:undefined;
 if(compressed&&direct){try{return(await encoded(direct)).clone();}catch{/* Original lossless image remains the fallback. */}}
 let bytes:ArrayBuffer|undefined;
 if(url.startsWith('blob:')){bytes=await fetch(url).then(r=>r.arrayBuffer());const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes!))).map(b=>b.toString(16).padStart(2,'0')).join(''),entry=manifest.byHash[hash];
  if(compressed&&entry){try{return(await encoded(entry)).clone();}catch{/* Keep the original embedded image if decoding fails. */}}
  return(await bitmap(url,bytes,'content:'+hash)).clone();
 }
 return(await bitmap(url,bytes)).clone();
 }finally{pending--;cleanup();}}
export function textureResourceStats(){return{games,pending,sources:sources.size,decoded:resolved.size,compressed};}
