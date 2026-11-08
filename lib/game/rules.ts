import {isPetId, type PetId} from './pets';
export type EconomyAction = 'feed' | 'play' | 'daily' | 'offer';
export type Action = EconomyAction | `select:${PetId}`;
export type State = { petId:PetId|null; coins:number; energy:number; xp:number; level:number; lastDaily:string; offerDone:boolean; collection:string[]; energyAt:number; actionAt:number };
export class GameError extends Error { constructor(public code:string, message:string, public status=409){super(message)} }
export const day = (now:number) => new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export const initial = (now:number):State => ({petId:null,coins:50,energy:70,xp:0,level:1,lastDaily:'',offerDone:false,collection:['🥚 Первое яйцо'],energyAt:now,actionAt:0});
export function restore(state:State, now:number):State {
 const s=structuredClone(state), ticks=Math.max(0,Math.floor((now-s.energyAt)/60000));
 // Profiles created before pet selection keep Chudik and every earned resource.
 if(s.petId===undefined)s.petId='chudik';
 if(s.energy>=100){s.energyAt=now;}else if(ticks){s.energy=Math.min(100,s.energy+ticks);s.energyAt=s.energy===100?now:s.energyAt+ticks*60000;}
 return s;
}
export function transition(state:State, action:Action, now:number){
 const s=restore(state,now);
 if(action.startsWith('select:')){
  const petId=action.slice(7);
  if(!isPetId(petId))throw new GameError('invalid_pet','Такого питомца нет в атласе',400);
  s.petId=petId;
  return s;
 }
 if(action==='daily'){
  if(s.lastDaily===day(now))throw new GameError('already_claimed','Сегодня подарок уже получен');
  s.lastDaily=day(now);s.coins+=20;
 }else if(action==='offer'){
  if(s.offerDone)throw new GameError('already_claimed','Тестовое задание уже выполнено');
  s.offerDone=true;s.coins+=15;
 }else{
  if(now-s.actionAt<1500)throw new GameError('cooldown','Питомец отдыхает — попробуй через пару секунд',429);
  if(action==='feed'){
   if(s.coins<5)throw new GameError('not_enough_coins','Нужно 5 монет');
   if(s.energy>=100)throw new GameError('energy_full','Питомец уже сыт');
   s.coins-=5;s.energy=Math.min(100,s.energy+20);s.xp+=10;
  }else if(action==='play'){
   if(s.energy<15)throw new GameError('not_enough_energy','Нужно 15 энергии');
   s.energy-=15;s.coins+=3;s.xp+=25;
  }else throw new GameError('invalid_action','Неизвестное действие',400);
  if(s.energy===100)s.energyAt=now;
  s.actionAt=now;
  while(s.xp>=100){s.xp-=100;s.level++;s.coins+=25;
   if(s.level===2)s.collection.push('🌱 Первый росток');
   if(s.level===3)s.collection.push('🦋 Крылья чудес');
  }
 }
 return s;
}
export const messages:Record<EconomyAction,string>={feed:'Вкусно! +20 энергии (до 100), +10 опыта 🥕',play:'Отличная игра! +25 опыта и +3 монеты 🎾',daily:'Подарок получен! +20 монет 🎁',offer:'Тестовое задание выполнено! +15 монет ✨'};
