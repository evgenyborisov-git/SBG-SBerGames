import {env} from 'cloudflare:workers';
import {handleDiagnostic} from '../../../lib/pilot-http';
export const dynamic='force-dynamic';
export const POST=(request:Request)=>handleDiagnostic(request,env);
