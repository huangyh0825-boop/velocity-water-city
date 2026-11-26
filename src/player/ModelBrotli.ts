import init,{decompress} from 'brotli-dec-wasm/web';
import wasmUrl from 'brotli-dec-wasm/web/bg.wasm?url';

let decoder:ReturnType<typeof init>|undefined;

async function loadDecoder(){
 const response=await fetch(wasmUrl,{signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('模型解码器下载失败');
 return init({module_or_path:await response.arrayBuffer()});
}

/** Runs on the model worker after the compressed bytes pass SHA-256. */
export async function decodeModelBrotli(data:ArrayBuffer):Promise<ArrayBuffer>{
 decoder??=loadDecoder();
 await decoder;
 const decoded=decompress(new Uint8Array(data));
 if(decoded.buffer instanceof ArrayBuffer&&decoded.byteOffset===0&&decoded.byteLength===decoded.buffer.byteLength)
  return decoded.buffer;
 return Uint8Array.from(decoded).buffer;
}
