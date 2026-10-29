# Run after changing index.html or assets/: busts browser caches and makes open pages reload.
import re,json,time
V=str(int(time.time()))
h=open("index.html").read()
h=re.sub(r'<meta name="build" content="[^"]*">','<meta name="build" content="%s">'%V,h)
h=re.sub(r'assets/(styles\.css|app\.js)(\?v=\d+)?',lambda m:"assets/"+m.group(1)+"?v="+V,h)
open("index.html","w").write(h);json.dump({"v":V},open("version.json","w"))
print(V)
