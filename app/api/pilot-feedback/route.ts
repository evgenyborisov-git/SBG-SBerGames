import {env} from 'cloudflare:workers';
import {handleFeedback} from '../../../lib/feedback-http';
export const dynamic='force-dynamic';
export const POST=(request:Request)=>handleFeedback(request,env);
