import {createRequire} from 'node:module'; const require=createRequire(new URL('../../package.json', import.meta.url)); const {chromium}=require('playwright');
const dir=process.argv[2]; const names=JSON.parse(process.argv[3]);
const b=await chromium.launch({args:['--allow-file-access-from-files']}); const p=await b.newPage({viewport:{width:360,height:300},deviceScaleFactor:3});
for(const n of names){ await p.goto(`file://${dir}/${n}.html`); await p.waitForTimeout(250); await p.screenshot({path:`${dir}/${n}.png`,fullPage:true}); }
await b.close();
