import type {Metadata} from 'next';
import {PilotDashboard} from '../../components/pilot-dashboard';
export const metadata:Metadata={title:'Статистика пилота · Чудозвери',robots:{index:false,follow:false}};
export default function PilotPage(){return <PilotDashboard/>;}
