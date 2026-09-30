import {cp,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),dist=path.join(root,'dist');
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
for(const entry of ['src','public','resources','scripts/serve.js','scripts/verify-production.js','package.json']){const destination=path.join(dist,entry);await mkdir(path.dirname(destination),{recursive:true});await cp(path.join(root,entry),destination,{recursive:true});}
console.log('Production files written to dist/. Run with: npm start (from dist)');

