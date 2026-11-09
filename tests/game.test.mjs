import {test} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {createHmac} from 'node:crypto';import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','lib/game/rules.ts','lib/game/auth.ts','lib/game/store.ts','lib/game/http.ts','--outDir','.sites-runtime/test-build','--module','commonjs','--target','es2022','--skipLibCheck','--types','@cloudflare/workers-types,node']);
writeFileSync('.sites-runtime/test-build/package.json','{"type":"commonjs"}');const require=createRequire(import.meta.url);const {initial,transition,restore,day}=require('../.sites-runtime/test-build/rules.js');const {telegramUser,identify}=require('../.sites-runtime/test-build/auth.js');const {handleGame}=require('../.sites-runtime/test-build/http.js');const {act,getState}=require('../.sites-runtime/test-build/store.js');
const now=Date.UTC(2026,10,6,20,59,59);
test('economy, evolution and collection',()=>{let s=initial(now);for(let i=0;i<4;i++)s=transition(s,'play',now+i*2000);assert.equal(s.level,2);assert.equal(s.coins,87);assert.equal(s.energy,10);assert.equal(s.collection.length,2);assert.throws(()=>transition(s,'play',now+10000),/15 энергии/);s=transition(s,'feed',now+10000);assert.equal(s.energy,30);assert.equal(s.coins,82)});
test('daily uses Moscow midnight; cannot claim twice',()=>{const s=transition(initial(now),'daily',now);assert.throws(()=>transition(s,'daily',now),/уже/);assert.equal(transition(s,'daily',now+1000).coins,90);assert.notEqual(day(now),day(now+1000))});
test('offer once, cooldown and full energy',()=>{let s=transition(initial(now),'offer',now);assert.throws(()=>transition(s,'offer',now),/уже/);s=transition(s,'feed',now);assert.throws(()=>transition(s,'play',now+100),/отдыхает/);s=transition(s,'feed',now+2000);assert.equal(s.energy,100);assert.throws(()=>transition(s,'feed',now+4000),/сыт/)});
test('energy restoration cannot bank excess time at cap',()=>{let s=restore(initial(now),now+3600000);assert.equal(s.energy,100);s=transition(s,'play',now+3600000);assert.equal(restore(s,now+3601000).energy,85)});
function signed(date=now,extra={}){const p=new URLSearchParams({auth_date:String(Math.floor(date/1000)),user:JSON.stringify({id:12345,first_name:'Tester'}),...extra});const check=[...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');const secret=createHmac('sha256','WebAppData').update('test-token').digest();p.set('hash',createHmac('sha256',secret).update(check).digest('hex'));return p.toString()}
test('Telegram signature, tampering, expired and duplicate fields',async()=>{const cfg={TELEGRAM_BOT_TOKEN:'test-token'};assert.equal(await telegramUser(signed(),cfg,now),'tg:12345');await assert.rejects(telegramUser(signed().replace('12345','99999'),cfg,now));await assert.rejects(telegramUser(signed(now-7200000),cfg,now));await assert.rejects(telegramUser(signed()+'&user=x',cfg,now));await assert.rejects(telegramUser(signed(),{},now));});
test('D1 transactions: concurrent claims, retries, isolation and persistence',async()=>{
 const {Miniflare}=await import('miniflare');const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB'],compatibilityDate:'2026-01-01'});
 try{const db=await mf.getD1Database('DB');await db.prepare('CREATE TABLE players (id TEXT PRIMARY KEY,state TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0)').run();await db.prepare('CREATE TABLE operations (player_id TEXT NOT NULL,key TEXT NOT NULL,action TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(player_id,key))').run();
 const results=await Promise.allSettled(Array.from({length:20},(_,i)=>act(db,'alice',`daily-${i}`,'daily',now)));assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal((await getState(db,'alice',now)).state.coins,70);
 const replay=await Promise.all(Array.from({length:10},()=>act(db,'bob','same-request','offer',now)));assert.equal((await getState(db,'bob',now)).state.coins,65);assert.equal(replay.filter(x=>!x.replayed).length,1);await assert.rejects(act(db,'bob','same-request','daily',now));assert.equal((await getState(db,'alice',now)).state.coins,70);
 const receipt=await db.prepare('SELECT COUNT(*) n FROM operations WHERE player_id=?').bind('bob').first();assert.equal(receipt.n,1);
 }finally{await mf.dispose()}
});

test('a retry sees a receipt committed between its receipt lookup and state read',async()=>{
 const {Miniflare}=await import('miniflare');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB'],compatibilityDate:'2026-01-01'});
 try{
  const db=await mf.getD1Database('DB');
  await db.exec('CREATE TABLE players (id TEXT PRIMARY KEY,state TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0); CREATE TABLE operations (player_id TEXT NOT NULL,key TEXT NOT NULL,action TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(player_id,key));');
  for(const action of ['daily','offer','play']){
   let interleaved=false;
   const racingDb={
    prepare(sql){
     const statement=db.prepare(sql);
     if(!sql.startsWith('SELECT action'))return statement;
     return {bind(...args){const bound=statement.bind(...args);return {async first(){
      const receipt=await bound.first();
      if(!interleaved){interleaved=true;await act(db,action,'same-request',action,now);}
      return receipt;
     }}}};
    },
    batch:db.batch.bind(db)
   };
   const result=await act(racingDb,action,'same-request',action,now);
   assert.equal(result.replayed,true);
   assert.equal(result.revision,1);
   assert.equal((await getState(db,action,now)).revision,1);
  }
 }finally{await mf.dispose()}
});

test('Telegram HMAC includes signature; rejects future dates and invalid users',async()=>{
 const cfg={TELEGRAM_BOT_TOKEN:'test-token'};
 assert.equal(await telegramUser(signed(now,{signature:'optional-ed25519-signature'}),cfg,now),'tg:12345');
 for(const raw of [signed(now+31000),signed(now,{user:'{"id":-1}'}),signed(now,{user:'invalid-json'}),signed(now,{user:'{"id":9007199254740992}'})])await assert.rejects(telegramUser(raw,cfg,now));
});

test('Telegram Ed25519 verifies the canonical payload and bot ID with an isolated test key',async(t)=>{
 const {generateKeyPairSync,sign}=await import('node:crypto');
 const {publicKey,privateKey}=generateKeyPairSync('ed25519');
 const rawKey=publicKey.export({format:'der',type:'spki'}).subarray(-32);
 const importKey=crypto.subtle.importKey.bind(crypto.subtle);
 // Telegram owns the production private key. Substitute only the imported
 // public key in this test; real WebCrypto verifies real signatures below.
 t.mock.method(crypto.subtle,'importKey',async(format,key,algorithm,...rest)=>{
  if(algorithm.name==='Ed25519'){
   assert.equal(Buffer.from(key).toString('hex'),'e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d');
   return importKey(format,rawKey,algorithm,...rest);
  }
  return importKey(format,key,algorithm,...rest);
 });
 const p=new URLSearchParams({user:JSON.stringify({id:12345,first_name:'Тест & + /'}),auth_date:String(now/1000),hash:'ignored-in-ed25519'});
 const check=`9246199848:WebAppData\nauth_date=${now/1000}\nuser=${p.get('user')}`;
 p.set('signature',sign(null,Buffer.from(check),privateKey).toString('base64url'));
 assert.equal(await telegramUser(p.toString(),{TELEGRAM_BOT_ID:'9246199848'},now),'tg:12345');
 await assert.rejects(telegramUser(p.toString(),{TELEGRAM_BOT_ID:'1'},now));
 await assert.rejects(telegramUser(p.toString().replace('12345','54321'),{TELEGRAM_BOT_ID:'9246199848'},now));
 p.set('signature','%%%');await assert.rejects(telegramUser(p.toString(),{TELEGRAM_BOT_ID:'9246199848'},now));
});

test('invalid Telegram credentials never fall back to a browser identity',async()=>{
 const request=new Request('https://game.test/api/game',{headers:{'x-telegram-init-data':'invalid','oai-authenticated-user-id':'browser-test'}});
 await assert.rejects(identify(request,{TELEGRAM_BOT_ID:'9246199848'}));
 await assert.rejects(identify(new Request(request.url),{}));
});

test('HTTP API: authenticated lifecycle, replay, profile isolation and rejected input',async()=>{
 const {Miniflare}=await import('miniflare');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB'],compatibilityDate:'2026-01-01'});
 try{
  const db=await mf.getD1Database('DB');
  // Exercise the actual checked-in migration, not a hand-written test schema.
  for(const sql of readFileSync('drizzle/0000_lame_havok.sql','utf8').split('--> statement-breakpoint'))await db.prepare(sql.trim()).run();
  const env={DB:db,TELEGRAM_BOT_TOKEN:'test-token'};
  const headers={'x-telegram-init-data':signed(Date.now()),origin:'https://game.test','content-type':'application/json','idempotency-key':'test-operation-0001'};
  const call=(body,extra={},method='POST')=>handleGame(new Request('https://game.test/api/game',{method,headers:{...headers,...extra},...(method==='POST'?{body:typeof body==='string'?body:JSON.stringify(body)}:{})}),env,method==='POST');
  let response=await call(undefined,{},'GET');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await response.json()).state.coins,50);
  response=await call({action:'daily'});assert.equal(response.status,200);assert.equal((await response.json()).state.coins,70);
  response=await call({action:'daily'});const replay=await response.json();assert.equal(response.status,200);assert.equal(replay.replayed,true);assert.equal(replay.state.coins,70);
  assert.equal((await call({action:'offer'})).status,409);
  assert.equal((await call({action:'daily'},{'idempotency-key':'test-operation-0002'})).status,409);
  assert.equal((await call({action:'offer'},{origin:'https://other.test'})).status,403);
  assert.equal((await call({action:'offer'},{'content-type':'text/plain'})).status,415);
  assert.equal((await call('{')).status,400);
  assert.equal((await call({action:'reset'})).status,400);
  assert.equal((await call({action:'offer'},{'idempotency-key':'short'})).status,400);
  assert.equal((await call(' '.repeat(2049))).status,413);
  assert.equal((await call(undefined,{'x-telegram-init-data':'bad'},'GET')).status,401);
  const browser=await call(undefined,{'x-telegram-init-data':'','oai-authenticated-user-id':'test-browser'},'GET');assert.equal((await browser.json()).state.coins,50);
  assert.equal((await call(undefined,{'x-telegram-init-data':''},'GET')).status,401);
  const final=await call(undefined,{},'GET');assert.equal((await final.json()).state.coins,70);
 }finally{await mf.dispose()}
});

