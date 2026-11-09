import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {cookies} from 'next/headers';
import {db,one} from './db';
export function hashPassword(password:string){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex');}
export function checkPassword(password:string,stored:string){try{const [salt,h]=stored.split(':');return timingSafeEqual(Buffer.from(h,'hex'),scryptSync(password,salt,64));}catch{return false;}}
export async function currentUser(){const token=(await cookies()).get('md_session')?.value;if(!token)return null;return one('SELECT u.id,u.email,u.name,u.role,u.locale FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.id=? AND s.expires>?',token,Date.now())||null;}
export async function startSession(userId:string){const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(token,userId,Date.now()+7*86400000);(await cookies()).set('md_session',token,{httpOnly:true,secure:process.env.APP_URL?.startsWith('https://')||false,sameSite:'lax',path:'/',maxAge:604800});}
