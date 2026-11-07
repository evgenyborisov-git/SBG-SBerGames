import type {Metadata,Viewport} from 'next';
import './globals.css';
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#edf6f2'};
export const metadata:Metadata={title:'Сберселлер · Чудозвери',description:'Заботься о Чудике, открывай новые этапы и собирай маленькие чудеса'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ru"><body>{children}</body></html>}
