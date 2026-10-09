// Optional maintainer smoke check; attach only to your isolated QA instance.
// Install Playwright separately or set PCS_PLAYWRIGHT_MODULE to its module path.
const {chromium}=require(process.env.PCS_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const url=process.env.PCS_CDP_URL||'http://127.0.0.1:9523';
assert(['127.0.0.1','localhost'].includes(new URL(url).hostname),'Only local QA instances are supported');
const output=path.resolve(process.env.PCS_SMOKE_OUTPUT||'artifacts/native-smoke');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.connectOverCDP(url),page=browser.contexts()[0].pages()[0];page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const original=window.fetch.bind(window);window.fetch=(input,init)=>decodeURIComponent(String(input)).includes('secure_get_secret')?Promise.resolve(new Response('null',{headers:{'Tauri-Response':'ok','Content-Type':'application/json'}})):original(input,init);});
 const qaData=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('plugin:path|resolve_directory',{directory:14}));
 assert(String(qaData).includes('dev.pcs.publicationqa'),'Rebuild with the documented QA identifier before running this test');
 await page.reload();await page.getByRole('button',{name:'Create New',exact:true}).waitFor();
 const results=[];
 for(const [width,height] of [[1366,768],[960,640]]){
  await page.evaluate(async({width,height})=>window.__TAURI_INTERNALS__.invoke('plugin:window|set_size',{label:'main',value:{Logical:{width,height}}}),{width,height});
  await page.waitForTimeout(200);
  results.push({screen:'Home',requested:[width,height],overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
  await page.screenshot({path:path.join(output,`home-${width}.png`)});
 }
 await page.getByRole('button',{name:'Create New',exact:true}).click();await page.getByRole('button',{name:'Create Project',exact:true}).click();
 const tabs=await page.getByRole('tab').allTextContents();
 for(const name of tabs){
  await page.getByRole('tab',{name:name.trim(),exact:true}).click();await page.waitForTimeout(200);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  results.push({screen:name,overflow});await page.screenshot({path:path.join(output,`screen-${name.trim().replace(/[^a-z0-9]/ig,'-')}.png`)});
 }
 results.push({pageErrors:errors});fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify(results));await browser.close();assert.equal(errors.length,0,'Native UI emitted page errors');assert(results.filter(x=>'overflow'in x).every(x=>!x.overflow),'Native UI has document overflow');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
