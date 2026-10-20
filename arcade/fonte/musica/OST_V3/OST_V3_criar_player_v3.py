import base64,json,html,pathlib
BASE=pathlib.Path(__file__).resolve().parent
V2=BASE.parent/'Josperd_Jump_OST_V2'
rows=json.loads((BASE/'relatorio_analise.json').read_text())
trackdata=[]
for r in rows:
    a=BASE/r['files']['mp3'];o=V2/r['character']/(r['id']+'.mp3')
    assert a.exists() and o.exists()
    trackdata.append(dict(id=r['id'],title=r['title'].replace(' — Harmony Edition',''),who=r['character'],bpm=r['bpm'],duration=r['seconds'],old=f'data:audio/mpeg;base64,{base64.b64encode(o.read_bytes()).decode()}',new=f'data:audio/mpeg;base64,{base64.b64encode(a.read_bytes()).decode()}',before=r['pre_revision']['accented_non_chord_tones'],after=r['post_revision']['accented_non_chord_tones']))
css='''
:root {color-scheme:dark;--bg:#0b0c1c;--ink:#f8f6ff;--sub:#b9accd;--pink:#ef59d3;--purple:#ad79ff;--sun:#fcb64d}*{box-sizing:border-box}
body {margin:0;font-family:system-ui,Arial,sans-serif;background:radial-gradient(circle at 15% 6%,#442160 0,transparent 28%),radial-gradient(circle at 90% 15%,#153758 0,transparent 30%),var(--bg);min-height:100vh;color:var(--ink)}
.app{width:min(650px,calc(100% - 24px));margin:18px auto 42px; }header{display:flex;align-items:center;gap:10px;padding:10px 4px 22px}.mini{background:#f73ec1;border:3px solid #190f31;border-radius:9px;box-shadow:3px 3px #7e2b93;font-weight:900;padding:7px 10px}.eyebrow{letter-spacing:.22em;font-size:10px;font-weight:900;color:#edc7fb}.brand{font-size:24px;font-weight:1000;letter-spacing:-.04em}.brand span{color:#ff73d8}.tag{font-size:11px;color:#baaeca}.panel{background:linear-gradient(145deg,#211635,#161829);border:1px solid #644377;border-radius:24px;padding:20px;box-shadow:0 20px 60px #03020e90}.desc{font-size:12px;line-height:1.55;color:var(--sub)}h2{margin:8px 0 14px;font-size:clamp(21px,5vw,29px)}.tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#0c1021;border-radius:14px;padding:5px;margin-bottom:14px}button{font:inherit;cursor:pointer;color:inherit}.tabs button,.versions button{background:transparent;border:1px solid transparent;border-radius:10px;padding:12px 6px;font-weight:800;font-size:13px}.tabs button.active,.versions button.active{background:linear-gradient(140deg,#9134bb,#cf3b99);border-color:#ea80cb}.tabs.camila button.active{background:linear-gradient(140deg,#b75627,#de9c3a);border-color:#ffd080}.versions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}.versions button{background:#121127;border-color:#47405f}.versions button.active{background:#3a2951;border-color:#eb8fd9}.cover{height:158px;background:radial-gradient(circle at center,#652e82 2%,#262041 50%,#171425 80%);border:1px solid #82478a;border-radius:15px;display:grid;place-items:center;position:relative;overflow:hidden}.cover.camila{background:radial-gradient(circle at center,#96612a 2%,#49304c 50%,#171425 80%);border-color:#cd8f52}.disc{width:130px;height:130px;border:7px solid #080b15;border-radius:50%;background:repeating-radial-gradient(circle,#292039 0 5px,#131222 6px 10px);box-shadow:0 0 0 4px #e44dc3,0 0 40px #b033ab70;display:grid;place-items:center;animation:spin 5s linear infinite;animation-play-state:paused}.disc.playing{animation-play-state:running}.disc:after{content:'♫';font-size:34px;background:#ff59b9;border:7px solid #101120;border-radius:50%;height:70px;width:70px;display:grid;place-items:center;font-weight:900;color:#111022}.cover.camila .disc{box-shadow:0 0 0 4px #ffbe66,0 0 40px #ffa04755}.cover.camila .disc:after{background:#ffbf65}@keyframes spin{to{transform:rotate(360deg)}}.bars{display:flex;align-items:center;justify-content:center;gap:4px;margin:12px;height:21px}.bars b{width:4px;background:#fb64df;border-radius:4px;animation:bounce .6s alternate infinite;animation-play-state:paused}.bars.playing b{animation-play-state:running}.bars b:nth-child(2n){animation-delay:.16s;background:#fcb954}.bars b:nth-child(3n){animation-delay:.28s;background:#a888ff}@keyframes bounce{from{height:5px}to{height:20px}}.np{display:flex;justify-content:space-between;align-items:baseline;gap:10px}.songname{font-size:22px;font-weight:900;letter-spacing:-.03em}.meta{color:var(--sub);font-size:12px;white-space:nowrap}.progress{width:100%;accent-color:#ff6cce;cursor:pointer}.time{display:flex;justify-content:space-between;color:var(--sub);font-size:11px;font-variant-numeric:tabular-nums}.controls{display:flex;gap:12px;justify-content:center;align-items:center;margin:14px 0 4px}.control{border:1px solid #605275;background:#31233f;border-radius:15px;min-width:52px;height:50px;font-size:20px}.play{width:65px;height:58px;background:linear-gradient(145deg,#ff6ad4,#e43c94);color:#0f0c1e;border:0;border-radius:17px;font-size:25px;font-weight:900;box-shadow:0 5px #a7267a}.small{display:flex;gap:12px;align-items:center;margin:12px 0;color:var(--sub);font-size:12px}.small input{width:100%;accent-color:#ff7cba}.playlist{display:grid;gap:9px;margin-top:18px}.track{width:100%;text-align:left;background:#141222;border:1px solid #59455b;border-radius:13px;padding:12px 13px;display:flex;gap:10px;align-items:center}.track.active{background:#38243d;border-color:#ee6bc5}.track .number{color:#ef8edd;font-weight:900;width:20px}.track .tname{font-weight:900}.track .tmeta{font-size:11px;color:#bbb0c5;margin-top:3px}.track .right{margin-left:auto;font-size:11px;color:#a9f7d0;white-space:nowrap}.foot{font-size:11px;text-align:center;margin:18px auto;color:#9287a9;line-height:1.6}.check{display:flex;align-items:center;gap:8px;font-size:12px;color:#baaccb}.check input{accent-color:#eb55a8}
@media(max-width:390px){.panel{padding:14px}.songname{font-size:19px}.meta{font-size:11px}.track .right{font-size:10px}}
'''
js='''
const SONGS=__SONGS__;
const audio=document.getElementById('audio');
const whoBtns=document.querySelectorAll('[data-who]');const versionBtns=document.querySelectorAll('[data-version]');
const el=id=>document.getElementById(id);
let who='Josperd',version='new',track=0,wasPlaying=false,history=[];
const active=()=>SONGS.filter(s=>s.who===who);
const mm=t=>Number.isFinite(t)?`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`:'0:00';
function loadTrack(index, autoplay=false){
 let songs=active();track=(index+songs.length)%songs.length;let s=songs[track];
 audio.src=s[version];audio.load();el('name').textContent=s.title;el('bpm').textContent=s.bpm+' BPM';el('length').textContent=mm(s.duration);el('elapsed').textContent='0:00';el('progress').value=0;
 history.push(track);if(history.length>8)history.shift();
 el('list').innerHTML=songs.map((item,i)=>`<button class="track ${i===track?'active':''}" data-track="${i}"><span class="number">0${i+1}</span><span><div class="tname">${item.title}</div><div class="tmeta">${item.bpm} BPM · ${mm(item.duration)}</div></span><span class="right">${item.before} → ${item.after}</span></button>`).join('');
 document.querySelectorAll('[data-track]').forEach(x=>x.onclick=()=>loadTrack(+x.dataset.track,true));
 el('album').classList.toggle('camila',who==='Camila');el('selector').classList.toggle('camila',who==='Camila');
 if(autoplay)audio.play().catch(()=>{});else setPlaying(false)
}
function setPlaying(p){el('play').textContent=p?'Ⅱ':'▶';el('disc').classList.toggle('playing',p);el('equal').classList.toggle('playing',p);el('play').setAttribute('aria-label',p?'Pausar':'Reproduzir')}
audio.addEventListener('play',()=>setPlaying(true));audio.addEventListener('pause',()=>setPlaying(false));
audio.addEventListener('timeupdate',()=>{el('elapsed').textContent=mm(audio.currentTime);el('progress').value=audio.duration?100*audio.currentTime/audio.duration:0});
audio.addEventListener('ended',()=>{
 if(el('auto').checked){let opts=[0,1,2].filter(i=>i!==track);loadTrack(opts[Math.floor(Math.random()*opts.length)],true)}else{audio.currentTime=0;audio.play().catch(()=>{})}
});
el('play').onclick=()=>audio.paused?audio.play().catch(()=>{}):audio.pause();
el('next').onclick=()=>loadTrack(track+1,true);el('prev').onclick=()=>{if(audio.currentTime>3){audio.currentTime=0}else loadTrack(track-1,true)};
el('progress').oninput=e=>{if(audio.duration)audio.currentTime=audio.duration*(+e.target.value)/100};
el('volume').oninput=e=>audio.volume=+e.target.value/100;
whoBtns.forEach(x=>x.onclick=()=>{who=x.dataset.who;whoBtns.forEach(y=>y.classList.toggle('active',y===x));loadTrack(0,false)});
versionBtns.forEach(x=>x.onclick=()=>{let time=audio.currentTime;let playing=!audio.paused;version=x.dataset.version;versionBtns.forEach(y=>y.classList.toggle('active',y===x));loadTrack(track,false);audio.addEventListener('loadedmetadata',function restore(){audio.removeEventListener('loadedmetadata',restore);audio.currentTime=Math.min(time,Math.max(0,audio.duration-.2));if(playing)audio.play().catch(()=>{})})});
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','BUTTON'].includes(document.activeElement.tagName)){e.preventDefault();el('play').click()}});
loadTrack(0,false);
'''
page='''<!doctype html><html lang="pt-br"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#0b0c1c"><title>Josperd Jump • OST V3 Harmony Edition</title><style>__CSS__</style></head><body>
<div class="app"><header><div class="mini">JJ</div><div><div class="eyebrow">MODO TREINO · ORIGINAL SOUNDTRACK</div><div class="brand">JOSPERD <span>JUMP</span></div><div class="tag">OST V3 • HARMONY EDITION</div></div></header>
<div class="panel"><div class="eyebrow">SELECIONE SEU PERSONAGEM</div><h2>Uma trilha para cada aventura.</h2>
<div class="tabs" id="selector"><button class="active" data-who="Josperd">💜 JOSPERD</button><button data-who="Camila">🧡 CAMILA</button></div>
<div class="cover" id="album"><div class="disc" id="disc"></div></div><div class="bars" id="equal">''' + ''.join('<b style="animation-duration: '+str(.42+(i%4)*.08)+'s"></b>' for i in range(32)) + '''</div>
<div class="eyebrow">AGORA TOCANDO</div><div class="np"><div class="songname" id="name">—</div><div class="meta" id="bpm">—</div></div>
<input class="progress" type="range" min="0" max="100" step=".1" value="0" id="progress" aria-label="Progresso da faixa"><div class="time"><span id="elapsed">0:00</span><span id="length">0:00</span></div>
<div class="controls"><button class="control" id="prev" aria-label="Anterior">⏮</button><button class="play" id="play" aria-label="Reproduzir">▶</button><button class="control" id="next" aria-label="Próxima">⏭</button></div>
<div class="small"><span>🔉</span><input type="range" id="volume" min="0" max="100" value="80" aria-label="Volume"><span>🔊</span></div>
<div class="versions"><button class="active" data-version="new">✨ Nova V3</button><button data-version="old">↩ Versão V2</button></div>
<label class="check"><input id="auto" type="checkbox" checked> Ao terminar, mudar para outra música sem repetir a mesma</label>
<p class="desc">Compare V2 e V3 na mesma faixa. A revisão trabalha as relações entre melodia e acordes, a condução das notas e o encaixe rítmico dos instrumentos. Algumas tensões jazzísticas continuam de propósito.</p>
<div class="eyebrow">PLAYLIST · 3 FAIXAS</div><div id="list" class="playlist"></div><div class="foot">Os áudios estão incorporados ao arquivo. Funciona offline no navegador, sem instalar apps.<br>Os indicadores da lista representam notas de destaque fora do acorde (antes → depois), não uma nota artística.</div></div></div>
<audio id="audio" preload="metadata"></audio><script>__JS__</script></body></html>'''
page=page.replace('__CSS__',css).replace('__JS__',js.replace('__SONGS__',json.dumps(trackdata,ensure_ascii=False)))
out=BASE.parent/'Josperd_Jump_OST_V3_PLAYER_COMPARATIVO.html'
out.write_text(page,encoding='utf-8')
print(out,out.stat().st_size)
