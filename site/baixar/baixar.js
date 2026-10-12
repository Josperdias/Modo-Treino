/* Página de download: consulta a última release pública e preenche o botão do APK.
 * Dados vindos da API entram SOMENTE via textContent/href validado — nunca innerHTML. */
(()=>{'use strict';
  const REPO='Josperdias/Modo-Treino', L=window.ModoLogic;
  const $=id=>document.getElementById(id);
  const status=(text,warn)=>{const el=$('apk-status');el.textContent=text;el.className='status'+(warn?' warn':'');el.hidden=!text};
  const fmtSize=b=>b>=1048576?(b/1048576).toFixed(1).replace('.',',')+' MB':b>0?Math.round(b/1024)+' KB':'—';
  async function load(){
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),9000);
    try{
      const r=await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`,{headers:{Accept:'application/vnd.github+json'},signal:ctl.signal});
      if(!r.ok)throw Error('http '+r.status);
      const releases=await r.json();
      // percorre da mais nova para a mais antiga até achar uma com APK anexado
      const sorted=(Array.isArray(releases)?releases:[]).filter(x=>x&&!x.draft&&L.parseVersion(x.tag_name)).sort((a,b)=>L.compareVersions(b.tag_name,a.tag_name));
      for(const rel of sorted){
        const apk=L.apkAsset(rel,REPO);
        if(!apk)continue;
        const sha=apk.sha256||((/sha-?256[^0-9a-f]{0,12}([0-9a-f]{64})/i.exec(String(rel.body||''))||[])[1]||'').toLowerCase()||null;
        $('f-version').textContent=String(rel.tag_name).replace(/^v/i,'')+(rel.prerelease?' (teste)':'');
        const d=new Date(rel.published_at);$('f-date').textContent=isNaN(d)?'—':d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'});
        $('f-size').textContent=fmtSize(apk.size);
        $('apk-facts').hidden=false;
        if(sha){$('f-sha').textContent=sha;$('apk-sha').hidden=false}
        const link=$('apk-link');link.href=apk.url;link.hidden=false;link.setAttribute('download',apk.name);
        link.textContent='BAIXAR APK '+String(rel.tag_name).replace(/^v/i,'')+' ↓';
        status('');
        return;
      }
      status('Ainda não há um APK publicado. Assim que a primeira versão sair, o botão de download aparece aqui. Enquanto isso, instale o site como aplicativo.',true);
    }catch(e){
      status('Não consegui consultar o GitHub agora (sem internet ou limite de consultas). Use o link “Todas as versões” abaixo.',true);
    }finally{clearTimeout(timer)}
  }
  load();
  // Instalação do PWA (Chrome/Edge/Android). Em navegadores sem o evento, ficam as instruções manuais.
  let deferred=null;
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;$('pwa-install').hidden=false});
  $('pwa-install').addEventListener('click',async()=>{if(!deferred)return;deferred.prompt();try{await deferred.userChoice}catch{}deferred=null;$('pwa-install').hidden=true});
  window.addEventListener('appinstalled',()=>{$('pwa-install').hidden=true});
  if('serviceWorker'in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))navigator.serviceWorker.register('../sw.js',{scope:'../'}).catch(()=>{});
})();
