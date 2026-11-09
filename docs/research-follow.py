from playwright.sync_api import sync_playwright
import json, pathlib
root=pathlib.Path('/workspace/motion-drive/docs/research');root.mkdir(exist_ok=True)
urls=['https://clutch-drive.framer.website/','https://clutchdriving.framer.website/','https://coastlineacademy.com/location-search','https://coastlineacademy.com/profile','https://www.sa.gov.ge/p/driver-license/theoretical-test']
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for i,url in enumerate(urls):
  page=browser.new_page(viewport={'width':1440,'height':960},ignore_https_errors=False)
  try:
   page.goto(url,wait_until='domcontentloaded',timeout=45000);page.wait_for_timeout(1800)
   data={'requested':url,'url':page.url,'title':page.title(),'text':page.locator('body').inner_text()[:42000],'links':page.locator('a').evaluate_all('(els)=>els.map(e=>({text:e.textContent,url:e.href})).filter(e=>e.url)')[:150]}
   (root/f'follow-{i}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
   if i<3:
    page.screenshot(path=str(root/f'follow-{i}-desktop.png'));page.mouse.wheel(0,750);page.wait_for_timeout(700);page.screenshot(path=str(root/f'follow-{i}-scroll.png'));page.set_viewport_size({'width':390,'height':844});page.goto(url,wait_until='domcontentloaded');page.wait_for_timeout(800);page.screenshot(path=str(root/f'follow-{i}-mobile.png'))
   print(i,data['title'],data['url'],data['text'][:500],flush=True)
  except Exception as e:
   (root/f'follow-{i}-error.txt').write_text(str(e));print(i,str(e)[:200],flush=True)
  page.close()
 browser.close()
