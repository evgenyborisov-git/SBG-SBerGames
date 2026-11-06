import { env } from 'cloudflare:workers';
export const dynamic='force-dynamic';
export async function GET(){try{await env.DB?.prepare('SELECT id FROM players LIMIT 1').first();if(!env.DB)throw new Error();return Response.json({ok:true,version:'0.1.0',telegramConfigured:!!(env.TELEGRAM_BOT_TOKEN||env.TELEGRAM_BOT_ID)},{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({ok:false},{status:503})}}
