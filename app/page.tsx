'use client';
import {useEffect,useRef,useState} from 'react';
import {queueDiagnostic,flushDiagnostics,supportText} from '../lib/client-diagnostics';
import type {ClientErrorCode} from '../lib/pilot';
import {FirstSteps} from '../components/first-steps';
import {FireflyGame} from '../components/firefly-game';
import type {FireflyHit} from '../lib/game/fireflies';
import {PetPicker} from '../components/pet-picker';
import {galleryPets} from '../lib/gallery';
import type {PetId} from '../lib/game/pets';
import {dailyQuests,petStage,type State} from '../lib/game/rules';
import {usePetReaction,type Reaction} from '../components/pet-reactions';
import {PawPrint,BookOpen,Zap,Star,Coins,ChevronRight,Check} from 'lucide-react';
import {IslandScreen} from '../components/island-screen';
import {CollectionScreen,type CollectionView} from '../components/collection-screen';
import {GameNavigation} from '../components/game-navigation';
import {HelpHub} from '../components/help-hub';
type Snapshot={state:State;revision:number;mode:string;serverTime:number;message?:string;pilotAdmin?:boolean};
declare global {interface Window{Telegram?:{WebApp:{initData:string;ready:()=>void;expand:()=>void;HapticFeedback?:{notificationOccurred:(type:string)=>void}}}}}
export default function Home(){
 const [data,setData]=useState<Snapshot|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('Подключаемся к лаборатории…'),[error,setError]=useState(false),[tab,setTab]=useState('pet');
 const pet=galleryPets.find(item=>item.id===data?.state.petId)??galleryPets[0];
 const stage=data?petStage(data.state):0;
 const [collectionView,setCollectionView]=useState<CollectionView>('friends');
 const emotion=usePetReaction(pet.id,stage);
 const reaction=emotion.reaction;
 const [petLine,setPetLine]=useState('Как хорошо, что ты здесь!');
 function react(index:Reaction,line:string,nextStage=stage){emotion.trigger(index,nextStage);setPetLine(line);}
 useEffect(()=>{if(reaction===0)setPetLine('Как хорошо, что ты здесь!');},[reaction]);
 const [sdkError,setSdkError]=useState(false),[failure,setFailure]=useState<{code:string;requestId:string}|null>(null),[copied,setCopied]=useState(false);
 const snapshotReceived=useRef(0),introTarget=useRef(false);
 const pending=useRef<{action:string;key:string;petId?:PetId;questId?:string;questDay?:string;expectedStage?:number;expectedCost?:number;roundId?:string;hits?:FireflyHit[]}|null>(null),lock=useRef(false),initData=useRef('');
 function reportClient(code:ClientErrorCode,eventId=crypto.randomUUID()){queueDiagnostic(code,eventId);void flushDiagnostics(initData.current);return eventId;}
 useEffect(()=>{if(emotion.failed)reportClient('art_load_failed');},[emotion.failed]);
 async function request(action?:string,selectedPet?:PetId,questId?:string,quote?:{expectedStage?:number;expectedCost:number},roundResult?:{roundId:string;hits:FireflyHit[]}){
  if(lock.current)return;lock.current=true;setBusy(true);setError(false);
  const headers:Record<string,string>={};if(initData.current)headers['x-telegram-init-data']=initData.current;
  if(action){pending.current??={action,key:crypto.randomUUID(),...quote,...roundResult,...(selectedPet?{petId:selectedPet}:['feed','play'].includes(action)&&data?.state.petId?{petId:data.state.petId}:{}),...(questId?{questId,questDay:data?.state.journey?.tasks.day}:{})};headers['Content-Type']='application/json';headers['Idempotency-Key']=pending.current.key;}
  let failureCode='network_error',failureId=crypto.randomUUID(),serverRejected=false;
  try{
   const response=await fetch('/api/game',{method:action?'POST':'GET',headers,body:action?JSON.stringify({...pending.current!,key:undefined,action:pending.current!.action,...(pending.current!.petId?{petId:pending.current!.petId}:{}),...(pending.current!.questId?{questId:pending.current!.questId,questDay:pending.current!.questDay}:{})}):undefined,signal:AbortSignal.timeout(15000)});
   const serverRequestId=response.headers.get('x-request-id');if(serverRequestId&&/^[a-f0-9-]{36}$/.test(serverRequestId))failureId=serverRequestId;failureCode='invalid_response';
   const result=await response.json().catch(()=>{throw new Error('Сервер не ответил. Проверь соединение и повтори запрос');}) as Snapshot & {message?:string;error?:string};
   if(response.ok&&(!result.state||!Number.isSafeInteger(result.revision)))throw new Error('Сервер прислал неполный ответ. Повтори запрос');
   if(!response.ok){serverRejected=true;failureCode=result.error&&/^[a-z_]{1,40}$/.test(result.error)?result.error:'unavailable';if(response.status<500)pending.current=null;if(response.status===401)setData(null);if(response.status===409){try{const fresh=await fetch('/api/game',{headers,signal:AbortSignal.timeout(10000)});if(fresh.ok){const snapshot=await fresh.json() as Snapshot;snapshotReceived.current=performance.now();setData(snapshot);}}catch{}}throw new Error(result.message||'Не удалось связаться с сервером');}
   if(action)pending.current=null;setFailure(null);setCopied(false);void flushDiagnostics(initData.current);snapshotReceived.current=performance.now();setData(result);setMessage(result.message||'Прогресс сохранён на сервере');
   if(action==='dismiss_intro'){if(introTarget.current){setTab('collection');window.scrollTo({top:0,behavior:'instant'});}introTarget.current=false;}else if(action==='select_pet'||action==='visit_pet'){setTab('pet');window.scrollTo({top:0,behavior:'instant'});setPetLine('Как хорошо, что ты здесь!');}else if(action&&!['firefly_start','intro_pet'].includes(action))react(action==='feed'?1:action==='play'?2:5,action==='feed'?'Хрум-хрум… любимое угощение!':action==='play'?'Ещё раз! Лови солнечный мячик!':action==='evolve_pet'?'Моя магия проснулась! Давай играть вместе!':'Ура! Сегодня случилось маленькое чудо!',petStage(result.state));
   // Haptics are optional; a device error must not mark a saved action failed.
   if(action){try{window.Telegram?.WebApp.HapticFeedback?.notificationOccurred('success');}catch{}}
  }catch(e){if(!serverRejected&&e instanceof Error&&e.name==='TimeoutError')failureCode='network_timeout';setFailure({code:failureCode,requestId:failureId});setCopied(false);if(!serverRejected&&['network_error','network_timeout','invalid_response'].includes(failureCode))reportClient(failureCode as ClientErrorCode,failureId);setError(true);setMessage(e instanceof Error&&e.name!=='TimeoutError'&&e.name!=='TypeError'?e.message:'Нет соединения. Проверь интернет и повтори запрос');}
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
   if(inTelegram&&!tg?.initData&&!launch){setFailure({code:'sdk_unavailable',requestId:reportClient('sdk_unavailable')});setSdkError(true);setError(true);setMessage('Не удалось подключиться к Telegram. Обнови приложение или открой его заново из бота');return;}
   started=true;setSdkError(false);initData.current=tg?.initData||launch;
   try{tg?.ready();tg?.expand();}catch{}
   void request();
  };
  const script=document.createElement('script');script.src='https://telegram.org/js/telegram-web-app.js';script.async=true;script.onload=boot;script.onerror=()=>{if(inTelegram)reportClient('sdk_unavailable');boot();};
  if(window.Telegram?.WebApp)boot();else {document.head.appendChild(script);if(launch||!inTelegram)boot();}
  // A stalled SDK must not leave the interface loading indefinitely.
  const timeout=setTimeout(()=>{if(inTelegram&&!window.Telegram?.WebApp)reportClient('sdk_unavailable');boot();},8000);
  const refresh=()=>{if(started&&document.visibilityState==='visible'&&!pending.current)void request();};document.addEventListener('visibilitychange',refresh);
  const online=()=>{void flushDiagnostics(initData.current);};window.addEventListener('online',online);
  const interval=setInterval(refresh,60000);
  return()=>{active=false;clearTimeout(timeout);clearInterval(interval);window.removeEventListener('online',online);document.removeEventListener('visibilitychange',refresh);script.remove();};
 },[]);
 const s=data?.state;const date=data?new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(data.serverTime):'';
 const disabled=busy||!s||!!pending.current;
 const dailyReward=<button className={'reward-card '+(s?.lastDaily===date?'claimed':'')} disabled={disabled||s?.lastDaily===date} onClick={()=>request('daily')}><span className="reward-art">🎁</span><span><small>КАЖДЫЙ ДЕНЬ</small><strong>Подарок острова</strong><span className="reward-description">+20 монет · +5 кристаллов</span></span><span className="reward-arrow">{s?.lastDaily===date?<Check size={20}/>:<ChevronRight size={20}/>}</span></button>;
 const experimentReward=<button className={'reward-card violet '+(s?.offerDone?'claimed':'')} disabled={disabled||s?.offerDone} onClick={()=>request('offer')}><span className="reward-art">🧪</span><span><small>ПЕРВОЕ ОТКРЫТИЕ</small><strong>Маленький эксперимент</strong><span className="reward-description">{s?.offerDone?'Выполнено · ты молодец!':'Тестовое задание · +15 монет'}</span></span><span className="reward-arrow">{s?.offerDone?<Check size={20}/>:<ChevronRight size={20}/>}</span></button>;
 const journey=s?.journey;
 const taskCards=journey&&<section className="daily-quests panel"><p className="eyebrow">ЗАБОТА ПРИНОСИТ КРИСТАЛЛЫ</p><h2>Задания дня</h2><p className="muted">За три задания — 40 кристаллов. Новый набор появится в 00:00 по Москве.</p>{dailyQuests(s!).map(q=><div className="quest-row" key={q.id}><div><strong>{q.title}</strong><p>{q.description} · {Math.min(q.target,journey.tasks[q.id])}/{q.target}</p><progress aria-label={q.title} max={q.target} value={journey.tasks[q.id]}/></div><button disabled={disabled||journey.tasks.claimed.includes(q.id)||journey.tasks[q.id]<q.target} onClick={()=>request('claim_quest',undefined,q.id)}>{journey.tasks.claimed.includes(q.id)?'Получено':`Забрать +${q.reward} ✦`}</button></div>)}</section>;
 function petFriend(){react(4,'Мур-р… мне так нравится быть рядом с тобой!');if(s?.petId&&s.intro&&!s.intro.done&&!s.intro.petted&&!disabled)void request('intro_pet');}
 function showPet(){document.querySelector('.pet-card')?.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
 function finishIntro(collection:boolean){if(collection)setCollectionView('friends');introTarget.current=collection;void request('dismiss_intro');}
 const choosing=!!s&&(s.petId===null);
 function navigate(id:string){setTab(id);window.scrollTo({top:0,behavior:'instant'});}
 const readyRewards=s?(s.lastDaily!==date?1:0)+dailyQuests(s).filter(q=>!journey?.tasks.claimed.includes(q.id)&&(journey?.tasks[q.id]??0)>=q.target).length:0;
 const activeRound=s?.fireflies?.round;
 const roundPending=activeRound&&!activeRound.settled&&!!data&&data.serverTime+performance.now()-snapshotReceived.current-activeRound.startedAt<=300000;
 return <main className={'app-shell simplified-shell'+(choosing?' is-choosing':'')}>
 <div className="publisher-bar"><a className="publisher-name" href="https://sberseller.ru/" target="_blank" rel="noopener noreferrer" aria-label="СберСеллер — официальный сайт"><span className="publisher-orbit" aria-hidden="true"/><span>СберСеллер</span></a><span className="publisher-caption">ИГРОВОЙ МИР <span>ЧУДОЗВЕРЕЙ</span></span></div>
 <header className="app-header"><a className="brand" href="/" aria-label="Чудозвери — домой"><span className="brand-mark"><PawPrint size={25}/></span><span>Чудозвери<small>МАЛЕНЬКАЯ ЗАБОТА · БОЛЬШАЯ ДРУЖБА</small></span></a>{s&&!choosing&&<button className="help-button" onClick={()=>navigate('guide')} aria-label="Помощь, правила и отзыв" aria-current={tab==='guide'?'page':undefined}><BookOpen size={20}/><span>Помощь</span></button>}</header>
 {s&&!choosing&&!['pet','guide'].includes(tab)&&<div className="resource-bar" aria-label="Твои ресурсы"><div><span className="resource-icon gold"><Coins/></span><span><strong>{s?.coins??'—'}</strong><small>монеты</small></span></div><div><span className="resource-icon green"><Zap/></span><span><strong>{s?.energy??'—'}<em>/100</em></strong><small>энергия</small></span></div><div><span className="resource-icon purple"><Star/></span><span><strong>{s?.level??'—'}</strong><small>уровень</small></span></div></div>}
 <div role="status" aria-live="polite" className={'status '+(error?'error':'')}>{busy?(s?'Сохраняем твоё маленькое чудо…':'Открываем остров…'):message}{error&&<button className="retry" disabled={busy} onClick={()=>sdkError?window.location.reload():request(pending.current?.action)}>{sdkError?'Обновить':'Повторить'}</button>}{error&&failure&&<details className="support-details"><summary>Диагностика для поддержки</summary><pre>{supportText(failure.code,failure.requestId,!!initData.current||sdkError,!!window.Telegram?.WebApp)}</pre><button className="retry" onClick={async()=>{try{await navigator.clipboard.writeText(supportText(failure.code,failure.requestId,!!initData.current||sdkError,!!window.Telegram?.WebApp));setCopied(true);}catch{setCopied(false);}}}>{copied?'Скопировано':'Скопировать'}</button></details>}</div>
 {!s&&error&&!initData.current&&!sdkError&&<a className="signin" href="/signin-with-chatgpt?return_to=/" target="_top">Войти для браузерного теста <ChevronRight size={16}/></a>}
 {s&&!choosing&&<div className="page-heading simple-heading"><h1>{tab==='pet'?'Твой остров':tab==='games'?'Поиграем?':tab==='collection'?'Твои питомцы':tab==='today'?'Сегодня на острове':'Помощь'}</h1></div>}
 {choosing&&<PetPicker initialPetId={pet.id} stage={stage} disabled={disabled} onConfirm={id=>request('select_pet',id)} errorMessage={error?message:undefined} onRetry={error&&pending.current?()=>request(pending.current?.action):undefined}/>}
 {s&&!choosing&&tab==='pet'&&<>{roundPending&&<button className="round-return" onClick={()=>navigate('games')}>Вернуться к светлячкам <ChevronRight size={17}/></button>}<IslandScreen state={s} disabled={disabled} emotion={emotion} petLine={petLine} onPet={petFriend} onFeed={()=>request('feed')} onPlay={()=>request('play')} onQuiet={()=>react(3,'Пять минуточек… мне снится волшебный лес.')} onToday={()=>navigate('today')} onCollection={()=>{setCollectionView('friends');navigate('collection');}}><FirstSteps state={s} disabled={disabled} onPet={()=>{petFriend();showPet();}} onPlay={()=>{void request('play');showPet();}} onGift={()=>request('daily')} onDismiss={finishIntro}/></IslandScreen></>}
 {s&&!choosing&&tab==='games'&&data&&<div className="content-column games-screen"><FireflyGame state={s} serverTime={data.serverTime+performance.now()-snapshotReceived.current} disabled={disabled} onStart={()=>request('firefly_start')} onFinish={(roundId,hits)=>request('firefly_finish',undefined,undefined,undefined,{roundId,hits})}/><button className="text-link" onClick={()=>navigate('pet')}>Обычная игра с другом — на острове <ChevronRight size={16}/></button></div>}
 {s&&!choosing&&tab==='collection'&&<CollectionScreen state={s} view={collectionView} onView={setCollectionView} disabled={disabled} onVisit={id=>request('visit_pet',id)} onHome={()=>navigate('pet')} onUnlock={(id,expectedCost)=>request('unlock_pet',id,undefined,{expectedCost})} onEvolve={(id,expectedStage,expectedCost)=>request('evolve_pet',id,undefined,{expectedStage,expectedCost})}/>}
 {s&&!choosing&&tab==='today'&&<div className="content-column today-screen"><section aria-label="Ежедневный подарок">{dailyReward}</section>{taskCards}<details className="panel secondary-details"><summary>Ещё одно задание</summary>{experimentReward}<p className="muted">«Маленький эксперимент» доступен один раз. Все награды — игровые.</p></details></div>}
 {s&&!choosing&&<div hidden={tab!=='guide'}><HelpHub getAuth={()=>initData.current}/></div>}
 <footer><a className="footer-publisher" href="https://sberseller.ru/" target="_blank" rel="noopener noreferrer">СберСеллер <span>×</span> Чудозвери</a><p>Маленькая забота. Большая дружба.</p><small>Тестовая игра · без платежей и реальных призов</small>{data?.pilotAdmin&&<a className="pilot-entry" href="/pilot">Статистика пилота · для владельца</a>}</footer>
 {s&&!choosing&&<GameNavigation active={tab} readyRewards={readyRewards} onNavigate={navigate}/>}

 </main>
}
