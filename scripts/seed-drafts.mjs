import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
const db=new DatabaseSync(process.env.DATABASE_PATH||'./data/motion-drive.sqlite');
const drafts=[
 {id:'branch-akhalkalaki',kind:'branches',data:{title:'Ахалкалаки',city:'akhalkalaki',locale:'ru',address:'ул. Свободы, 36/1 — номер дома требует подтверждения (NOR указывает 36)',phone:'+995597939327',hours:'Пн–Сб 10:00–18:00 — проверить актуальность',source:'https://jnews.ge/162061/ ; https://nor.ge/278266/amp/',verifiedAt:'2026-11-09',status:'draft'}},
 {id:'branch-ninotsminda',kind:'branches',data:{title:'Ниноцминда',city:'ninotsminda',locale:'ru',address:'ул. Свободы, 19 — подтвердить владельцу',phone:'+995597927492',hours:'Пн–Сб 10:00–18:00 — проверить актуальность',source:'https://jnews.ge/162061/ ; https://nor.ge/278266/amp/',verifiedAt:'2026-11-09',status:'draft'}}
];
for(const d of drafts)db.prepare('INSERT OR IGNORE INTO records(id,kind,data) VALUES(?,?,?)').run(d.id,d.kind,JSON.stringify(d.data));console.log('Source-backed branch drafts saved; nothing published.');
