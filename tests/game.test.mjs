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
  const {petId:ignored,journey:ignoredJourney,...progress}=selected;
  const {petId:old,journey:oldJourney,...expected}=restore(earned,selectionTime+8000);
  assert.deepEqual(progress,expected);
  assert.throws(()=>transition(selected,'daily',selectionTime+8000),/уже/);
  assert.throws(()=>transition(selected,'offer',selectionTime+8000),/уже/);
 }
 const legacy={...earned};delete legacy.petId;delete legacy.journey;
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

function matureChapter(pet='chudik'){
 let s=transition(initial(now),'select:'+pet,now);s.level=2;s.xp=35;s.collection.push('🌱 Первый росток');s=restore(s,now);s.journey.owned[pet]={level:s.level,xp:s.xp,collection:[...s.collection]};s.journey.crystals=100;return s;
}
test('chapter migration is additive and repeatable for every starter; forms are not species',()=>{
 for(const pet of require('../.sites-runtime/test-build/pets.js').petIds){
  const old={...initial(now),petId:pet,level:8,xp:45,coins:123,lastDaily:day(now),offerDone:true,collection:['egg','grown','guardian']};
  const s=restore(old,now);assert.equal(Object.keys(s.journey.owned).length,1);assert.equal(s.journey.owned[pet].level,8);assert.equal(s.journey.firstPetId,pet);assert.equal(s.coins,123);assert.equal(s.journey.crystals,0);assert.deepEqual(restore(s,now),s);assert.deepEqual(old.collection,['egg','grown','guardian']);
 }
});
test('unlock prices, prerequisites, separate progress, shared resources and chapter cap',()=>{
 let s=matureChapter();const resources={coins:s.coins,energy:s.energy,lastDaily:s.lastDaily};
 assert.throws(()=>transition({...s,journey:{...s.journey,crystals:29}},'unlock:luna',now),e=>e.code==='unlock_locked');
 s=transition(s,'unlock:luna',now);assert.equal(s.journey.crystals,70);assert.equal(s.petId,'chudik');assert.equal(s.journey.owned.luna.level,1);
 assert.throws(()=>transition(s,'unlock:owl',now),e=>e.code==='unlock_locked');assert.throws(()=>transition(s,'unlock:luna',now),e=>e.code==='already_owned');
 s=transition(s,'visit:luna',now);assert.equal(s.level,1);assert.equal(s.xp,0);assert.equal(s.energy,resources.energy);assert.equal(s.coins,resources.coins);assert.equal(s.journey.firstPetId,'chudik');
 assert.throws(()=>transition(s,'play:chudik',now),e=>e.code==='pet_changed');
 for(let i=0;i<4;i++)s=transition(s,'play:luna',now+i*2000);
 assert.equal(s.level,2);s=transition(s,'visit:chudik',now+8000);assert.equal(s.xp,35);assert.equal(s.level,2);assert.equal(s.journey.owned.luna.xp,0);
 s=transition(s,'unlock:owl',now+8000);assert.equal(Object.keys(s.journey.owned).length,3);assert.equal(s.journey.crystals,14);
 s.journey.crystals=1000;assert.throws(()=>transition(s,'unlock:deer',now+8000),e=>e.code==='unlock_locked'); // Needs a guardian in chapter two.
});
test('quest rewards, cap and Moscow midnight cannot be claimed twice or for a stale day',()=>{
 const t=now-60000;let s=transition(initial(t),'select:owl',t);
 assert.throws(()=>transition(s,`quest:${day(t)}:play`,t),e=>e.code==='quest_incomplete');
 for(let i=0;i<10;i++){s.energy=100;s=transition(s,'play:owl',t+i*2000);}
 assert.equal(s.journey.crystals,10);
 for(const q of ['play','care','xp'])s=transition(s,`quest:${day(t)}:${q}`,t+20000);
 assert.equal(s.journey.crystals,50);assert.throws(()=>transition(s,`quest:${day(t)}:play`,t+20000),e=>e.code==='already_claimed');
 s=transition(s,'daily',t+20000);assert.equal(s.journey.crystals,55);
 s=restore(s,now+1000);assert.equal(s.journey.tasks.play,0);assert.deepEqual(s.journey.tasks.claimed,[]);assert.equal(s.journey.crystals,55);
 assert.throws(()=>transition(s,`quest:${day(t)}:play`,now+1000),e=>e.code==='quest_expired');
});
test('all 12 starters reach 3/12 without offers in a deterministic two-day scenario',()=>{
 const ids=require('../.sites-runtime/test-build/pets.js').petIds;
 for(const starter of ids){
  let t=Date.UTC(2026,10,15,9),s=transition(initial(t),`select:${starter}`,t);const others=ids.filter(id=>id!==starter);let games=0;
  for(let d=0;d<2;d++){
   t=Date.UTC(2026,10,15+d,9);s=transition(s,'daily',t);
   for(let i=0;i<10;i++){
    t+=900000; // Return after 15 min: enough energy, no synthetic resources.
    s=transition(s,`play:${s.petId}`,t);games++;
    for(const q of ['play','care','xp']){try{s=transition(s,`quest:${day(t)}:${q}`,t);}catch(e){assert.ok(['quest_incomplete','already_claimed'].includes(e.code));}}
    if(Object.keys(s.journey.owned).length===1&&require('../.sites-runtime/test-build/rules.js').unlockStatus(s).available){s=transition(s,`unlock:${others[0]}`,t);s=transition(s,`visit:${others[0]}`,t);}
    if(Object.keys(s.journey.owned).length===2&&require('../.sites-runtime/test-build/rules.js').unlockStatus(s).available)s=transition(s,`unlock:${others[1]}`,t);
   }
  }
  assert.equal(Object.keys(s.journey.owned).length,3,starter);assert.ok(s.journey.crystals>=0);assert.equal(s.offerDone,false);assert.equal(s.journey.firstPetId,starter);
 }
});
test('D1 concurrent unlocks and claims charge once, preserve old receipts and keep profiles isolated',async()=>{
 const {Miniflare}=await import('miniflare');const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB'],compatibilityDate:'2026-01-01'});
 try{
  const db=await mf.getD1Database('DB');for(const sql of readFileSync('drizzle/0000_lame_havok.sql','utf8').split('--> statement-breakpoint'))await db.prepare(sql.trim()).run();
  const state=matureChapter();state.journey.tasks.play=3;
  await db.prepare('INSERT INTO players VALUES (?,?,0)').bind('alice',JSON.stringify(state)).run();
  const results=await Promise.allSettled(Array.from({length:10},(_,i)=>act(db,'alice','unlock-'+i,'unlock:luna',now)));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);let saved=(await getState(db,'alice',now)).state;assert.equal(saved.journey.crystals,70);assert.equal(Object.keys(saved.journey.owned).length,2);
  const winner=results.findIndex(r=>r.status==='fulfilled');assert.equal((await act(db,'alice','unlock-'+winner,'unlock:luna',now)).replayed,true);
  await assert.rejects(act(db,'alice','unlock-'+winner,'unlock:owl',now),e=>e.code==='key_conflict');
  const claims=await Promise.allSettled(Array.from({length:10},(_,i)=>act(db,'alice','quest-'+i,`quest:${day(now)}:play`,now)));
  assert.equal(claims.filter(r=>r.status==='fulfilled').length,1);saved=(await getState(db,'alice',now)).state;assert.equal(saved.journey.crystals,80);
  assert.equal(Object.keys((await getState(db,'bob',now)).state.journey.owned).length,0);
 }finally{await mf.dispose();}
});


