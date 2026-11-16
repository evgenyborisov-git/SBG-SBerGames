import type {PetId} from './pets';
export const ROUND_MS=18000;
export const ROUND_TTL_MS=300000;
export const ROUND_TARGETS=12;
export type FireflyHit={target:number;at:number};
export type FireflyRound={id:string;seed:number;petId:PetId;guardian:boolean;startedAt:number;day:string;settled:boolean;score?:number;reward?:{xp:number;coins:number;crystals:number}};
export type FireflyProgress={day:string;attempts:number;best:number;round?:FireflyRound};
export function fireflyTarget(round:FireflyRound,index:number){
 // One cell per slot; no network request is needed for each tap.
 let value=round.seed>>>0;for(let i=0;i<=index;i++)value=(Math.imul(value,1664525)+1013904223)>>>0;
 const start=800+index*1400;
 return {index,cell:value%9,start,end:start+1100+(round.guardian&&round.petId==='chudik'?300:0)};
}
export function validateFireflyHits(round:FireflyRound,hits:FireflyHit[]){
 if(hits.length>ROUND_TARGETS)return false;
 const seen=new Set<number>();let previous=-1;
 for(const hit of hits){
  if(!Number.isSafeInteger(hit.target)||hit.target<0||hit.target>=ROUND_TARGETS||!Number.isSafeInteger(hit.at)||hit.at<previous||seen.has(hit.target))return false;
  const target=fireflyTarget(round,hit.target);if(hit.at<target.start||hit.at>target.end)return false;
  previous=hit.at;seen.add(hit.target);
 }
 return true;
}
export function fireflyRewards(round:FireflyRound,score:number){
 if(score===0)return {xp:0,coins:0,crystals:0,energyBack:0};
 return {xp:10+score*2+(round.guardian&&round.petId==='peach'?10:0),coins:Math.floor(score/3)+(round.guardian&&round.petId==='hedgehog'?5:0),crystals:score>=10?3:score>=6?2:1,energyBack:round.guardian&&round.petId==='otter'?5:0};
}
