import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'SBerGames · Чудо Lab',description:'Заботься о Чудике, открывай новые этапы и собирай маленькие чудеса'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ru"><body>{children}</body></html>}
