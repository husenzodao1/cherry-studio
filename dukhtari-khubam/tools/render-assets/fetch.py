import json, os, sys, urllib.request
opener = urllib.request.build_opener()
opener.addheaders = [('User-Agent', 'Mozilla/5.0 (X11; Linux x86_64) asset-fetch')]
urllib.request.install_opener(opener)
ids = sys.argv[1].split(',')
res = sys.argv[2]
for aid in ids:
    files = json.load(urllib.request.urlopen(f'https://api.polyhaven.com/files/{aid}'))
    info = json.load(urllib.request.urlopen(f'https://api.polyhaven.com/info/{aid}'))
    g = files['gltf'].get(res) or files['gltf'][sorted(files['gltf'])[0]]
    g = g['gltf']
    d = os.path.join('models', aid)
    os.makedirs(d, exist_ok=True)
    urllib.request.urlretrieve(g['url'], os.path.join(d, 'model.gltf'))
    for rel, inc in g['include'].items():
        p = os.path.join(d, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        urllib.request.urlretrieve(inc['url'], p)
    # glTF references the original file name; rename model to match relative paths
    json.dump({'id': aid, 'name': info.get('name'), 'authors': info.get('authors'), 'license': 'CC0 1.0',
               'source': f'https://polyhaven.com/a/{aid}', 'resolution': res}, open(os.path.join(d, 'provenance.json'), 'w'), ensure_ascii=False)
    print(aid, 'ok', sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(d) for f in fs) // 1024, 'KB', info.get('authors'))
