import type {Metadata} from 'next';
import {PilotGuide} from '../../components/pilot-guide';
export const metadata:Metadata={title:'Два дня на острове · Пилот Чудозверей'};
export default function PlaytestPage(){return <main className="app-shell content-column playtest-page"><a className="pilot-back" href="/">СберСеллер · Чудозвери</a><h1>Попробуем игру вместе?</h1><p className="muted">Короткий сценарий для первых тестировщиков. Сегодня — 5–10 минут, завтра — ещё несколько минут.</p><a className="pilot-signin" href="https://t.me/SberSellerChudozveriBot" target="_blank" rel="noopener noreferrer">Открыть бота в Telegram</a><PilotGuide/><footer>Без платежей и реальных призов · даты и смена дня по Москве</footer></main>;}
