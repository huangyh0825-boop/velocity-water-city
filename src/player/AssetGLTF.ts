import {LoadingManager,TextureLoader,Texture} from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {fetchRuntimeModel} from './ModelTransport';import {assetCache} from './AssetCache';import {assetRetry} from '../core/AssetActivity';
import {loadTextureSource} from './TextureResources';
import {modelTransports} from '../generated/modelTransports';
/** Keep glTF's material/color/UV setup; only replace external-image transport. */
class StreamingTextures extends TextureLoader{
 override load(url:string,onLoad?:(value:Texture)=>void,_progress?:unknown,onError?:(error:unknown)=>void){
  const texture=new Texture();this.manager.itemStart(url);
  void loadTextureSource(url).then(t=>onLoad?.(t)).catch(error=>{this.manager.itemError(url);onError?.(Object.assign(error instanceof Error?error:Error(String(error)),{assetTexture:true}));}).finally(()=>this.manager.itemEnd(url));return texture;
 }
}
export function assetGLTFLoader(){const manager=new LoadingManager(),textures=new StreamingTextures(manager);manager.addHandler(/\.(webp|png|jpe?g)(?:\?.*)?$/i,textures);const loader=new GLTFLoader(manager);
 // Embedded city images use glTF's default image loader, not URI handlers.
 // Route both paths through the same Source pool without changing glTF maps.
 loader.register(parser=>{parser.textureLoader=textures;return{name:'SHARED_TEXTURE_SOURCES'};});return loader;}
export async function loadAssetGLTF(url:string,configure=(loader:GLTFLoader)=>loader){
 const absolute=new URL(url,document.baseURI).href,uri=new URL(absolute).pathname.split('/models/')[1],packed=(modelTransports as Record<string,string>)[uri??''],primary=packed?new URL(`${import.meta.env.BASE_URL}models/${packed}`,document.baseURI).href:absolute;
 for(let attempt=0;;attempt++){let used=primary,data:ArrayBuffer;try{data=await fetchRuntimeModel(primary);}catch(error){if(primary===absolute)throw error;used=absolute;data=await fetchRuntimeModel(absolute);}try{return await configure(assetGLTFLoader()).parseAsync(data,new URL('.',absolute).href);}catch(error){if(error&&typeof error==='object'&&'assetTexture'in error)throw error;await assetCache(used)?.clear();if(attempt>=1)throw error;assetRetry();}}
}
