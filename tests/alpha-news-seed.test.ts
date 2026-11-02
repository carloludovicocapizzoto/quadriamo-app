import {expect,it} from 'vitest'
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,dirname,basename} from 'node:path'
import {spawnSync} from 'node:child_process'
it('offline seed generation requires explicit source approval and always emits inactive rows',()=>{
 const root=mkdtempSync(join(tmpdir(),'quadriamo-seed-')),input=join(root,'manifest.json'),output=join(root,'out')
 const safeRoot=dirname(root)===tmpdir()&&basename(root).startsWith('quadriamo-seed-')
 if(!safeRoot)throw Error('unsafe cleanup')
 const source={id:'synthetic',name:"Synthetic ' source",kind:'institution',feed:'https://feed.example.com/rss',site:'https://source.example.com',lang:'it',trust:4,rights:{titleAllowed:true,reference:'synthetic permission'}}
 const run=(approvedBy:string)=>{writeFileSync(input,JSON.stringify({approvedBy,sources:[source]}));return spawnSync(process.execPath,['tools/news/prepare-alpha.mjs',input,output],{encoding:'utf8'})}
 let failed=false,testError:unknown,cleanupError:unknown
 try{expect(run('').status).not.toBe(0);expect(run('synthetic-editor').status).toBe(0);const sql=readFileSync(join(output,'seed-inactive.sql'),'utf8');expect(sql).toContain("Synthetic '' source");expect(sql).toContain('false,false');expect(JSON.parse(readFileSync(join(output,'config.json'),'utf8')).ALPHA_NEWS_INGEST_ENABLED).toBe('0')
 const imageRights={allowed:true,reference:'https://source.example.com/licence',attribution:'Synthetic author',hosts:['images.example.com'],scope:'approved-urls',approvedUrls:['https://images.example.com/synthetic.svg']}
 writeFileSync(input,JSON.stringify({approvedBy:'synthetic-editor',sources:[{...source,imageRights}]}));expect(spawnSync(process.execPath,['tools/news/prepare-alpha.mjs',input,output]).status).toBe(0)
 expect(readFileSync(join(output,'seed-inactive.sql'),'utf8')).toContain('false,true')
 writeFileSync(input,JSON.stringify({approvedBy:'synthetic-editor',sources:[{...source,imageRights:{...imageRights,reference:''}}]}));expect(spawnSync(process.execPath,['tools/news/prepare-alpha.mjs',input,output],{stdio:'ignore'}).status).not.toBe(0)}
 catch(error){failed=true;testError=error}
 try{rmSync(root,{recursive:true,force:true})}catch(error){cleanupError=error}
 if(failed)throw testError
 if(cleanupError)throw cleanupError
})
