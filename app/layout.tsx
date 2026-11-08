import type {Metadata,Viewport} from 'next';
import './fonts.css';
import './globals.css';
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#f1f7ed'};
export const metadata:Metadata={title:'СберСеллер · Чудозвери',description:'Заботься о Чудике, открывай новые этапы и собирай маленькие чудеса'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ru"><body>{children}</body></html>}
