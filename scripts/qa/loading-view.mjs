// Test-only transport surface; never imported by the production entry.
import {fetchRuntimeModel} from '../../src/player/ModelTransport';import {observeAssets,assetSnapshot} from '../../src/core/AssetActivity';
observeAssets(s=>document.querySelector('#activity').textContent=JSON.stringify(s));
window.loadingQA={stats:assetSnapshot,async load(url){const bytes=await fetchRuntimeModel(new URL(url,location.href).href);const digest=await crypto.subtle.digest('SHA-256',bytes);return{length:bytes.byteLength,sha:[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('')};}};
