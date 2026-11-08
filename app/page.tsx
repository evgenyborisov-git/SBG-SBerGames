'use client';
import {useEffect,useRef,useState} from 'react';
import {artBackground} from '../lib/art-resolution';
import {PetGallery} from '../components/pet-gallery';
import {PetVisual,usePetReaction,type Reaction} from '../components/pet-reactions';
import {Sparkles,Leaf,Home as HomeIcon,PawPrint,Gift,BookOpen,Heart,Carrot,Volleyball,Zap,Star,Coins,ChevronRight,Check,Lock,Moon} from 'lucide-react';
type Snapshot={state:{coins:number;energy:number;xp:number;level:number;lastDaily:string;offerDone:boolean;collection:string[]};revision:number;mode:string;serverTime:number;message?:string};
declare global {interface Window{Telegram?:{WebApp:{initData:string;ready:()=>void;expand:()=>void;HapticFeedback?:{notificationOccurred:(type:string)=>void}}}}}
export default function Home(){
 const [data,setData]=useState<Snapshot|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('Подключаемся к лаборатории…'),[error,setError]=useState(false),[tab,setTab]=useState('pet');
 const stage=Math.min(2,Math.max(0,(data?.state.level??1)-1));
 const emotion=usePetReaction('chudik',stage);
 const reaction=emotion.reaction;
 const [petLine,setPetLine]=useState('Как хорошо, что ты здесь!');
 function react(index:Reaction,line:string,nextStage=stage){emotion.trigger(index,nextStage);setPetLine(line);}
 useEffect(()=>{if(reaction===0)setPetLine('Как хорошо, что ты здесь!');},[reaction]);
 const [sdkError,setSdkError]=useState(false);
 const pending=useRef<{action:string;key:string}|null>(null),lock=useRef(false),initData=useRef('');
 async function request(action?:string){
  if(lock.current)return;lock.current=true;setBusy(true);setError(false);
  const headers:Record<string,string>={};if(initData.current)headers['x-telegram-init-data']=initData.current;
  if(action){pending.current??={action,key:crypto.randomUUID()};headers['Content-Type']='application/json';headers['Idempotency-Key']=pending.current.key;}
  try{
   const response=await fetch('/api/game',{method:action?'POST':'GET',headers,body:action?JSON.stringify({action:pending.current!.action}):undefined,signal:AbortSignal.timeout(15000)});
   const result=await response.json().catch(()=>{throw new Error('Сервер не ответил. Проверь соединение и повтори запрос');}) as Snapshot & {message?:string};
   if(!response.ok){if(response.status<500)pending.current=null;if(response.status===401)setData(null);throw new Error(result.message||'Не удалось связаться с сервером');}
   if(action)pending.current=null;setData(result);setMessage(result.message||'Прогресс сохранён на сервере');
   if(action)react(action==='feed'?1:action==='play'?2:5,action==='feed'?'Хрум-хрум… моя любимая морковка!':action==='play'?'Ещё раз! Лови солнечный мячик!':'Ура! Сегодня случилось маленькое чудо!',Math.min(2,Math.max(0,result.state.level-1)));
   // Haptics are optional; a device error must not mark a saved action failed.
   if(action){try{window.Telegram?.WebApp.HapticFeedback?.notificationOccurred('success');}catch{}}
  }catch(e){setError(true);setMessage(e instanceof Error&&e.name!=='TimeoutError'&&e.name!=='TypeError'?e.message:'Нет соединения. Проверь интернет и повтори запрос');}
  finally{setBusy(false);lock.current=false;}
 }
 useEffect(()=>{
  let active=true,started=false;
  const launch=new URLSearchParams(location.hash.slice(1)).get('tgWebAppData')||new URLSearchParams(location.search).get('tgWebAppData')||'';
  const inTelegram=new URLSearchParams(location.hash.slice(1)).has('tgWebAppData')||new URLSearchParams(location.search).has('tgWebAppData');
  const boot=()=>{
   if(!active)return;
   const tg=window.Telegram?.WebApp;
   try{tg?.ready();tg?.expand();}catch{}
   if(started)return;
   if(inTelegram&&!tg?.initData&&!launch){setSdkError(true);setError(true);setMessage('Не удалось подключиться к Telegram. Обнови приложение или открой его заново из бота');return;}
   started=true;setSdkError(false);initData.current=tg?.initData||launch;
   try{tg?.ready();tg?.expand();}catch{}
   void request();
  };
  const script=document.createElement('script');script.src='https://telegram.org/js/telegram-web-app.js';script.async=true;script.onload=boot;script.onerror=boot;
  if(window.Telegram?.WebApp)boot();else {document.head.appendChild(script);if(launch||!inTelegram)boot();}
  // A stalled SDK must not leave the interface loading indefinitely.
  const timeout=setTimeout(boot,8000);
  const refresh=()=>{if(started&&document.visibilityState==='visible'&&!pending.current)void request();};document.addEventListener('visibilitychange',refresh);
  const interval=setInterval(refresh,60000);
  return()=>{active=false;clearTimeout(timeout);clearInterval(interval);document.removeEventListener('visibilitychange',refresh);script.remove();};
 },[]);
 const s=data?.state;const date=data?new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(data.serverTime):'';
 const disabled=busy||!s||!!pending.current;
 const portraitStyle=stage===0?{backgroundImage:artBackground('/art/chudik-reactions.png'),backgroundSize:'300% 200%',backgroundPosition:'0% 0%'}:{backgroundImage:artBackground('/art/chudik-evolution.png'),backgroundSize:'300% 100%',backgroundPosition:`${stage*50}% center`};
 const tabs=[{id:'pet',label:'Остров',icon:HomeIcon},{id:'collection',label:'Питомцы',icon:PawPrint},{id:'gifts',label:'Подарки',icon:Gift},{id:'guide',label:'Как играть',icon:BookOpen}];
 const rewardCards=<><button className={'reward-card '+(s?.lastDaily===date?'claimed':'')} disabled={disabled||s?.lastDaily===date} onClick={()=>request('daily')}><span className="reward-art">🎁</span><span><small>КАЖДЫЙ ДЕНЬ</small><strong>Подарок острова</strong><span className="reward-description">+20 монет для новых чудес</span></span><span className="reward-arrow">{s?.lastDaily===date?<Check size={20}/>:<ChevronRight size={20}/>}</span></button><button className={'reward-card violet '+(s?.offerDone?'claimed':'')} disabled={disabled||s?.offerDone} onClick={()=>request('offer')}><span className="reward-art">🧪</span><span><small>ПЕРВОЕ ОТКРЫТИЕ</small><strong>Маленький эксперимент</strong><span className="reward-description">{s?.offerDone?'Выполнено · ты молодец!':'Тестовое задание · +15 монет'}</span></span><span className="reward-arrow">{s?.offerDone?<Check size={20}/>:<ChevronRight size={20}/>}</span></button></>;
 return <main className="app-shell">
 <div className="publisher-bar"><a className="publisher-name" href="https://sberseller.ru/" target="_blank" rel="noopener noreferrer" aria-label="СберСеллер — официальный сайт"><span className="publisher-orbit" aria-hidden="true"/><span>СберСеллер</span></a><span className="publisher-caption">ИГРОВОЙ МИР <span>ЧУДОЗВЕРЕЙ</span></span></div>
 <header className="app-header"><a className="brand" href="/" aria-label="Чудозвери — домой"><span className="brand-mark"><PawPrint size={25}/></span><span>Чудозвери<small>МАЛЕНЬКАЯ ЗАБОТА · БОЛЬШАЯ ДРУЖБА</small></span></a><span className="world-tag"><span className="live-dot"/>Волшебный остров</span></header>
 <div className="resource-bar" aria-label="Твои ресурсы"><div><span className="resource-icon gold"><Coins/></span><span><strong>{s?.coins??'—'}</strong><small>монеты</small></span></div><div><span className="resource-icon green"><Zap/></span><span><strong>{s?.energy??'—'}<em>/100</em></strong><small>энергия</small></span></div><div><span className="resource-icon purple"><Star/></span><span><strong>{s?.level??'—'}</strong><small>уровень</small></span></div></div>
 <div role="status" aria-live="polite" className={'status '+(error?'error':'')}>{busy?(s?'Сохраняем твоё маленькое чудо…':'Открываем остров…'):message}{error&&<button className="retry" disabled={busy} onClick={()=>sdkError?window.location.reload():request(pending.current?.action)}>{sdkError?'Обновить':'Повторить'}</button>}</div>
 {!s&&error&&!initData.current&&!sdkError&&<a className="signin" href="/signin-with-chatgpt?return_to=/" target="_top">Войти для браузерного теста <ChevronRight size={16}/></a>}
 <div className="page-heading brand-focus"><div><p className="eyebrow"><Sparkles size={13}/> МИР, В КОТОРОМ ТЕБЯ ЖДУТ</p><h1>{tab==='pet'?'Здесь живёт твоё чудо':tab==='collection'?'У каждого — своя магия':tab==='gifts'?'Маленькие радости дня':'Большие чудеса начинаются с заботы'}</h1></div><span className="chapter">{tab==='pet'?'01':tab==='collection'?'02':tab==='gifts'?'03':'04'} <span>/ ЧУДОЗВЕРИ</span></span></div>
 {tab==='pet'&&<div className="home-grid"><section className="pet-card" aria-label="Твой питомец"><div className="scene"><button className="pet-scene" onClick={()=>react(4,'Мур-р… мне так нравится быть рядом с тобой!')} aria-label="Погладить Чудика"><PetVisual petId="chudik" stage={stage} reaction={reaction} sequence={emotion.sequence} idleStyle={portraitStyle}/></button><div className="scene-heading"><div><span className="eyebrow">ТВОЙ ХРАНИТЕЛЬ</span><h2>Чудик <span>✦</span></h2></div><span className="stage-pill"><Leaf size={13}/>{['Малыш','Подросший','Крылатый'][stage]}</span></div><div className="fireflies" aria-hidden="true">{Array.from({length:8},(_,i)=><i key={i} style={{left:`${12+i*11}%`,animationDelay:`${i*.7}s`,top:`${15+i%3*22}%`}}/>)}</div><div className="speech" key={petLine}><Heart size={14}/>{petLine}</div><span className="touch-hint" role="status">{emotion.loading?'Готовим маленькое чудо…':emotion.failed?'Картинка не загрузилась — коснись ещё раз':'Коснись Чудика, чтобы погладить'}</span></div><div className="pet-controls"><div className="stats"><div><div className="stat-label"><span><Zap size={14}/> Энергия</span><strong>{s?.energy??'—'}<small>/100</small></strong></div><progress aria-label="Энергия" max="100" value={s?.energy??0}/><small>+1 каждую минуту</small></div><div><div className="stat-label"><span><Star size={14}/> Опыт</span><strong>{s?.xp??'—'}<small>/100</small></strong></div><progress className="xp" aria-label="Опыт" max="100" value={s?.xp??0}/><small>Новый уровень: +25 монет</small></div></div><div className="action-buttons"><button disabled={disabled||(s?.coins??0)<5||(s?.energy??0)>=100} onClick={()=>request('feed')}><Carrot size={24}/><span>Покормить<small>−5 монет · +10 опыта</small></span></button><button className="play" disabled={disabled||(s?.energy??0)<15} onClick={()=>request('play')}><Volleyball size={24}/><span>Поиграть<small>−15 энергии · +25 опыта</small></span></button></div><button className="quiet-button" onClick={()=>react(3,'Пять минуточек… мне снится волшебный лес.')}><Moon size={14}/> Тихая минутка <span>просто настроение</span></button></div></section>
 <aside className="island-aside"><section className="journey panel"><p className="eyebrow">РАСТЁМ ВМЕСТЕ</p><h2>Из маленькой искры —<br/>в большое чудо</h2><p className="muted">Каждая игра и каждая морковка делают вашу дружбу крепче.</p><div className="evolution-strip">{['Малыш','Росток','Крылья'].map((name,i)=><div className={stage>=i?'unlocked':'locked'} key={name}><div className="stage-thumb" style={{backgroundPosition:`${i*50}% center`}}/><span>{name}</span><small>{stage>=i?<Check size={12}/>:<Lock size={11}/>} Уровень {i+1}</small></div>)}</div><button className="text-link" onClick={()=>setTab('collection')}>Открыть альбом <ChevronRight size={16}/></button></section><section className="daily-section"><div className="section-title"><h2>Сегодня на острове</h2><Sparkles size={18}/></div>{rewardCards}</section><button className="discovery-banner" onClick={()=>setTab('collection')}><span className="mini-creature"/><span><small>ЗАГЛЯНИ В ВОЛШЕБНЫЙ ЛЕС</small><strong>Кто живёт по соседству?</strong><span>Познакомься с будущими друзьями</span></span><ChevronRight size={20}/></button></aside></div>}
 {tab==='collection'&&<><section className="album-heading panel"><div><p className="eyebrow">АЛЬБОМ ТВОЕГО ЧУДИКА</p><h2>Три ступени одной дружбы</h2><p className="muted">Открывай новые образы, заботясь о питомце.</p></div><span className="album-count">{s?.collection.length??0}<small> / 3</small></span></section><div className="album-grid">{['Первое яйцо','Первый росток','Крылья чудес'].map((name,i)=><article className={'album-card '+((s?.level??0)>i?'':'locked')} key={name}><div className="album-art" style={{backgroundPosition:`${i*50}% center`}}/><div><small>ЭТАП 0{i+1}</small><h3>{name}</h3><p>{(s?.level??0)>i?'✦ Уже в твоей истории':`Откроется на уровне ${i+1}`}</p></div></article>)}</div><PetGallery onVisitChudik={()=>setTab('pet')}/></>}
 {tab==='gifts'&&<div className="gifts-layout"><section className="gift-hero"><div className="gift-portrait"/><div><p className="eyebrow">ПОВОД ВЕРНУТЬСЯ</p><h2>Каждый день —<br/>немного волшебства</h2><p>Заглядывай к Чудику, забирай подарок и продолжай вашу историю.</p></div></section><section className="gift-list">{rewardCards}<p className="muted">Новый подарок появляется в 00:00 по Москве. «Первый эксперимент» доступен один раз. Все монеты — игровые.</p></section></div>}
 {tab==='guide'&&<section className="guide-grid">{[{icon:Heart,title:'Будь рядом',text:'Погладь Чудика нажатием на картинку. Он ответит улыбкой! «Тихая минутка» меняет настроение без расхода ресурсов.'},{icon:Carrot,title:'Угощай и играй',text:'Кормление стоит 5 монет: до +20 энергии и +10 опыта. Игра: −15 энергии, +25 опыта и +3 монеты. Между действиями — 1,5 секунды.'},{icon:Sparkles,title:'Наблюдай за чудом',text:'Каждые 100 опыта — новый уровень и 25 монет. На уровнях 2 и 3 Чудик меняет облик и открывает знак в альбоме.'},{icon:Gift,title:'Возвращайся за подарком',text:'Ежедневно можно получить 20 монет. Новый день начинается в 00:00 по Москве. Энергия восстанавливается: +1 в минуту, до 100.'}].map(({icon:Icon,title,text},i)=><article className="guide-card" key={title}><span className="guide-number">0{i+1}</span><Icon size={32}/><h2>{title}</h2><p>{text}</p></article>)}<div className="panel guide-note"><Leaf size={20}/><p>Прогресс сохраняется автоматически. Браузер и Telegram используют отдельные профили. Сейчас доступен один питомец; галерея показывает эскизы будущих героев.</p></div></section>}
 <footer><a className="footer-publisher" href="https://sberseller.ru/" target="_blank" rel="noopener noreferrer">СберСеллер <span>×</span> Чудозвери</a><span className="live-dot"/>{data?.mode==='telegram'?'Telegram · прогресс на сервере':'Браузерный тест · прогресс на сервере'}<p>Маленькая забота. Большая дружба.</p><small>Тестовая игра · без платежей и реальных призов</small></footer>
 <nav className="bottom-nav" aria-label="Разделы игры">{tabs.map(({id,label,icon:Icon})=><button key={id} aria-current={tab===id?'page':undefined} onClick={()=>{setTab(id);window.scrollTo({top:0,behavior:'instant'});}}><Icon size={23}/><span>{label}</span>{tab===id&&<i/>}</button>)}</nav>

 </main>
}
