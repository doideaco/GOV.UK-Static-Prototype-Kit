import { defineConfig } from '@playwright/test';
const port = process.env.TEST_PORT || '8082';
const origin = `http://localhost:${port}`;
export default defineConfig({
 testDir:'tests/encrypted',
 use:{baseURL:origin},
 webServer:{command:'node tooling/serve.mjs',url:origin,reuseExistingServer:false,env:{TEST_OUTPUT:'_encrypted',TEST_PORT:port}},
 projects:[{name:'desktop',use:{viewport:{width:1280,height:900}}},{name:'mobile',use:{viewport:{width:390,height:844}}}]
});
