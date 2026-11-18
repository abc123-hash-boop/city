"""Bundle the built game, models' thumbnails, UI and font into one offline HTML."""
from pathlib import Path
import base64,json,re
root=Path(__file__).resolve().parents[1];dist=root/'dist';assets=dist/'assets'
def uri(p,kind):return 'data:'+kind+';base64,'+base64.b64encode(p.read_bytes()).decode()
css=next(assets.glob('*.css')).read_text();css=re.sub(r'url\((?:["\']?)/fonts/Manrope-SemiBold.ttf(?:["\']?)\)',lambda _:f'url("{uri(root/"public/fonts/Manrope-SemiBold.ttf","font/ttf")}")',css)
js=next(assets.glob('index-*.js')).read_text().replace('</script','<\\/script')
imgs={p.stem:uri(p,'image/png') for p in (root/'public/buildings').glob('*.png')};ic=uri(root/'public/mark.svg','image/svg+xml');lic=(root/'licenses/three-MIT.txt').read_text()+'\n'+(root/'public/fonts/OFL.txt').read_text()
html=f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#1d322d"><title>汀湾工坊 · Tidebay Atelier</title><link rel="icon" href="{ic}"><style>{css}</style></head><body><div id="app"></div><script>globalThis.ATELIER_OFFLINE=true;globalThis.ATELIER_IMAGES={json.dumps(imgs,separators=(',',':'))};</script><script type="module">{js}</script><!-- Third-party notices:\n{lic.replace('--','—')}\n--></body></html>'''
out=root/'Tidebay-Atelier.html';out.write_text(html);print(f'{out.name}: {out.stat().st_size:,} bytes, all game assets embedded.')
