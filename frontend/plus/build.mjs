import {build} from 'esbuild';
import {mkdirSync,writeFileSync,renameSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const dir=new URL('../../src/ufo/performance/react-assets/',import.meta.url);
const sha=data=>createHash('sha256').update(data).digest('hex');
const result=await build({entryPoints:['src/entry.tsx'],bundle:true,minify:true,format:'iife',target:['es2020'],jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},write:false,loader:{'.css':'text'},legalComments:'inline'});
const code=result.outputFiles[0].contents;
// Page styles (src/page.css): the dashboard inlines this one file in <head>, after its own styles. Nesting is lowered.
const css=(await build({entryPoints:['src/page.css'],bundle:true,minify:true,write:false,target:['chrome100','safari15','firefox100']})).outputFiles[0].contents;
mkdirSync(dir,{recursive:true});
writeFileSync(new URL('overview.js.tmp',dir),code);
writeFileSync(new URL('page.css.tmp',dir),css);
writeFileSync(new URL('manifest.json.tmp',dir),JSON.stringify({schema_version:1,sha256:sha(code),page_css_sha256:sha(css)})+'\n');
renameSync(new URL('overview.js.tmp',dir),new URL('overview.js',dir));
renameSync(new URL('page.css.tmp',dir),new URL('page.css',dir));
renameSync(new URL('manifest.json.tmp',dir),new URL('manifest.json',dir));
console.log(`Built self-contained React Overview (${Math.round(code.length/1024)} KiB) and page styles (${Math.round(css.length/1024)} KiB).`);
