/* MODO TREINO • Avisos de atualizações públicas no GitHub. Nunca armazenar tokens do GitHub no cliente.
 * Regras de comparação em logic.js (testadas em tests/logic.test.mjs). */
(()=>{'use strict';
  const L=window.ModoLogic;
  const APP_VERSION='1.4.7', LAST_KEY='modo-treino-latest-seen', CACHE_HOURS=6;
  let apkInfo=null, settings=()=>({repo:'',enabled:false}), lastCheck=0, status='Configure um repositório público para receber avisos.', latest=null;
  const safeRepo=v=>/^[a-zA-Z0-9-]+\/[a-zA-Z0-9._-]+$/.test(String(v||''))?v:null;
  function updateScreen(){const el=document.getElementById('updateStatus');if(el)el.textContent=status;const dt=document.getElementById('dlTitle'),ds=document.getElementById('dlSub');if(dt&&apkInfo){dt.textContent='Baixe o app Android · '+apkInfo.tag;if(ds)ds.textContent='APK de teste · '+apkInfo.mb+' · instalação manual, sem conta'};let banner=document.getElementById('git-news-banner');if(!banner){banner=document.createElement('div');banner.id='git-news-banner';banner.className='git-news-banner';banner.setAttribute('role','status');const main=document.getElementById('main');main?.parentNode?.insertBefore(banner,main)}if(banner){banner.replaceChildren();if(latest){const strong=document.createElement('strong');strong.textContent=latest.title;const small=document.createElement('span');small.textContent=latest.desc;banner.append(strong,small);for(const [href,label] of [[latest.apk,'BAIXAR APK ↓'],[latest.url,'VER NO GITHUB ↗']]){if(!href)continue;const a=document.createElement('a');a.href=href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=label;banner.append(a)}banner.style.display='flex'}else banner.style.display='none'}}
  async function fetchGitHub(url){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8500);try{const r=await fetch(url,{headers:{Accept:'application/vnd.github+json'},cache:'no-store',signal:controller.signal});if(!r.ok)throw Error(r.status===404?'Repositório ainda não publicado, privado ou sem releases.':`GitHub HTTP ${r.status}`);return await r.json()}finally{clearTimeout(timer)}}
  async function check(force=false){const {repo,enabled}=settings();if(!enabled){status='Avisos de atualizações desativados.';latest=null;updateScreen();return}const r=safeRepo(repo);if(!r){status='Cadastre um repositório público em Ajustes.';updateScreen();return}if(!navigator.onLine){status='Sem internet. Verificação adiada.';updateScreen();return}if(!force&&Date.now()-lastCheck<CACHE_HOURS*3600000)return;lastCheck=Date.now();status='Consultando GitHub...';updateScreen();try{
    // A release é a única indicação de nova versão INSTALÁVEL; um commit só informa mudanças de código.
    let releases=null,commit=null;
    try{releases=await fetchGitHub(`https://api.github.com/repos/${r}/releases?per_page=30`)}catch{}
    try{commit=await fetchGitHub(`https://api.github.com/repos/${r}/commits/main`)}catch{}
    if(!releases&&!commit)throw Error('Repositório privado, inexistente, sem branch main ou acesso indisponível.');
    const up=L.evaluateUpdate(APP_VERSION,releases||[]);
    // maior release que tenha um APK anexado (mesmo que não seja mais nova que esta versão do site)
    const withApk=(Array.isArray(releases)?releases:[]).filter(x=>x&&!x.draft&&L.parseVersion(x.tag_name)&&L.apkAsset(x,r)).sort((p,q)=>L.compareVersions(q.tag_name,p.tag_name))[0];
    if(withApk){const f=L.apkAsset(withApk,r);apkInfo={tag:String(withApk.tag_name).replace(/^v/i,''),mb:f.size>0?(f.size/1048576).toFixed(1).replace('.',',')+' MB':'tamanho no download',url:f.url}}
    const commitSha=String(commit?.sha||'').slice(0,12), marker=`${r}|${up.tag}|${commitSha}`;
    const releaseUrl=up.release?L.safeGithubUrl(up.release.html_url,r):null;
    if(up.state==='newer'&&releaseUrl)latest={title:`MODO TREINO ${up.tag} DISPONÍVEL`,desc:'Há uma nova versão publicada. Baixe e instale manualmente; nada é instalado sozinho.',url:releaseUrl,apk:L.apkAsset(up.release,r)?.url||null};
    else if(commitSha&&localStorage.getItem(LAST_KEY)&&localStorage.getItem(LAST_KEY)!==marker&&L.safeGithubUrl(commit.html_url,r))latest={title:'NOVIDADES NO GITHUB',desc:'O projeto teve alterações de código. Isso não significa um APK novo.',url:L.safeGithubUrl(commit.html_url,r)};
    else latest=null;
    localStorage.setItem(LAST_KEY,marker);
    status=latest?latest.title:up.state==='none'?`Versão instalada ${APP_VERSION} · nenhuma release publicada ainda${commitSha?` · commit ${commitSha.slice(0,7)}`:''}`:`Tudo em dia · versão instalada ${APP_VERSION}${commitSha?` · commit ${commitSha.slice(0,7)}`:''}`;
  }catch(e){status='Não foi possível verificar: '+(e?.message||'erro de rede');latest=null}updateScreen()}
  window.ModoUpdates={version:APP_VERSION,apk:()=>apkInfo,init(fn){settings=fn;updateScreen();check();window.addEventListener('online',()=>check(true));document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});setInterval(()=>check(),CACHE_HOURS*3600000)},check,statusHtml(){return status}};
})();