test('pet choice preserves progression and migrates existing profiles without restarting them',()=>{
 const selectionTime=now-60000; // Stay within one Moscow day; the global fixture is one second before midnight.
 const {petIds}=require('../.sites-runtime/test-build/pets.js');
 let earned=transition(transition(initial(selectionTime),'daily',selectionTime),'offer',selectionTime);
 for(let i=0;i<4;i++)earned=transition(earned,'play',selectionTime+i*2000);
 for(const petId of petIds){
  const selected=transition(earned,`select:${petId}`,selectionTime+8000);
  assert.equal(selected.petId,petId);
  assert.throws(()=>transition(selected,'select:chudik',selectionTime+8000),e=>e.code==='pet_already_selected');
  assert.throws(()=>transition(selected,`select:${petId}`,selectionTime+8000),e=>e.code==='pet_already_selected');
  const {petId:ignored,...progress}=selected;
  const {petId:old,...expected}=restore(earned,selectionTime+8000);
  assert.deepEqual(progress,expected);
  assert.throws(()=>transition(selected,'daily',selectionTime+8000),/уже/);
  assert.throws(()=>transition(selected,'offer',selectionTime+8000),/уже/);
 }
 const legacy={...earned};delete legacy.petId;
 assert.equal(restore(legacy,selectionTime+8000).petId,'chudik');
 assert.equal(restore(legacy,selectionTime+8000).level,2);
 assert.throws(()=>transition(legacy,'select:luna',selectionTime+8000),e=>e.code==='pet_already_selected');
 assert.equal(initial(selectionTime).petId,null);
 assert.throws(()=>transition(earned,'select:unkselectionTimen',selectionTime),/питомца/);
});