test('HTTP collection operations validate input, reject unearned pets and replay confirmed spending',async()=>{
 const {Miniflare}=await import('miniflare');const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB'],compatibilityDate:'2026-01-01'});
 try{
  const db=await mf.getD1Database('DB');for(const sql of readFileSync('drizzle/0000_lame_havok.sql','utf8').split('--> statement-breakpoint'))await db.prepare(sql.trim()).run();
  const timestamp=Date.now(),s=matureChapter('whale');s.journey.tasks={day:day(timestamp),play:3,care:3,xp:75,claimed:[]};s.energyAt=timestamp;
  await db.prepare('INSERT INTO players VALUES (?,?,0)').bind('tg:12345',JSON.stringify(s)).run();
  const call=(body,key)=>handleGame(new Request('https://game.test/api/game',{method:'POST',headers:{'x-telegram-init-data':signed(timestamp),origin:'https://game.test','content-type':'application/json','idempotency-key':key},body:JSON.stringify(body)}),{DB:db,TELEGRAM_BOT_TOKEN:'test-token'},true);
  for(const body of [{action:'unlock_pet',petId:'fake'},{action:'visit_pet',petId:{}},{action:'claim_quest',questId:'play'},{action:'claim_quest',questId:'fake',questDay:day(timestamp)},{action:'feed',petId:12}])assert.equal((await call(body,'invalid-request-0001')).status,400);
  assert.equal((await call({action:'visit_pet',petId:'luna'},'not-owned-request-001')).status,409);
  let response=await call({action:'unlock_pet',petId:'luna'},'unlock-request-00001');assert.equal(response.status,200);assert.equal((await response.json()).state.journey.crystals,70);
  response=await call({action:'unlock_pet',petId:'luna'},'unlock-request-00001');assert.equal((await response.json()).replayed,true);
  response=await call({action:'claim_quest',questId:'play',questDay:day(timestamp)},'claim-request-000001');assert.equal(response.status,200);assert.equal((await response.json()).state.journey.crystals,80);
  response=await call({action:'visit_pet',petId:'luna'},'visit-request-000001');assert.equal(response.status,200);assert.equal((await response.json()).state.level,1);
  response=await call({action:'play',petId:'whale'},'stale-pet-request-001');assert.equal(response.status,409);assert.equal((await response.json()).error,'pet_changed');
 }finally{await mf.dispose();}
});

