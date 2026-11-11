import { defineConfig } from '@playwright/test';
const port = process.env.TEST_PORT || '8081';
const origin = `http://localhost:${port}`;
export default defineConfig({
 testDir:'tests/e2e',
 use:{baseURL:origin},
 webServer:{command:'node tooling/serve.mjs',url:origin,reuseExistingServer:false,env:{TEST_PORT:port}},
 projects:[{name:'desktop',use:{viewport:{width:1280,height:900}}},{name:'mobile',use:{viewport:{width:390,height:844}}}]
});
