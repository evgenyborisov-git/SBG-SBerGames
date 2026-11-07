import { initial, restore, transition, GameError, type Action, type State } from './rules';
type Row={state:string;revision:number};
export async function getState(db:D1Database,id:string,now=Date.now()){
 await db.prepare('INSERT OR IGNORE INTO players (id,state,revision) VALUES (?,?,0)').bind(id,JSON.stringify(initial(now))).run();
 const row=await db.prepare('SELECT state,revision FROM players WHERE id=?').bind(id).first<Row>();
 if(!row)throw new Error('player_missing');
 return {state:restore(JSON.parse(row.state),now),revision:row.revision};
}
export async function act(db:D1Database,id:string,key:string,action:Action,now=Date.now()){
 for(let attempt=0;attempt<8;attempt++){
  // Read the snapshot before the receipt: a concurrent commit must not make a
  // retry fail validation against state that already includes that same action.
  const {state,revision}=await getState(db,id,now);
  const replay=await db.prepare('SELECT action FROM operations WHERE player_id=? AND key=?').bind(id,key).first<{action:string}>();
  if(replay){
   if(replay.action!==action)throw new GameError('key_conflict','Этот запрос уже использован для другого действия');
   return {...await getState(db,id,now),replayed:true};
  }
  const next=transition(state,action,now);
  try{
   // D1 batch is one transaction. Only the revision winner inserts a receipt.
   const result=await db.batch([
    db.prepare('INSERT INTO operations (player_id,key,action,created_at) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM players WHERE id=? AND revision=?)').bind(id,key,action,now,id,revision),
    db.prepare('UPDATE players SET state=?,revision=revision+1 WHERE id=? AND revision=? AND EXISTS (SELECT 1 FROM operations WHERE player_id=? AND key=?)').bind(JSON.stringify(next),id,revision,id,key)
   ]);
   if(result[0].meta.changes===1&&result[1].meta.changes===1)return {state:next,revision:revision+1,replayed:false};
  }catch(error){
   if(!String(error).includes('UNIQUE constraint'))throw error;
  }
 }
 throw new GameError('busy','Много одновременных действий. Попробуй ещё раз',503);
}
