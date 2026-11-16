import {Home,PawPrint,Gift,Sparkles} from 'lucide-react';
export const gameSections=[{id:'pet',label:'Остров',icon:Home},{id:'games',label:'Игры',icon:Sparkles},{id:'collection',label:'Питомцы',icon:PawPrint},{id:'today',label:'Сегодня',icon:Gift}] as const;
export function GameNavigation({active,readyRewards,onNavigate}:{active:string;readyRewards:number;onNavigate:(id:string)=>void}){
 return <nav className="bottom-nav" aria-label="Разделы игры">{gameSections.map(({id,label,icon:Icon})=><button key={id} aria-current={active===id?'page':undefined} onClick={()=>onNavigate(id)} aria-label={id==='today'&&readyRewards?`${label}, доступно наград: ${readyRewards}`:label}><Icon size={23}/><span>{label}</span>{id==='today'&&readyRewards>0?<b className="nav-badge">{readyRewards}</b>:active===id&&<i/>}</button>)}</nav>;
}
