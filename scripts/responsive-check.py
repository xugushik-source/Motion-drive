from playwright.sync_api import sync_playwright
import json,pathlib
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);page=b.new_page();failures=[];pages=0
 for lang in ['ka','hy','ru','en']:
  for route in ['', 'about','courses','pricing','instructors','exam','gallery','faq','contacts','reviews','booking','account','admin','instructor','privacy','terms','akhalkalaki','ninotsminda']:
   page.set_viewport_size({'width':390,'height':844});r=page.goto(f'http://localhost:3000/{lang}/{route}',wait_until='networkidle');pages+=1
   if r.status!=200 or page.evaluate('document.documentElement.scrollWidth>innerWidth'):failures.append([lang,route,r.status,'overflow' if page.evaluate('document.documentElement.scrollWidth>innerWidth') else 'status'])
 for width in [320,360,768,1024,1440]:
  page.set_viewport_size({'width':width,'height':900});page.goto('http://localhost:3000/ka',wait_until='networkidle')
  if page.evaluate('document.documentElement.scrollWidth>innerWidth'):failures.append(['ka','home',width,'overflow'])
 print('Pages checked:',pages,'failures:',failures,flush=True);pathlib.Path('docs/verification/responsive-report.json').write_text(json.dumps({'pages':pages,'languages':4,'widths':[320,360,390,768,1024,1440],'failures':failures},indent=2));b.close();assert not failures,failures
