# Run after changing any page or asset: busts browser caches and makes open pages reload.
import re,json,time
V=str(int(time.time()))
for fn in ["index.html","texas.html","map.html","forecast.html","tv.html","recap.html"]:
    try:h=open(fn).read()
    except FileNotFoundError:continue
    h=re.sub(r'<meta name="build" content="[^"]*">','<meta name="build" content="%s">'%V,h)
    h=re.sub(r'assets/([a-z]+\.(?:css|js))(\?v=\d+)?',lambda m:"assets/"+m.group(1)+"?v="+V,h)
    open(fn,"w").write(h)
json.dump({"v":V},open("version.json","w"))
print(V)
