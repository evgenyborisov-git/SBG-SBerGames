import { env } from 'cloudflare:workers';
import { handleGame } from '../../../lib/game/http';
export const dynamic='force-dynamic';
export const GET=(request:Request)=>handleGame(request,env);
export const POST=(request:Request)=>handleGame(request,env,true);
