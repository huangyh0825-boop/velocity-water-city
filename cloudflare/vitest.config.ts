import {cloudflareTest} from '@cloudflare/vitest-plugin';
import {defineConfig} from 'vitest/config';

export default defineConfig({
 plugins:[cloudflareTest({wrangler:{configPath:'cloudflare/wrangler.jsonc'}})],
 test:{include:['cloudflare/tests/**/*.test.ts'],testTimeout:15_000,hookTimeout:15_000,fileParallelism:false}
});
