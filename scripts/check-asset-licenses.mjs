import fs from 'node:fs';
import assert from 'node:assert/strict';
const a=JSON.parse(fs.readFileSync(new URL('../apps/studio/public/photos/licenses.json',import.meta.url)));
const b=JSON.parse(fs.readFileSync(new URL('../apps/studio/src/photo-licenses.json',import.meta.url)));
assert.deepEqual(a,b,'Photo attribution copies differ');
for(const row of a){
  assert(row.license && row.sourceUrl && row.creator,'Incomplete asset attribution');
  assert(new URL(row.sourceUrl).protocol==='https:','Source must use HTTPS');
}
console.log(`Verified ${a.length} photo attribution entries and identical manifests`);
