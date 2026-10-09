// Run: node scripts/package-public.mjs <output-directory> <notice-directory>
// Stage only reviewed public source and the main Studio executable.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.resolve(process.argv[2]??path.join(root,'artifacts','public-release'));
const notices=path.resolve(process.argv[3]??path.join(root,'artifacts','notices'));
const version=JSON.parse(fs.readFileSync(path.join(root,'apps/studio/package.json'),'utf8')).version;
if(version!=='0.3.3')throw Error('Public packaging requires a checked and promoted 0.3.3 source');
const exe=path.join(root,'target/release/pcs-studio.exe');
const bytes=fs.readFileSync(exe),ascii=bytes.toString('latin1');
const asset=fs.readFileSync(path.join(root,'apps/studio/dist/index.html'),'utf8').match(/assets\/(index-[\w-]+\.js)/)?.[1];
if(!asset||!ascii.includes(asset))throw Error('Binary does not embed the current frontend');
if(/dev\.pcs\.(?:releaseqa033|uxqa033)/.test(ascii))throw Error('QA-identity binary must never be packaged');
const source=path.join(output,'PCS-'+version+'-source'),binary=path.join(output,'PCS-'+version+'-Windows-x64');
for(const folder of [source,binary]){if(fs.existsSync(folder))throw Error('Staging already exists: '+folder);fs.mkdirSync(folder,{recursive:true});}
const excluded=new Set(['.git','node_modules','dist','target','artifacts','gen','.DS_Store']);
const sourceRoots=['apps','packages','crates','scripts','docs','fixtures','.github','licenses'];
function copyFolder(from,to){fs.mkdirSync(to,{recursive:true});for(const entry of fs.readdirSync(from,{withFileTypes:true})){if(excluded.has(entry.name))continue;const src=path.join(from,entry.name),dest=path.join(to,entry.name);if(entry.isSymbolicLink())throw Error('Unexpected source symlink: '+src);if(entry.isDirectory())copyFolder(src,dest);else if(!/\.(exe|pdb|log|zip|bundle|tmp)$/i.test(entry.name))fs.copyFileSync(src,dest);}}
for(const folder of sourceRoots)copyFolder(path.join(root,folder),path.join(source,folder));
for(const name of ['.env.example','.gitattributes','.gitignore','package.json','package-lock.json','tsconfig.base.json','Cargo.toml','Cargo.lock','README.md','CHANGELOG.md','LICENSE','THIRD_PARTY_NOTICES.md','CONTRIBUTING.md','CODE_OF_CONDUCT.md','SECURITY.md'])fs.copyFileSync(path.join(root,name),path.join(source,name));
fs.copyFileSync(exe,path.join(binary,'Profile Customization Studio.exe'));
for(const name of ['LICENSE','THIRD_PARTY_NOTICES.md'])fs.copyFileSync(path.join(root,name),path.join(binary,name));
copyFolder(path.join(root,'licenses'),path.join(binary,'licenses'));
for(const folder of [source,binary])for(const name of ['NODE_LICENSES.txt','RUST_LICENSES.txt','SUPPLEMENTAL_LICENSES.txt'])fs.copyFileSync(path.join(notices,name),path.join(folder,name));
fs.copyFileSync(path.join(root,'docs/release-notes-0.3.3.md'),path.join(binary,'RELEASE_NOTES.md'));
fs.writeFileSync(path.join(binary,'START_HERE.txt'),'Profile Customization Studio '+version+'\r\n\r\nExtract this entire folder, then double-click Profile Customization Studio.exe.\r\nWindows 10/11 x64 and Microsoft Edge WebView2 Runtime are required.\r\nChoose Start tutorial or Skip on first launch. Restart from Help or Settings.\r\nSave project preserves editable work; Export saves images and profile packages.\r\nThe app is unsigned and does not automatically update.\r\nKeep these license notices with the app. The matching PCS-'+version+'-public-source.zip contains corresponding AGPL source; distribute both ZIPs together.\r\n');
function inventory(folder){const entries=[];function scan(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory())scan(p);else{const b=fs.readFileSync(p);entries.push({path:path.relative(folder,p).replaceAll('\\','/'),bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')});}}}scan(folder);return entries;}
for(const [name,folder] of [['source',source],['binary',binary]]){const items=inventory(folder);fs.writeFileSync(path.join(output,name+'-manifest.json'),JSON.stringify(items,null,2));console.log(name+': '+items.length+' files');}
console.log('Main app and corresponding source staged; no publication performed.');
