import type {Env as LobbyEnv} from '../src/index';
declare global {
 namespace Cloudflare {
  interface Env extends LobbyEnv {}
  interface GlobalProps {mainModule:typeof import('../src/index');durableNamespaces:'LobbyRoom'}
 }
}
