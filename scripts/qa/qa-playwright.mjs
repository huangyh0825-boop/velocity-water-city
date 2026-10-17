import{createRequire}from'node:module';import{homedir}from'node:os';import{join}from'node:path';
/** Local npm installation, explicit runtime, or the desktop's bundled QA runtime. */
export function loadPlaywright(){
 const require=createRequire(import.meta.url),candidates=[process.env.PLAYWRIGHT_MODULE,'playwright',join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean);
 for(const candidate of candidates)try{return require(candidate);}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
 throw Error('Playwright unavailable: install it locally or set PLAYWRIGHT_MODULE.');
}
