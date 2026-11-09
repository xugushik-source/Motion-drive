import time,uuid,json,sqlite3,hashlib,secrets,pathlib,urllib.request,urllib.error,http.cookiejar
class Response:
 def __init__(self,r):self.status_code=r.status;self.text=r.read().decode()
 def json(self):return json.loads(self.text)
class Session:
 def __init__(self):self.headers={};self.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
 def get(self,url):return self.request(url)
 def post(self,url,json):return self.request(url,json)
 def request(self,url,body=None):
  req=urllib.request.Request(url,data=json.dumps(body).encode() if body is not None else None,headers={**self.headers,**({'Content-Type':'application/json'} if body is not None else {})})
  try:return Response(self.opener.open(req))
  except urllib.error.HTTPError as e:return Response(e)
class requests:Session=Session
base='http://localhost:3000'; origin={'Origin':base};suffix=str(time.time_ns())
def session():
 s=requests.Session();s.headers.update(origin);return s
def post(s,path,body,status=200):
 r=s.post(base+'/api/'+path,json=body);assert r.status_code==status,(path,r.status_code,r.text[:500]);return r.json()
admin=session();student=session();other=session();teacher=session();teacher2=session()
# Test identities only; cleanup by prefix after test. Never create a shared production password.
password=secrets.token_urlsafe(24)
for i,s in enumerate([admin,student,other,teacher,teacher2]):post(s,'auth/register',{'name':'API check '+str(i),'email':f'check-{suffix}-{i}@example.test','password':password,'locale':'en'})
conn=sqlite3.connect('data/motion-drive.sqlite');conn.execute("UPDATE users SET role='admin' WHERE email=?",(f'check-{suffix}-0@example.test',));conn.execute("UPDATE users SET role='instructor' WHERE email IN (?,?)",(f'check-{suffix}-3@example.test',f'check-{suffix}-4@example.test'));conn.commit()
ids=[s.get(base+'/api/me').json()['user']['id'] for s in [admin,student,other,teacher,teacher2]]
post(student,'admin/record',{'kind':'courses','data':{'title':'forbidden'}},403)
post(student,'slot/create',{},403)
post(session(),'booking/create',{},401)
print('role and anonymous access checks passed',flush=True)
# No slots -> request remains pending. Other student cannot cancel it.
b={'city':'akhalkalaki','program':'theory','gearbox':'none','name':'API Check','contact':'test@example.test','consent':True}
r=post(student,'booking/create',b);post(other,'booking/status',{'id':r['id'],'status':'cancelled'},403);post(admin,'booking/status',{'id':r['id'],'status':'confirmed'},400)
assert len(other.get(base+'/api/dashboard').json()['bookings'])==0
print('booking ownership and no fabricated confirmation passed',flush=True)
start=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime(time.time()+86400));end=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime(time.time()+90000))
slot=post(teacher,'slot/create',{'instructor_id':ids[3],'city':'akhalkalaki','start':start,'end':end})
post(teacher,'slot/create',{'instructor_id':ids[3],'city':'akhalkalaki','start':start,'end':end},409)
post(teacher2,'slot/availability',{'id':slot['id'],'available':False},403)
first=post(student,'booking/create',{**b,'slot_id':slot['id']});post(other,'booking/create',{**b,'slot_id':slot['id']},409)
assert len(teacher2.get(base+'/api/dashboard').json()['bookings'])==0
post(student,'booking/status',{'id':first['id'],'status':'cancelled'});second=post(other,'booking/create',{**b,'slot_id':slot['id']});post(admin,'booking/status',{'id':second['id'],'status':'confirmed'})
print('slot overlap, double booking, release, instructor isolation passed',flush=True)
post(student,'exam/start',{'locale':'en'},400)
question={'question':'Test fixture: select option A','options':['A','B'],'correct':0,'explanation':'Test fixture explanation, not a Georgian exam question','topic':'TEST ONLY','locale':'en','source':'https://www.sa.gov.ge/','verified':True,'status':'published','verifiedAt':'2026-11-09'}
qid=post(admin,'admin/record',{'kind':'questions','data':question})['id'];attempt=post(student,'exam/start',{'locale':'en'});assert 'correct' not in attempt['questions'][0];result=post(student,'exam/submit',{'id':attempt['id'],'answers':{qid:0}});assert result['score']==1;post(student,'exam/submit',{'id':attempt['id'],'answers':{qid:0}},400)
post(admin,'admin/delete',{'kind':'questions','id':qid});print('exam no-bank fallback, answer secrecy, scoring, replay prevention passed',flush=True)
faq={'question':'Test fixture hours?','answer':'Owner will confirm.','category':'test','locale':'en','source':'test fixture','verifiedAt':'2026-11-09','responsible':'test','status':'published'}
fid=post(admin,'admin/record',{'kind':'knowledge','data':faq})['id'];res=post(student,'chat',{'message':faq['question'],'locale':'en'});assert res['mode']=='faq';res=post(student,'chat',{'message':'An unknown question','locale':'en'});assert res['mode']=='fallback';post(admin,'admin/reply',{'id':res['id'],'answer':'Administrator test response'});history=student.get(base+'/api/chat/history').json();assert any(m['admin_reply']=='Administrator test response' for m in history);assert other.get(base+'/api/chat/history').json()==[];post(admin,'admin/delete',{'kind':'knowledge','id':fid})
res=post(admin,'admin/import',{'text':'hello user@example.com\nhello user@example.com','consent':True});assert res['groups'][0]['count']==2 and '@' not in res['groups'][0]['question'];post(admin,'admin/delete',{'kind':'imports','id':res['id']});print('approved FAQ, no-key fallback, anonymized import passed',flush=True)
# Test unsupported origin and persistent data on another connection.
s=requests.Session();s.headers['Origin']='https://untrusted.invalid';post(s,'auth/login',{'email':'x@example.test','password':'x'},403)
assert conn.execute('SELECT count(*) FROM bookings WHERE user_id=?',(ids[1],)).fetchone()[0]==2
report={'passed':['RBAC','anonymous restriction','booking ownership','unscheduled request','slot overlap','double booking','slot release','instructor isolation','exam engine','FAQ fallback','import masking','CSRF origin','SQLite persistence','administrator chat reply','chat history isolation'],'paid_api_calls':0}
pathlib.Path('docs/verification/api-report.json').write_text(json.dumps(report,indent=2))
# Remove all test fixtures and identities, keeping proof reports.
for uid in ids:
 for table,col in [('sessions','user_id'),('bookings','user_id'),('results','user_id'),('attempts','user_id'),('messages','user_id'),('slots','instructor_id')]:conn.execute(f'DELETE FROM {table} WHERE {col}=?',(uid,))
 conn.execute('DELETE FROM users WHERE id=?',(uid,))
conn.commit();conn.close();print('API verification complete, test identities removed',flush=True)
