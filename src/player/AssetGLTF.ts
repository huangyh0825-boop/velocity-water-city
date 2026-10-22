import {LoadingManager,TextureLoader,Texture,ImageLoader} from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {fetchAssetBytes,fetchRuntimeModel} from './ModelTransport';import {assetCache} from './AssetCache';import {assetRetry,assetProgress} from '../core/AssetActivity';
/** Keep glTF's material/color/UV setup; only replace external-image transport. */
class StreamingTextures extends TextureLoader{
 override load(url:string,onLoad?:(value:Texture)=>void,_progress?:unknown,onError?:(error:unknown)=>void){
  const texture=new Texture();this.manager.itemStart(url);
  const decode=async()=>{for(let attempt=0;;attempt++){
   const data=await fetchAssetBytes(url);try{const blob=new Blob([data]);
   // Match Three's ImageBitmap color/premultiplication settings. Older Safari
   // retains the original HTMLImageElement path with a downloaded blob URL.
   const safari=typeof navigator!=='undefined'&&/^((?!chrome|android).)*safari/i.test(navigator.userAgent),version=safari?Number(/Version\/(\d+)/.exec(navigator.userAgent)?.[1]??0):100;
   if(typeof createImageBitmap==='function'&&(!safari||version>=17))texture.image=await createImageBitmap(blob,{colorSpaceConversion:'none',premultiplyAlpha:'none'});
   else{const local=URL.createObjectURL(blob);try{texture.image=await new ImageLoader().loadAsync(local);}finally{URL.revokeObjectURL(local);}}
   texture.needsUpdate=true;assetProgress();return texture;
  }catch(error){await assetCache(url)?.clear();if(attempt>=1)throw error;assetRetry();}}};
  void decode().then(t=>onLoad?.(t)).catch(error=>{this.manager.itemError(url);onError?.(Object.assign(error instanceof Error?error:Error(String(error)),{assetTexture:true}));}).finally(()=>this.manager.itemEnd(url));return texture;
 }
}
export function assetGLTFLoader(){const manager=new LoadingManager();manager.addHandler(/\.(webp|png|jpe?g)(?:\?.*)?$/i,new StreamingTextures(manager));return new GLTFLoader(manager);}
export async function loadAssetGLTF(url:string,configure=(loader:GLTFLoader)=>loader){
 const absolute=new URL(url,document.baseURI).href;
 for(let attempt=0;;attempt++){const data=await fetchRuntimeModel(absolute);try{return await configure(assetGLTFLoader()).parseAsync(data,new URL('.',absolute).href);}catch(error){if(error&&typeof error==='object'&&'assetTexture'in error)throw error;await assetCache(absolute)?.clear();if(attempt>=1)throw error;assetRetry();}}
}
