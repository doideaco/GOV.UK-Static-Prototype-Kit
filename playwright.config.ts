import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'tests/e2e',
 use:{baseURL:'http://localhost:8081'},
 webServer:{command:'node tooling/serve.mjs',url:'http://localhost:8081',reuseExistingServer:false,env:{TEST_PORT:'8081'}},
 projects:[{name:'desktop',use:{viewport:{width:1280,height:900}}},{name:'mobile',use:{viewport:{width:390,height:844}}}]
});
