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
  window.nexoDeviceReminderCalendar = (key, hour, minute) => {
    const names = {culinaria:'Dieta', fitness:'Fitness', financas:'Finanças', idiomas:'Idiomas'};
    if (!names[key] || !Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return false;
    const now = new Date(), start = new Date(now);
    start.setHours(hour, minute, 0, 0);
    if (start <= now) start.setDate(start.getDate() + 1);
    const pad = value => String(value).padStart(2, '0');
    const local = start.getFullYear() + pad(start.getMonth()+1) + pad(start.getDate()) + 'T' + pad(hour) + pad(minute) + '00';
    const stamp = now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/, 'Z');
    const uid = (window.crypto?.randomUUID?.() || (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2))) + '@nexo';
    const content = [
      'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//NEXO//Lembretes//PT-BR','CALSCALE:GREGORIAN',
      'BEGIN:VEVENT','UID:'+uid,'DTSTAMP:'+stamp,'DTSTART:'+local,'DURATION:PT5M','RRULE:FREQ=DAILY',
      'SUMMARY:NEXO '+names[key]+' - rotina',
      'DESCRIPTION:Altere ou exclua o evento na sua agenda.',
      'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Um momento para continuar sua rotina.','TRIGGER:PT0S','END:VALARM',
      'END:VEVENT','END:VCALENDAR','',
    ].join('\r\n');
    try {
      const url = URL.createObjectURL(new Blob([content], {type:'text/calendar;charset=utf-8'}));
      const link = document.createElement('a');
      link.href = url; link.download = 'nexo-lembrete-'+key+'.ics';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch (_) { return false; }
  };
  window.nexoDeviceReminder = async (key,hour,minute) => {
    window.nexoDeviceCancelReminder(key);
    if(!('Notification' in window) || (Notification.permission !== 'granted' && await Notification.requestPermission()!=='granted')) return false;
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
  // Restore opted-in schedules on a new page session, without requesting permission.
  if ('Notification' in window && Notification.permission === 'granted') {
    for (const key of ['culinaria', 'fitness', 'financas', 'idiomas']) {
      try {
        const stored = localStorage.getItem('flutter.nexo.reminder.' + key);
        const value = stored && JSON.parse(stored);
        const match = typeof value === 'string' && /^(\d{1,2}):(\d{1,2})$/.exec(value);
        if (match && Number(match[1]) < 24 && Number(match[2]) < 60)
          window.nexoDeviceReminder(key, Number(match[1]), Number(match[2]));
      } catch (_) { /* The user can configure the reminder again. */ }
    }
  }
  window.addEventListener('pagehide',()=>{ if(recognition)recognition.abort(); window.nexoDeviceStopAudio(); });
})();