test('D1 pet selection survives rereads and retries, isolates profiles and races safely with game actions',async()=>{
 const {Miniflare}=await import('miniflare');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB'],compatibilityDate:'2026-01-01'});
 try{
  const db=await mf.getD1Database('DB');
  for(const sql of readFileSync('drizzle/0000_lame_havok.sql','utf8').split('--> statement-breakpoint'))await db.prepare(sql.trim()).run();
  const results=await Promise.all(Array.from({length:8},()=>act(db,'pet-a','choose-luna','select:luna',now)));
  assert.equal(results.filter(result=>!result.replayed).length,1);
  assert.equal((await getState(db,'pet-a',now)).state.petId,'luna');
  assert.equal((await getState(db,'pet-b',now)).state.petId,null);
  await assert.rejects(act(db,'pet-a','choose-luna','select:owl',now),/другого действия/);
  const concurrent=await Promise.allSettled([act(db,'pet-a','choose-owl','select:owl',now+2000),act(db,'pet-a','play-with-friend','play',now+2000)]);
  assert.equal(concurrent[0].status,'rejected');assert.equal(concurrent[0].reason.code,'pet_already_selected');assert.equal(concurrent[1].status,'fulfilled');
  const saved=await getState(db,'pet-a',now+2000);
  assert.equal(saved.state.petId,'luna');assert.equal(saved.state.coins,53);assert.equal(saved.state.xp,25);assert.equal(saved.state.energy,55);
  const firstChoices=await Promise.allSettled([act(db,'pet-c','first-luna','select:luna',now),act(db,'pet-c','first-owl','select:owl',now)]);
  assert.equal(firstChoices.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(firstChoices.find(x=>x.status==='rejected').reason.code,'pet_already_selected');
  assert.equal((await getState(db,'pet-c',now)).revision,1);
  const oldRetry=await act(db,'pet-a','choose-luna','select:luna',now+2000);
  assert.equal(oldRetry.replayed,true);assert.equal(oldRetry.state.petId,'luna');assert.equal(oldRetry.revision,saved.revision);
 }finally{await mf.dispose()}
});

test('HTTP pet selection validates IDs, persists choice and keeps rewards shared',async()=>{
 const {Miniflare}=await import('miniflare');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB'],compatibilityDate:'2026-01-01'});
 try{
  const db=await mf.getD1Database('DB');
  for(const sql of readFileSync('drizzle/0000_lame_havok.sql','utf8').split('--> statement-breakpoint'))await db.prepare(sql.trim()).run();
  const env={DB:db,TELEGRAM_BOT_TOKEN:'test-token'};
  const call=(body,key='choose-operation-0001',user=12345,method='POST')=>handleGame(new Request('https://game.test/api/game',{method,headers:{'x-telegram-init-data':signed(Date.now(),{user:JSON.stringify({id:user})}),origin:'https://game.test','content-type':'application/json','idempotency-key':key},...(method==='POST'?{body:JSON.stringify(body)}:{})}),env,method==='POST');
  assert.equal((await (await call(null,undefined,12345,'GET')).json()).state.petId,null);
  for(const petId of [undefined,null,'unknown','../../secret',12,{}])assert.equal((await call({action:'select_pet',petId})).status,400);
  let response=await call({action:'select_pet',petId:'whale'});assert.equal(response.status,200);assert.equal((await response.json()).state.petId,'whale');
  response=await call({action:'select_pet',petId:'whale'});assert.equal((await response.json()).replayed,true);
  assert.equal((await call({action:'select_pet',petId:'lynx'})).status,409);
  assert.equal((await call({action:'daily'},'daily-operation-0001')).status,200);
  response=await call({action:'select_pet',petId:'lynx'},'choose-operation-0002');assert.equal(response.status,409);assert.equal((await response.json()).error,'pet_already_selected');
  assert.equal((await call({action:'select_pet',petId:'whale'},'choose-operation-0003')).status,409);
  assert.equal((await call({action:'daily'},'daily-operation-0002')).status,409);
  const unchanged=await (await call(null,undefined,12345,'GET')).json();assert.equal(unchanged.state.petId,'whale');assert.equal(unchanged.state.coins,70);
  assert.equal((await (await call(null,undefined,54321,'GET')).json()).state.petId,null);
 }finally{await mf.dispose()}
});
