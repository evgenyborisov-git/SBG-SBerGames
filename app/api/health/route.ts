import { env } from 'cloudflare:workers';
import {APP_RELEASE} from '../../../lib/release';
export const dynamic='force-dynamic';
export async function GET(){try{await env.DB?.prepare('SELECT id FROM players LIMIT 1').first();if(!env.DB)throw new Error();return Response.json({ok:true,version:APP_RELEASE,telegramConfigured:!!(env.TELEGRAM_BOT_TOKEN||env.TELEGRAM_BOT_ID)},{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({ok:false},{status:503,headers:{'Cache-Control':'no-store'}})}}
