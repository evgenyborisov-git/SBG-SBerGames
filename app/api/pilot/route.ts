import {env} from 'cloudflare:workers';
import {handlePilot} from '../../../lib/pilot-http';
export const dynamic='force-dynamic';
export const GET=(request:Request)=>handlePilot(request,env);
