from playwright.sync_api import sync_playwright
import pathlib,json,time
root=pathlib.Path('/workspace/motion-drive/docs/verification');root.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://localhost:3000/ru',wait_until='networkidle');page.evaluate('window.scrollTo(0,0)');page.wait_for_timeout(800);page.screenshot(path=str(root/'hero-desktop.png'));
 for y in range(0,7000,600):page.evaluate(f'window.scrollTo(0,{y})');page.wait_for_timeout(160)
 page.evaluate('window.scrollTo(0,0)');page.wait_for_timeout(600);page.screenshot(path=str(root/'home-desktop.png'),full_page=True)
 print('home',page.title(), 'overflow',page.evaluate('document.documentElement.scrollWidth>innerWidth'),'errors',errors,flush=True)
 for lang in ['ka','hy','ru','en']:
  page.goto('http://localhost:3000/'+lang,wait_until='networkidle');assert page.locator('html').get_attribute('lang')==lang;assert page.locator('h1').inner_text();print('language',lang,flush=True)
 page.set_viewport_size({'width':390,'height':844});page.goto('http://localhost:3000/ru',wait_until='networkidle');page.screenshot(path=str(root/'hero-mobile.png'));
 for y in range(0,10000,500):page.evaluate(f'window.scrollTo(0,{y})');page.wait_for_timeout(120)
 page.evaluate('window.scrollTo(0,0)');page.wait_for_timeout(300);page.screenshot(path=str(root/'home-mobile.png'),full_page=True)
 assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
 page.get_by_role('button',name='Меню',exact=True).click();assert page.locator('.mobile-nav').is_visible();page.get_by_role('button',name='Закрыть',exact=True).click()
 page.get_by_role('button',name='Консультант Motion Drive',exact=True).click();page.get_by_placeholder('Ваш вопрос…').fill('Какая стоимость?');page.locator('.chat-input button').click();page.wait_for_timeout(800);assert page.locator('.chat-messages').inner_text().find('утверждённого ответа')>=0;page.screenshot(path=str(root/'chat-mobile.png'));page.locator('.chat-header button').click()
 page.goto('http://localhost:3000/ru/account',wait_until='networkidle');page.get_by_role('button',name='Создать аккаунт',exact=True).click();page.locator('input[name=name]').fill('Browser Student');email=f'browser-{time.time_ns()}@example.test';page.locator('input[name=email]').fill(email);page.locator('input[name=password]').fill('local-test-password-strong');page.locator('.checkbox input').check();page.locator('.form-card button[type=submit],.form-card > button').last.click();page.wait_for_timeout(1000);assert page.locator('.workspace').is_visible();print('registration UI success',flush=True)
 page.goto('http://localhost:3000/ru/booking',wait_until='networkidle');page.locator('textarea[name=note]').fill('Browser verification request');page.locator('input[name=consent]').check();page.get_by_role('button',name='Отправить заявку',exact=True).click();page.wait_for_timeout(600);assert page.locator('.success-card').is_visible();print('booking saved UI success',flush=True)
 page.goto('http://localhost:3000/ru/account',wait_until='networkidle');assert page.locator('.booking-record').count()==1;page.get_by_role('button',name='Отменить',exact=True).click();page.wait_for_timeout(400);assert page.locator('.status.cancelled').count()==1;print('cancellation persisted success',flush=True)
 page.goto('http://localhost:3000/ru/admin',wait_until='networkidle');assert not page.locator('.workspace').count();assert 'соответствующей роли' in page.locator('main').inner_text();print('student denied admin UI success',flush=True)
 page.emulate_media(reduced_motion='reduce');page.goto('http://localhost:3000/ru',wait_until='networkidle');assert page.evaluate("getComputedStyle(document.documentElement).scrollBehavior")=='auto';print('reduced motion success',flush=True)
 print('errors',errors,flush=True);(root/'browser-report.json').write_text(json.dumps({'errors':errors,'viewport':[390,844],'scenarios':['four languages','mobile navigation','FAQ fallback','registration','booking persistence','cancellation','admin isolation','reduced motion']},indent=2))
 assert not errors,errors
 import sqlite3
 conn=sqlite3.connect('/workspace/motion-drive/data/motion-drive.sqlite');uids=conn.execute("SELECT id FROM users WHERE email LIKE 'browser-%@example.test'").fetchall()
 for (uid,) in uids:
  for table in ['sessions','bookings','messages','attempts','results']:conn.execute(f'DELETE FROM {table} WHERE user_id=?',(uid,))
  conn.execute('DELETE FROM users WHERE id=?',(uid,))
 conn.commit();conn.close()
 b.close()