const stageOf=s=>require('../.sites-runtime/test-build/rules.js').petStage(s);
function readyEvolution(){let s=matureChapter();s.level=3;s.xp=0;s.journey.owned.chudik={level:3,xp:0,collection:[...s.collection],stage:1};return s;}
test('guardian evolution charges once, preserves level and grants real XP ability without multiplying daily crystals',()=>{
 let s=readyEvolution();assert.equal(stageOf(s),1);
 assert.throws(()=>transition(s,'evolve:chudik:0:30',now),e=>e.code==='quote_changed');
 assert.throws(()=>transition({...s,journey:{...s.journey,crystals:29}},'evolve:chudik:1:30',now),e=>e.code==='evolution_locked');
 const old=structuredClone(s);s=transition(s,'evolve:chudik:1:30',now);assert.equal(s.journey.crystals,70);assert.equal(stageOf(s),2);assert.equal(s.level,3);assert.equal(s.collection.filter(x=>x==='🦋 Крылья чудес').length,1);assert.equal(Object.keys(s.journey.owned).length,1);
 assert.equal(old.journey.crystals,100);assert.throws(()=>transition(s,'evolve:chudik:1:30',now),e=>e.code==='quote_changed');
 s=transition(s,'play:chudik',now);assert.equal(s.xp,30);assert.equal(s.journey.tasks.xp,30);assert.equal(s.journey.crystals,71);assert.equal(s.energy,55);
});
test('level three alone does not unlock a new guardian; old level-three forms survive migration free',()=>{
 let s=transition(initial(now),'select:luna',now);
 for(let i=0;i<8;i++){s.energy=100;s=transition(s,'play:luna',now+i*2000);}
 assert.equal(s.level,3);assert.equal(stageOf(s),1);assert.ok(!s.collection.includes('🦋 Крылья чудес'));
 const legacy={...s,journey:{...s.journey,version:1,crystals:17,owned:{luna:{level:4,xp:23,collection:['egg','grown','guardian']}}}};legacy.level=4;legacy.xp=23;legacy.collection=['egg','grown','guardian'];
 const restored=restore(legacy,now+14000);assert.equal(stageOf(restored),2);assert.equal(restored.journey.version,2);assert.equal(restored.journey.crystals,17);assert.deepEqual(restore(restored,now+14000),restored);assert.deepEqual(restored.collection,legacy.collection);
});
test('quoted unlock cost cannot change silently, and second chapter stops at six unique pets',()=>{
 let s=matureChapter();s.journey.crystals=1000;
 assert.throws(()=>transition(s,'unlock:luna:60',now),e=>e.code==='quote_changed');assert.equal(s.journey.crystals,1000);
 s=transition(s,'unlock:luna:30',now);s.journey.owned.luna.level=2;s=transition(s,'unlock:owl:60',now);s.journey.owned.owl.level=2;
 assert.throws(()=>transition(s,'unlock:deer:90',now),e=>e.code==='unlock_locked');s.journey.owned.chudik.stage=2;
 s=transition(s,'unlock:deer:90',now);s.journey.owned.deer.level=2;s.journey.owned.luna.stage=2;
 s=transition(s,'unlock:otter:120',now);s.journey.owned.otter.level=2;s.journey.owned.owl.stage=2;
 s=transition(s,'unlock:lynx:150',now);assert.equal(Object.keys(s.journey.owned).length,6);assert.equal(s.journey.crystals,550);
 assert.throws(()=>transition(s,'unlock:griffin:0',now),e=>e.code==='unlock_locked');
});
test('all starter choices reach 6/12 with three paid evolutions using only earned daily resources',()=>{
 const ids=require('../.sites-runtime/test-build/pets.js').petIds,rules=require('../.sites-runtime/test-build/rules.js');
 for(const starter of ids){
  let t=Date.UTC(2026,10,16,9),s=transition(initial(t),`select:${starter}`,t),finishedDay=0;
  for(let d=0;d<12&&Object.keys(s.journey.owned).length<6;d++){
   t=Date.UTC(2026,10,16+d,9);s=transition(s,'daily',t);
   for(let i=0;i<10;i++){
    const entries=Object.entries(s.journey.owned);const next=entries.find(([,p])=>p.level<2)??entries.find(([id,p])=>p.level<3&&rules.petStage(s,id)<2)??entries[0];
    s=transition(s,`visit:${next[0]}`,t);t+=900000;s=transition(s,`play:${s.petId}`,t);
    for(const q of ['play','care','xp']){try{s=transition(s,`quest:${day(t)}:${q}`,t);}catch(e){assert.ok(['already_claimed','quest_incomplete'].includes(e.code));}}
    let count=Object.keys(s.journey.owned).length;const guardians=Object.keys(s.journey.owned).filter(id=>rules.petStage(s,id)>=2).length;
    if(count>=3&&count<6&&guardians<count-2){const ready=Object.keys(s.journey.owned).find(id=>rules.evolutionStatus(s,id).available);if(ready)s=transition(s,`evolve:${ready}:1:30`,t);}
    const status=rules.unlockStatus(s);if(status.available){const target=ids.find(id=>!s.journey.owned[id]);s=transition(s,`unlock:${target}:${status.cost}`,t);}
    assert.ok(s.journey.crystals>=0);assert.equal(s.offerDone,false);
   }
   finishedDay=d+1;
  }
  assert.equal(Object.keys(s.journey.owned).length,6,starter);assert.ok(finishedDay<=12);assert.equal(s.journey.firstPetId,starter);assert.equal(Object.keys(s.journey.owned).filter(id=>rules.petStage(s,id)>=2).length,3);
 }
});
test('concurrent evolution requests preserve spending and ability; old receipt cannot evolve a later form',async()=>{
 const {Miniflare}=await import('miniflare');const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB'],compatibilityDate:'2026-01-01'});
 try{
  const db=await mf.getD1Database('DB');for(const sql of readFileSync('drizzle/0000_lame_havok.sql','utf8').split('--> statement-breakpoint'))await db.prepare(sql.trim()).run();
  await db.prepare('INSERT INTO players VALUES (?,?,0)').bind('evolver',JSON.stringify(readyEvolution())).run();
  const results=await Promise.allSettled(Array.from({length:10},(_,i)=>act(db,'evolver','evolve-'+i,'evolve:chudik:1:30',now)));
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);const winner=results.findIndex(x=>x.status==='fulfilled');const saved=await getState(db,'evolver',now);assert.equal(saved.state.journey.crystals,70);assert.equal(stageOf(saved.state),2);
  assert.equal((await act(db,'evolver','evolve-'+winner,'evolve:chudik:1:30',now)).replayed,true);
  await assert.rejects(act(db,'evolver','evolve-'+winner,'evolve:chudik:2:30',now),e=>e.code==='key_conflict');
  await act(db,'evolver','next-game','play:chudik',now+2000);const retry=await act(db,'evolver','evolve-'+winner,'evolve:chudik:1:30',now+2000);assert.equal(retry.state.xp,30);assert.equal(retry.state.journey.crystals,71);
 }finally{await mf.dispose();}
});
test('HTTP evolve validates exact quote, commits form, and returns a human message',async()=>{
 const {Miniflare}=await import('miniflare');const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB'],compatibilityDate:'2026-01-01'});
 try{
  const db=await mf.getD1Database('DB');for(const sql of readFileSync('drizzle/0000_lame_havok.sql','utf8').split('--> statement-breakpoint'))await db.prepare(sql.trim()).run();const timestamp=Date.now();await db.prepare('INSERT INTO players VALUES (?,?,0)').bind('tg:12345',JSON.stringify(readyEvolution())).run();
  const call=(body,key='evolution-http-00001')=>handleGame(new Request('https://game.test/api/game',{method:'POST',headers:{'x-telegram-init-data':signed(timestamp),origin:'https://game.test','content-type':'application/json','idempotency-key':key},body:JSON.stringify(body)}),{DB:db,TELEGRAM_BOT_TOKEN:'test-token'},true);
  for(const body of [{action:'evolve_pet',petId:'chudik'},{action:'evolve_pet',petId:'unknown',expectedStage:1,expectedCost:30},{action:'evolve_pet',petId:'chudik',expectedStage:1,expectedCost:0}])assert.equal((await call(body)).status,400);
  let response=await call({action:'evolve_pet',petId:'chudik',expectedStage:0,expectedCost:30});assert.equal(response.status,409);
  response=await call({action:'evolve_pet',petId:'chudik',expectedStage:1,expectedCost:30});assert.equal(response.status,200);const result=await response.json();assert.match(result.message,/хранителем/);assert.equal(result.state.journey.crystals,70);assert.equal(stageOf(result.state),2);
  response=await call({action:'evolve_pet',petId:'chudik',expectedStage:1,expectedCost:30});assert.equal((await response.json()).replayed,true);
 }finally{await mf.dispose();}
});
