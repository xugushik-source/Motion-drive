import {DatabaseSync} from 'node:sqlite';
import {randomBytes,scryptSync,randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
const email=process.env.ADMIN_EMAIL,password=process.env.ADMIN_PASSWORD;
if(!email||!password||password.length<12)throw Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters) in your terminal environment. Never share them in chat.');
const path=resolve(process.env.DATABASE_PATH||'./data/motion-drive.sqlite');mkdirSync(dirname(path),{recursive:true,mode:0o700});const db=new DatabaseSync(path);
db.exec("CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'student',locale TEXT NOT NULL DEFAULT 'ru')");
const salt=randomBytes(16).toString('hex');db.prepare("INSERT INTO users(id,email,name,password,role) VALUES(?,?,?,?, 'admin')").run(randomUUID(),email.toLowerCase(), 'Motion Drive',salt+':'+scryptSync(password,salt,64).toString('hex'));console.log('Administrator created.');
