/* MODO TREINO • Avisos de atualizações públicas no GitHub. Nunca armazenar tokens do GitHub no cliente. */
(()=>{'use strict';
  const APP_VERSION='1.0.1', LAST_KEY='modo-treino-latest-seen', CACHE_HOURS=6;
  let settings=()=>({repo:'',enabled:false}), lastCheck=0, status='Configure um repositório público para receber avisos.', latest=null;
  const safeRepo=v=>/^[a-zA-Z0-9-]+\/[a-zA-Z0-9._-]+$/.test(String(v||''))?v:null;
  const safeUrl=u=>{try{const v=new URL(u);return v.protocol==='https:'&&v.hostname==='github.com'?v.toString():null}catch{return null}};
  function updateScreen(){const el=document.getElementById('updateStatus');if(el)el.textContent=status;let banner=document.getElementById('git-news-banner');if(!banner){banner=document.createElement('div');banner.id='git-news-banner';banner.className='git-news-banner';const main=document.getElementById('main');main?.parentNode?.insertBefore(banner,main)}if(banner){banner.replaceChildren();if(latest){const strong=document.createElement('strong');strong.textContent=latest.title;const small=document.createElement('span');small.textContent=latest.desc;banner.append(strong,small);if(latest.url){const a=document.createElement('a');a.href=latest.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='VER NO GITHUB ↗';banner.append(a)}banner.style.display='flex'}else banner.style.display='none'}}
  async function fetchGitHub(url){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8500);try{const r=await fetch(url,{headers:{Accept:'application/vnd.github+json'},cache:'no-store',signal:controller.signal});if(!r.ok)throw Error(r.status===404?'Repositório ainda não publicado, privado ou sem releases.':`GitHub HTTP ${r.status}`);return await r.json()}finally{clearTimeout(timer)}}
  async function check(force=false){const {repo,enabled}=settings();if(!enabled){status='Avisos de atualizações desativados.';latest=null;updateScreen();return}const r=safeRepo(repo);if(!r){status='Cadastre um repositório público em Ajustes.';updateScreen();return}if(!navigator.onLine){status='Sem internet. Verificação adiada.';updateScreen();return}if(!force&&Date.now()-lastCheck<CACHE_HOURS*3600000)return;lastCheck=Date.now();status='Consultando GitHub...';updateScreen();try{
    // A release é a única indicação de nova versão INSTALÁVEL; um commit só informa mudanças de código.
    let release=null,commit=null;
    try{release=(await fetchGitHub(`https://api.github.com/repos/${r}/releases?per_page=5`)).find(v=>!v.draft)}catch{}
    try{commit=await fetchGitHub(`https://api.github.com/repos/${r}/commits/main`)}catch{}
    if(!release&&!commit)throw Error('Repositório privado, inexistente, sem branch main ou acesso indisponível.');
    const tag=String(release?.tag_name||'').replace(/^v/i,'');
    const newer=tag&&/^\d+\.\d+\.\d+/.test(tag)&&tag.split(/[.-]/).slice(0,3).some((n,i)=>Number(n)>Number(APP_VERSION.split('.')[i]||0)&&tag.split(/[.-]/).slice(0,i).every((v,j)=>Number(v)===Number(APP_VERSION.split('.')[j]||0)));
    const commitSha=String(commit?.sha||'').slice(0,12), marker=`${r}|${tag}|${commitSha}`;
    if(newer&&safeUrl(release.html_url))latest={title:`MODO TREINO ${tag} DISPONÍVEL`,desc:'Há uma nova versão publicada. Abra a página para instalar manualmente.',url:safeUrl(release.html_url)};
    else if(commitSha&&localStorage.getItem(LAST_KEY)&&localStorage.getItem(LAST_KEY)!==marker)latest={title:'NOVIDADES NO GITHUB',desc:'O projeto teve alterações de código. Isso não significa um APK novo.',url:safeUrl(commit.html_url)};
    else latest=null;
    localStorage.setItem(LAST_KEY,marker);
    status=latest?latest.title:`Tudo em dia · versão instalada ${APP_VERSION}${commitSha?` · commit ${commitSha.slice(0,7)}`:''}`;
  }catch(e){status='Não foi possível verificar: '+(e?.message||'erro de rede');latest=null}updateScreen()}
  window.ModoUpdates={init(fn){settings=fn;updateScreen();check();window.addEventListener('online',()=>check(true));document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});setInterval(()=>check(),CACHE_HOURS*3600000)},check,statusHtml(){return status}};
})();
