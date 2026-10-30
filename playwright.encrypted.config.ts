import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'tests/encrypted',
 use:{baseURL:'http://localhost:8082'},
 webServer:{command:'node tooling/serve.mjs',url:'http://localhost:8082',reuseExistingServer:false,env:{TEST_OUTPUT:'_encrypted',TEST_PORT:'8082'}},
 projects:[{name:'desktop',use:{viewport:{width:1280,height:900}}},{name:'mobile',use:{viewport:{width:390,height:844}}}]
});
