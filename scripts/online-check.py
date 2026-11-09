"""Integration checks, ONLY against an isolated local SQLite test server."""
import os,sqlite3,time,concurrent.futures,datetime,json,urllib.request,urllib.error,http.cookiejar
class Response:
 def __init__(self,r):self.status_code=r.code;self.text=r.read().decode()
 def json(self):return json.loads(self.text)
 def raise_for_status(self):assert self.status_code<400,self.text
class Session:
 def __init__(self):self.headers={};self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
 def request(self,url,body=None,headers=None):
  request=urllib.request.Request(url,data=None if body is None else json.dumps(body).encode(),headers={**self.headers,**({'Content-Type':'application/json'} if body is not None else {}),**(headers or {})})
  try:return Response(self.opener.open(request))
  except urllib.error.HTTPError as e:return Response(e)
 def get(self,url):return self.request(url)
 def post(self,url,json=None,headers=None):return self.request(url,json,headers)
class requests:
 Session=Session
base=os.environ.get('MOTION_TEST_BASE_URL','http://localhost:3001')
path=os.environ.get('MOTION_TEST_DB','/tmp/motion-online-e2e.sqlite')
assert base.startswith(('http://localhost:','http://127.0.0.1:')) and path.startswith('/tmp/'), 'Use isolated local test database only'
def session():
 s=requests.Session();s.headers['Origin']=base;s.get(base+'/api/me').raise_for_status();return s
def post(s,path,body,status=200):
 r=s.post(base+'/api/'+path,json=body);assert r.status_code==status,(path,r.status_code,r.text[:250]);return r.json()
suffix=str(time.time_ns()); people={}
for role in ['admin','operator','instructor','student','other']:
 s=session();u=post(s,'auth/register',{'email':role+suffix+'@example.test','password':'Test-only-password-1234','name':role.title(),'locale':'ru','role':'admin'})['user'];assert u['role']=='student';people[role]=(s,u)
with sqlite3.connect(path) as db:
 for role in ['admin','operator','instructor']:db.execute('UPDATE users SET role=? WHERE id=?',(role,people[role][1]['id']))
admin,operator,instructor,student,other=[people[r][0] for r in people]
post(student,'slot/create',{},403);post(operator,'admin/role',{'id':people['student'][1]['id'],'role':'operator'},403)
start=(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(days=3)).replace(hour=6,minute=0,second=0,microsecond=0)
iso=lambda d:d.isoformat(timespec='milliseconds').replace('+00:00','Z')
period={'instructor_id':None,'city':'akhalkalaki','start':iso(start),'end':iso(start+datetime.timedelta(hours=3)),'intervalMinutes':60}
ids=post(operator,'slot/create',period)['ids'];assert len(ids)==3
post(operator,'slot/create',period,409)
assert len(student.get(base+'/api/slots').json())==3
booking={'city':'akhalkalaki','program':'practice','gearbox':'none','name':'Test Student','contact':'test@example.test','consent':True,'note':'isolated E2E check'}
post(student,'booking/create',booking,400)
def reserve(s):return s.post(base+'/api/booking/create',json={**booking,'slot_id':ids[0]})
with concurrent.futures.ThreadPoolExecutor() as pool: responses=list(pool.map(reserve,[student,other]))
assert sorted(r.status_code for r in responses)==[200,409],[r.text for r in responses]
winner=student if responses[0].status_code==200 else other;loser=other if winner is student else student
bid=next(r.json()['id'] for r in responses if r.status_code==200)
assert len(student.get(base+'/api/slots').json())==2
post(loser,'booking/status',{'id':bid,'status':'cancelled'},403)
post(operator,'slot/availability',{'id':ids[0],'available':False},409)
post(operator,'booking/status',{'id':bid,'status':'confirmed'})
assert winner.get(base+'/api/dashboard').json()['bookings'][0]['slot_start']==iso(start)
post(winner,'booking/reschedule',{'id':bid,'slot_id':ids[1]})
assert any(s['id']==ids[0] for s in student.get(base+'/api/slots').json())
post(operator,'booking/status',{'id':bid,'status':'cancelled'})
assert len(student.get(base+'/api/slots').json())==3
post(operator,'slot/availability',{'id':ids[2],'available':False})
assert len(student.get(base+'/api/slots').json())==2
post(operator,'slot/availability',{'id':ids[2],'available':True})
known=post(student,'chat',{'message':'Где находится школа?','locale':'ru'});assert known['mode']=='faq' and '36/1' in known['answer']
unknown=post(student,'chat',{'message':'Неизвестный индивидуальный вопрос qzx123','locale':'ru'});assert unknown['mode']=='fallback'
post(operator,'admin/reply',{'id':unknown['id'],'answer':'Проверочный ответ оператора'})
assert any(m['admin_reply']=='Проверочный ответ оператора' for m in student.get(base+'/api/chat/history').json())
assert other.get(base+'/api/chat/history').json()==[]
post(student,'admin/record',{'kind':'faq'},403)
assert student.post(base+'/api/booking/create',json={**booking,'slot_id':ids[0]},headers={'Origin':'https://wrong.example'}).status_code==403
print('PASS: registration role isolation; operator permissions; batch calendar; overlap; concurrent booking 1 winner; slot release; reschedule; operator confirmation; booked-slot closure protection; date rendering; FAQ; handoff and reply isolation; CSRF')
# Leave only isolated fixture data for browser checks; no production accounts touched.
print(json.dumps({'base':base,'suffix':suffix,'operatorEmail':'operator'+suffix+'@example.test','studentEmail':'student'+suffix+'@example.test','day':iso(start)[:10]}))
