import {careStats} from './abilities';
import {ROUND_MS,ROUND_TTL_MS,validateFireflyHits,fireflyRewards,type FireflyProgress,type FireflyHit} from './fireflies';
import {isPetId, type PetId} from './pets';
export type EconomyAction = 'feed' | 'play' | 'daily' | 'offer';
export type QuestId = 'play' | 'care' | 'xp';
export type Action = EconomyAction | 'firefly_start' | `firefly_finish:${string}:${string}` | `select:${PetId}` | `unlock:${PetId}` | `unlock:${PetId}:${number}` | `evolve:${PetId}:${number}:30` | `visit:${PetId}` | `feed:${PetId}` | `play:${PetId}` | `quest:${string}:${QuestId}`;
export type PetProgress={level:number;xp:number;collection:string[];stage?:number};
export type Journey={version:1|2;firstPetId:PetId|null;crystals:number;owned:Partial<Record<PetId,PetProgress>>;tasks:{day:string;play:number;care:number;xp:number;claimed:QuestId[]}};
export const quests = [{id:'play',title:'Солнечные игры',description:'Поиграй 3 раза',target:3,reward:10},{id:'care',title:'День заботы',description:'Покорми или поиграй 5 раз',target:5,reward:15},{id:'xp',title:'Растём вместе',description:'Заработай 100 опыта',target:100,reward:15}] as const;
export type State = { petId:PetId|null; coins:number; energy:number; xp:number; level:number; lastDaily:string; offerDone:boolean; collection:string[]; energyAt:number; actionAt:number; journey?:Journey;fireflies?:FireflyProgress };
export class GameError extends Error { constructor(public code:string, message:string, public status=409){super(message)} }
export const day = (now:number) => new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export const initial = (now:number):State => ({petId:null,coins:50,energy:70,xp:0,level:1,lastDaily:'',offerDone:false,collection:['🥚 Первое яйцо'],energyAt:now,actionAt:0});
export function restore(state:State, now:number):State & {journey:Journey} {
 const s=structuredClone(state), ticks=Math.max(0,Math.floor((now-s.energyAt)/60000));
 // Profiles created before pet selection keep Chudik and every earned resource.
 if(s.petId===undefined)s.petId='chudik';
 // Additive, deterministic migration: earned forms/resources stay with the current pet.
 if(!s.journey)s.journey={version:1,firstPetId:s.petId,crystals:0,owned:s.petId?{[s.petId]:{level:s.level,xp:s.xp,collection:[...s.collection]}}:{},tasks:{day:day(now),play:0,care:0,xp:0,claimed:[]}};
 for(const pet of Object.values(s.journey.owned))if(pet.stage===undefined)pet.stage=Math.min(2,Math.max(0,pet.level-1));
 s.journey.version=2;
 if(s.journey.tasks.day!==day(now))s.journey.tasks={day:day(now),play:0,care:0,xp:0,claimed:[]};
 if(!s.fireflies)s.fireflies={day:day(now),attempts:0,best:0};
 if(s.fireflies.day!==day(now)){s.fireflies.day=day(now);s.fireflies.attempts=0;}
 if(s.energy>=100){s.energyAt=now;}else if(ticks){s.energy=Math.min(100,s.energy+ticks);s.energyAt=s.energy===100?now:s.energyAt+ticks*60000;}
 return s as State & {journey:Journey};
}
/** Stages are earned separately from levels; legacy forms are grandfathered. */
export function petStage(state:State,petId=state.petId){
 const pet=petId?state.journey?.owned[petId]:undefined;
 return pet?.stage??Math.min(2,Math.max(0,(pet?.level??state.level)-1));
}
export function evolutionStatus(state:State,petId=state.petId){
 const pet=petId?state.journey?.owned[petId]:undefined,stage=petId?petStage(state,petId):0;
 const reasons:string[]=[];
 if(!pet)reasons.push('Сначала пригласи друга');
 if(stage>=2)reasons.push('Форма хранителя уже открыта');
 if(pet&&pet.level<3)reasons.push('Нужен уровень 3');
 if((state.journey?.crystals??0)<30)reasons.push(`Не хватает ${30-(state.journey?.crystals??0)} кристаллов`);
 return {stage,cost:30,reasons,available:reasons.length===0};
}
export function unlockStatus(state:State){
 const j=state.journey,owned=Object.values(j?.owned??{}),count=owned.length;
 const cost=count>0&&count<12?count*30:0;
 const reasons:string[]=[];
 if(count===0)reasons.push('Сначала выбери первого друга');
 if(count>=12)reasons.push('Все 12 хранителей уже в коллекции');
 if(count>0&&count<12&&owned.filter(p=>p.level>=2).length<count)reasons.push(`Развей всех полученных друзей до уровня 2 (${owned.filter(p=>p.level>=2).length}/${count})`);
 const guardians=Object.entries(j?.owned??{}).filter(([id])=>petStage(state,id as PetId)>=2).length;
 const needed=Math.max(0,count-2);
 if(count>=3&&count<12&&guardians<needed)reasons.push(`Открой форму хранителя у ${needed} друзей (${guardians}/${needed})`);
 if(count>0&&count<12&&(j?.crystals??0)<cost)reasons.push(`Не хватает ${cost-(j?.crystals??0)} кристаллов`);
 return {count,cost,reasons,available:reasons.length===0};
}
export function collectionMilestones(state:State){
 const count=Object.keys(state.journey?.owned??{}).length;
 const target=count<3?3:count<6?6:12;
 return {count,target,complete:count===12,steps:[3,6,12].map(value=>({value,reached:count>=value}))};
}
function awardExperience(s:State & {journey:Journey},petId:PetId,amount:number){
 const p=s.journey.owned[petId]!;p.xp+=amount;
 while(p.xp>=100){p.xp-=100;p.level++;s.coins+=25;if(p.level===2)p.collection.push('🌱 Первый росток');}
 if(p.level>=2)p.stage=Math.max(p.stage??0,1);
 if(s.petId===petId){s.level=p.level;s.xp=p.xp;s.collection=[...p.collection];}
}
export function transition(state:State, action:Action, now:number){
 const s=restore(state,now);
 const j=s.journey;
 if(action==='firefly_start'){
  if(!s.petId)throw new GameError('choose_first','Сначала выбери первого друга');
  const existing=s.fireflies!.round;
  if(existing&&!existing.settled&&now-existing.startedAt<=ROUND_TTL_MS)throw new GameError('round_active','Раунд уже начат. Продолжи его или забери результат');
  if(s.fireflies!.attempts>=3)throw new GameError('round_limit','Три наградные попытки на сегодня использованы');
  const guardian=petStage(s)>=2,cost=guardian&&s.petId==='luna'?7:10;
  if(s.energy<cost)throw new GameError('not_enough_energy',`Нужно ${cost} энергии`);
  s.energy-=cost;s.fireflies!.attempts++;
  s.fireflies!.round={id:crypto.randomUUID(),seed:crypto.getRandomValues(new Uint32Array(1))[0],petId:s.petId,guardian,startedAt:now,day:day(now),settled:false};
  return s;
 }
 if(action.startsWith('firefly_finish:')){
  const [,id,encoded]=action.split(':');const round=s.fireflies!.round;
  if(!round||round.id!==id)throw new GameError('round_changed','Этот раунд больше не доступен');
  if(round.settled)throw new GameError('already_claimed','Результат этого раунда уже сохранён');
  if(now-round.startedAt<ROUND_MS)throw new GameError('round_early','Дождись окончания раунда');
  if(now-round.startedAt>ROUND_TTL_MS)throw new GameError('round_expired','Время сохранения раунда истекло. Начни новую попытку');
  const hits:FireflyHit[]=encoded?encoded.split(',').map(value=>{const [target,at]=value.split('@');return {target:Number(target),at:Number(at)};}):[];
  if(!validateFireflyHits(round,hits))throw new GameError('invalid_hits','Не удалось проверить попадания',400);
  const reward=fireflyRewards(round,hits.length);let crystal=reward.crystals;
  // A successful mini-game is one play/care action. Midnight uses settlement day for tasks.
  if(hits.length){if(j.tasks.play<10)crystal++;j.tasks.play++;j.tasks.care++;j.tasks.xp+=reward.xp;}
  s.coins+=reward.coins;j.crystals+=crystal;s.energy=Math.min(100,s.energy+reward.energyBack);if(s.energy===100)s.energyAt=now;
  awardExperience(s,round.petId,reward.xp);
  round.settled=true;round.score=hits.length;round.reward={xp:reward.xp,coins:reward.coins,crystals:crystal};s.fireflies!.best=Math.max(s.fireflies!.best,hits.length);
  return s;
 }
 const stats=careStats(s.petId,petStage(s)>=2);
 if(action.startsWith('select:')){
  const petId=action.slice(7);
  if(!isPetId(petId))throw new GameError('invalid_pet','Такого питомца нет в атласе',400);
  if(s.petId!==null)throw new GameError('pet_already_selected','Первый друг уже выбран. Остальных чудозверей можно пригласить в альбоме');
  s.petId=petId;j.firstPetId=petId;j.owned[petId]={level:s.level,xp:s.xp,collection:[...s.collection],stage:Math.min(2,Math.max(0,s.level-1))};
  return s;
 }
 const [kind,target,quotedStageOrPrice,quotedPrice]=action.split(':');
 if(kind==='evolve'){
  if(!isPetId(target))throw new GameError('invalid_pet','Неизвестный питомец',400);
  const status=evolutionStatus(s,target);
  if(Number(quotedStageOrPrice)!==status.stage||Number(quotedPrice)!==status.cost)throw new GameError('quote_changed','Условия эволюции изменились. Подтверди их заново');
  if(!status.available)throw new GameError('evolution_locked',status.reasons.join('. '));
  const progress=j.owned[target]!;j.crystals-=status.cost;progress.stage=2;
  if(!progress.collection.includes('🦋 Крылья чудес'))progress.collection.push('🦋 Крылья чудес');
  if(s.petId===target)s.collection=[...progress.collection];
  return s;
 }
 if(kind==='unlock'||kind==='visit'){
  if(!isPetId(target))throw new GameError('invalid_pet','Неизвестный питомец',400);
  if(kind==='unlock'){
   if(j.owned[target])throw new GameError('already_owned','Этот друг уже на острове');
   const status=unlockStatus(s);if(!status.available)throw new GameError('unlock_locked',status.reasons.join('. '));
   if(quotedStageOrPrice!==undefined&&Number(quotedStageOrPrice)!==status.cost)throw new GameError('quote_changed','Стоимость приглашения изменилась. Подтверди её заново');
   j.crystals-=status.cost;j.owned[target]={level:1,xp:0,collection:['🥚 Первое яйцо'],stage:0};
  }else{
   const progress=j.owned[target];if(!progress)throw new GameError('not_owned','Сначала пригласи этого друга');
   s.petId=target;s.level=progress.level;s.xp=progress.xp;s.collection=[...progress.collection];
  }
  return s;
 }
 if(kind==='quest'){
  if(target!==day(now))throw new GameError('quest_expired','Начался новый день. Обнови задания');
  const quest=quests.find(q=>q.id===action.split(':')[2]);if(!quest)throw new GameError('invalid_quest','Неизвестное задание',400);
  if(!s.petId)throw new GameError('choose_first','Сначала выбери первого друга');
  if(j.tasks.claimed.includes(quest.id))throw new GameError('already_claimed','Награда задания уже получена');
  if(j.tasks[quest.id]<quest.target)throw new GameError('quest_incomplete','Сначала выполни задание');
  j.tasks.claimed.push(quest.id);j.crystals+=quest.reward;return s;
 }
 if(target){
  if((kind!=='feed'&&kind!=='play')||!isPetId(target))throw new GameError('invalid_action','Неизвестное действие',400);
  if(target!==s.petId)throw new GameError('pet_changed','Друг на острове изменился. Обнови страницу');
  action=kind;
 }
 if(action==='daily'){
  if(s.lastDaily===day(now))throw new GameError('already_claimed','Сегодня подарок уже получен');
  s.lastDaily=day(now);s.coins+=20;if(s.petId)j.crystals+=5;
 }else if(action==='offer'){
  if(s.offerDone)throw new GameError('already_claimed','Тестовое задание уже выполнено');
  s.offerDone=true;s.coins+=15;
 }else{
  if(now-s.actionAt<1500)throw new GameError('cooldown','Питомец отдыхает — попробуй через пару секунд',429);
  if(action==='feed'){
   if(s.coins<stats.feedCost)throw new GameError('not_enough_coins',`Нужно ${stats.feedCost} монет`);
 if(s.energy>=100)throw new GameError('energy_full','Питомец уже сыт');
   s.coins-=stats.feedCost;s.energy=Math.min(100,s.energy+stats.feedEnergy);s.xp+=stats.feedXP;
  }else if(action==='play'){
   if(s.energy<stats.playEnergy)throw new GameError('not_enough_energy',`Нужно ${stats.playEnergy} энергии`);
   s.energy-=stats.playEnergy;s.coins+=stats.playCoins;s.xp+=stats.playXP;
  }else throw new GameError('invalid_action','Неизвестное действие',400);
  if(s.petId){j.tasks.care++;if(action==='play'){if(j.tasks.play<10)j.crystals++;j.tasks.play++;}j.tasks.xp+=action==='play'?stats.playXP:stats.feedXP;}
  if(s.energy===100)s.energyAt=now;
  s.actionAt=now;
  while(s.xp>=100){s.xp-=100;s.level++;s.coins+=25;
   if(s.level===2)s.collection.push('🌱 Первый росток');
   // Guardian form is now a confirmed purchase; existing forms stay unlocked.
  }
 }
 if(s.petId)j.owned[s.petId]={level:s.level,xp:s.xp,collection:[...s.collection],stage:Math.max(j.owned[s.petId]?.stage??0,s.level>=2?1:0)};
 return s;
}
export const messages:Record<EconomyAction,string>={feed:'Вкусно! +20 энергии (до 100), +10 опыта 🥕',play:'Отличная игра! +25 опыта и +3 монеты 🎾',daily:'Подарок получен! +20 монет 🎁',offer:'Тестовое задание выполнено! +15 монет ✨'};
