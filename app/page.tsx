'use client';
import {useEffect,useRef,useState} from 'react';
type Snapshot={state:{coins:number;energy:number;xp:number;level:number;lastDaily:string;offerDone:boolean;collection:string[]};revision:number;mode:string;serverTime:number;message?:string};
declare global {interface Window{Telegram?:{WebApp:{initData:string;ready:()=>void;expand:()=>void;HapticFeedback?:{notificationOccurred:(type:string)=>void}}}}}
export default function Home(){
 const [data,setData]=useState<Snapshot|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('Подключаемся к лаборатории…'),[error,setError]=useState(false),[tab,setTab]=useState('pet');
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
 return <main><header className="top"><a className="brand" href="/">✦ <span>Чудозвери<small>Сберселлер</small></span></a><span className="tag">🪙 {s?.coins??'—'} <small>монет</small></span></header>
 <div className="heading"><div><p className="eyebrow">МАЛЕНЬКАЯ ЗАБОТА · БОЛЬШИЕ ЧУДЕСА</p><h1>{tab==='pet'?'Твой маленький мир':'Коллекция чудес'}</h1></div><span className="version">MVP 0.1</span></div>
 <nav aria-label="Разделы"><button aria-pressed={tab==='pet'} onClick={()=>setTab('pet')}>🐣 Питомец</button><button aria-pressed={tab==='collection'} onClick={()=>setTab('collection')}>🎒 Коллекция <span>{s?.collection.length??0}/3</span></button></nav>
 <div role="status" aria-live="polite" className={'status '+(error?'error':'')}>{busy?(s?'Сохраняем…':'Загружаем прогресс…'):message}{error&&<button className="retry" disabled={busy} onClick={()=>sdkError?window.location.reload():request(pending.current?.action)}>{sdkError?'Обновить':'Повторить'}</button>}</div>
 {!s&&error&&!initData.current&&!sdkError&&<a className="signin" href="/signin-with-chatgpt?return_to=/" target="_top">Войти для браузерного теста</a>}
 {tab==='pet'?<><section className="panel pet-panel"><div className="top"><div><h2>Чудик</h2><p className="muted">{s&&s.level>=3?'Волшебный друг':s&&s.level>=2?'Подросший Чудик':'Малыш Чудик'}</p></div><span className="level">Уровень {s?.level??'—'}</span></div><div className="habitat"><div className="pet-portrait" role="img" aria-label={s&&s.level>=3?'Чудик с волшебными крыльями':s&&s.level>=2?'Подросший мятный лисёнок Чудик':'Малыш Чудик — мятный лисёнок'} style={{backgroundPosition:`${s&&s.level>=3?100:s&&s.level>=2?50:0}% center`}}/><p>Заботься обо мне, и я вырасту!</p></div>
 <div className="stats"><div><div className="top"><span>⚡ Энергия</span><strong>{s?.energy??'—'}<small>/100</small></strong></div><progress aria-label="Энергия" max="100" value={s?.energy??0}/><small className="muted">+1 каждую минуту</small></div><div><div className="top"><span>⭐ Опыт</span><strong>{s?.xp??'—'}<small>/100</small></strong></div><progress className="xp" aria-label="Опыт" max="100" value={s?.xp??0}/><small className="muted">Новый уровень: +25 монет</small></div></div>
 <div className="buttons"><button disabled={disabled||s!.coins<5||s!.energy>=100} onClick={()=>request('feed')}>🥕 Покормить<small>−5 монет · +20 энергии · +10 XP</small></button><button className="secondary" disabled={disabled||s!.energy<15} onClick={()=>request('play')}>🎾 Поиграть<small>−15 энергии · +25 XP · +3 монеты</small></button></div></section>
 <section className="panel"><h2>Каждый день — маленькое чудо</h2><div className="item"><span className="reward-icon">🎁</span><div><strong>Ежедневный подарок</strong><p className="muted">+20 монет · новый день по Москве</p></div><button disabled={disabled||s!.lastDaily===date} onClick={()=>request('daily')}>{s?.lastDaily===date?'Получено':'Забрать'}</button></div><div className="item"><span className="reward-icon">🧪</span><div><strong>Первый эксперимент</strong><p className="muted">Тестовое задание · +15 монет один раз</p></div><button disabled={disabled||s!.offerDone} onClick={()=>request('offer')}>{s?.offerDone?'Готово':'Пройти'}</button></div></section></>:<section className="panel"><h2>История твоего Чудика</h2><p className="muted">Расти вместе с питомцем и открывай памятные знаки</p>{['🥚 Первое яйцо','🌱 Первый росток','🦋 Крылья чудес'].map((item,i)=><div className={'collection-item '+(s?.collection.includes(item)?'unlocked':'locked')} key={item}><div className="stage-thumb" role="img" aria-label={`Чудик: этап ${i+1}`} style={{backgroundPosition:`${i*50}% center`}}/><span>{item}</span><small>{s?.collection.includes(item)?'Открыто':`Уровень ${i+1}`}</small></div>)}<p className="muted">В MVP доступен один питомец и три этапа его истории</p></section>}
 {tab==='collection'&&<section className="panel gallery"><p className="eyebrow">МИР ЧУДОЗВЕРЕЙ</p><h2>Знакомься с лесными друзьями</h2><p className="muted">Эскизы новых героев. Сейчас растить можно только Чудика — остальных пока можно рассмотреть здесь.</p><div className="creature-grid">{['Мятный лисёнок','Лунный зайчик','Персиковый дракон','Облачная выдра','Солнечный совёнок','Цветочный оленёнок'].map((name,i)=><figure key={name}><div className="creature-portrait" role="img" aria-label={name} style={{backgroundPosition:`${(i%3)*50}% ${i<3?0:100}%`}}/><figcaption>{name}</figcaption></figure>)}</div></section>}
 <section className="panel rules"><details><summary>Как играть <span>Краткие правила</span></summary><p className="muted">Выращивай Чудика: корми, играй и открывай новые этапы его истории.</p><ul><li><strong>Старт:</strong> 50 монет, 70 энергии, 0 опыта и 1-й уровень.</li><li><strong>Корми:</strong> за 5 монет получай до 20 энергии и 10 опыта.</li><li><strong>Играй:</strong> трать 15 энергии, получай 25 опыта и 3 монеты.</li><li><strong>Расти:</strong> каждые 100 опыта — новый уровень и 25 монет. На уровнях 2 и 3 Чудик меняется и открывает знак в коллекции.</li><li><strong>Возвращайся:</strong> энергия восстанавливается на 1 в минуту, до 100. Ежедневный подарок — 20 монет; новый день начинается в 00:00 по Москве.</li><li><strong>Попробуй задание:</strong> «Первый эксперимент» даёт 15 монет один раз.</li></ul><p className="muted">Прогресс сохраняется автоматически. Между кормлением и игрой — пауза 1,5 секунды. Монеты тестовые, покупать ничего не нужно.</p></details></section>
 <footer><span className="dot"/>{data?.mode==='telegram'?'Telegram · серверный прогресс':'Браузерный тест · серверный прогресс'}<p>Тестовые монеты и задания. Без платежей и реальных призов.</p><small>Браузер и Telegram используют отдельные игровые профили</small></footer></main>
}
