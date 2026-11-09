"""Run after online-check.py, against the same isolated local test server."""
from playwright.sync_api import sync_playwright
import os,pathlib,json
base=os.environ.get('MOTION_TEST_BASE_URL','http://localhost:3001')
suffix=os.environ['MOTION_TEST_SUFFIX'];assert base.startswith('http://localhost:')
root=pathlib.Path('docs/verification');root.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def login(role):
  page.goto(base+'/ru/account',wait_until='networkidle');page.locator('input[name=email]').fill(role+suffix+'@example.test');page.locator('input[name=password]').fill('Test-only-password-1234');page.locator('.form-card button').last.click();page.locator('.workspace').wait_for()
 login('student');page.goto(base+'/ru/booking',wait_until='networkidle');page.locator('.availability-picker').wait_for()
 assert page.locator('.calendar-grid button:disabled').count()>0
 page.locator('.time-grid button').first.click();assert page.locator('.selected-time').inner_text()
 assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
 page.screenshot(path=str(root/'online-calendar-mobile.png'),full_page=True)
 page.locator('input[name=consent]').check();page.get_by_role('button',name='Отправить заявку',exact=True).click();page.locator('.success-card').wait_for()
 page.goto(base+'/ru/account',wait_until='networkidle');page.locator('.booking-record').first.wait_for();assert '2026' in page.locator('.booking-record').first.inner_text()
 page.locator('.workspace-links button').last.click();login('operator')
 page.goto(base+'/ru/operator',wait_until='networkidle');page.locator('.workspace').wait_for();assert page.locator('.booking-record').count()>0
 page.locator('.workspace-nav').get_by_role('button',name='Расписание',exact=True).click();page.locator('.schedule-summary').wait_for();assert page.locator('input[name=start]').count()==1
 assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
 page.set_viewport_size({'width':1440,'height':1000});page.screenshot(path=str(root/'online-operator-desktop.png'),full_page=True)
 page.goto(base+'/ru',wait_until='networkidle');page.get_by_role('button',name='Консультант Motion Drive',exact=True).click();page.get_by_placeholder('Ваш вопрос…').fill('Где находится школа?');page.locator('.chat-input button').click();page.wait_for_function("document.querySelector('.chat-messages').textContent.includes('36/1')")
 assert page.locator('.chat-source').count()>0
 assert not errors,errors
 print('PASS: mobile available-day/time selection, booking submission, student date, operator schedule, responsive workspace, sourced chatbot; JavaScript errors=[]')
 browser.close()
