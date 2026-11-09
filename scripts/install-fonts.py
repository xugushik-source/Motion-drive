import re,subprocess,pathlib
root=pathlib.Path('/workspace/motion-drive');css=(root/'docs/fonts-source.css').read_text();urls=list(dict.fromkeys(re.findall(r'url\((https://[^)]+)\)',css)))
for i,url in enumerate(urls):
 name=f'font-{i}.ttf';subprocess.run(['curl','-sSfL','--max-time','30',url,'-o',str(root/'public/fonts'/name)],check=True);css=css.replace(url,'/fonts/'+name)
(root/'public/fonts/fonts.css').write_text(css)
print('Self-hosted fonts:',len(urls))
