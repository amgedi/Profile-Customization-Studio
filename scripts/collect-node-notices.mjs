// Run after npm ci; release outputs are deliberately outside tracked source.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
const notices=['# Installed production dependency license texts\n'];
const missing=[];
for(const [relative,entry] of Object.entries(lock.packages)) {
  if(!relative.includes('node_modules/') || entry.dev || entry.link) continue;
  const folder=path.join(root,relative);
  if(!fs.existsSync(folder)) continue; // optional packages for other operating systems
  const pkg=JSON.parse(fs.readFileSync(path.join(folder,'package.json'),'utf8'));
  const licenses=fs.readdirSync(folder).filter(n=>/^(?:licen[cs]e|copying|notice)(?:[._-]|$)/i.test(n)&&fs.statSync(path.join(folder,n)).isFile());
  notices.push(`## ${pkg.name}@${pkg.version}\n\nDeclared license: ${JSON.stringify(pkg.license??'unspecified')}\n`);
  if(!licenses.length){const recorded=pkg.name==='gifenc'?path.join(root,'licenses','gifenc-MIT.txt'):null;if(recorded&&fs.existsSync(recorded))notices.push(fs.readFileSync(recorded,'utf8'));else missing.push(`${pkg.name}@${pkg.version}`);}
  for(const n of licenses)notices.push(`### ${n}\n\n${fs.readFileSync(path.join(folder,n),'utf8')}\n`);
}
const output=path.resolve(process.argv[2]??path.join(root,'artifacts','notices','NODE_LICENSES.txt'));
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,notices.join('\n'));
console.log(`Saved production license texts; ${missing.length} packages need manual license-text review.`);
if(missing.length){console.error(missing.join('\n'));process.exitCode=1;}
