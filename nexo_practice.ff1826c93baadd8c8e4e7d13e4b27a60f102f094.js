/* Free device capabilities. No NEXO API token or paid transcription is used. */
(() => {
  'use strict';
  let audio = null, audioUrl = null, recognition = null;
  const reminders = new Map();
  window.nexoDeviceStopAudio = () => {
    if (audio) { audio.pause(); audio.src = ''; audio = null; }
    if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = null; }
  };
  window.nexoDeviceAudio = async (bytes) => {
    window.nexoDeviceStopAudio();
    audioUrl = URL.createObjectURL(new Blob([bytes], {type:'audio/mpeg'}));
    audio = new Audio(audioUrl);
    audio.addEventListener('ended',window.nexoDeviceStopAudio,{once:true});
    try { await audio.play(); return true; } catch (_) { window.nexoDeviceStopAudio(); return false; }
  };
  window.nexoDeviceRecognize = (language) => new Promise((resolve,reject) => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { reject(new Error('Reconhecimento de fala indisponível neste navegador.')); return; }
    if (recognition) { reject(new Error('Já existe uma prática em andamento.')); return; }
    const current = new Recognition(); recognition = current;
    current.lang = language; current.interimResults = false; current.maxAlternatives = 1;
    let settled = false;
    const finish = (value,error) => { if(settled)return; settled=true; recognition=null; clearTimeout(timeout); if(error)reject(new Error(error));else resolve(value); };
    const timeout = setTimeout(()=>{current.abort();finish(null,'A prática expirou. Tente novamente.');},20000);
    current.onresult = event => finish(event.results[0][0].transcript);
    current.onerror = event => finish(null,event.error==='not-allowed'?'O microfone não foi autorizado.':'Não foi possível reconhecer a fala.');
    current.onend = () => finish(null);
    try { current.start(); } catch (_) { finish(null,'Não foi possível iniciar o microfone.'); }
  });
  window.nexoDeviceCancelReminder = key => { clearTimeout(reminders.get(key)); reminders.delete(key); };
  window.nexoDeviceReminder = async (key,hour,minute) => {
    window.nexoDeviceCancelReminder(key);
    if(!('Notification' in window) || await Notification.requestPermission()!=='granted') return false;
    const schedule = () => {
      const now = new Date(), at = new Date(); at.setHours(hour,minute,0,0);
      if(at<=now)at.setDate(at.getDate()+1);
      reminders.set(key,setTimeout(async()=>{
        try {
          const registration = await navigator.serviceWorker.ready;
          await registration.showNotification('NEXO',{body:'Um momento para continuar sua rotina.',tag:'nexo-'+key});
        } catch (_) { /* Browser may suspend background tabs. */ }
        schedule();
      },at-now));
    };
    schedule(); return true;
  };
  window.addEventListener('pagehide',()=>{ if(recognition)recognition.abort(); window.nexoDeviceStopAudio(); });
})();
