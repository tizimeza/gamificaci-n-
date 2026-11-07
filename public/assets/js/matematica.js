(() => {
  'use strict';
  const $ = s => document.querySelector(s), KEY = 'rosko:matematica:v1';
  const examples = [
    ['A','Ángulo','Figura formada por dos semirrectas que comparten un mismo origen.'],
    ['B','Bisectriz','Semirrecta que divide un ángulo en dos ángulos de igual medida.'],
    ['C','Cateto','Cada uno de los dos lados que forman el ángulo recto de un triángulo rectángulo.'],
    ['D','Denominador','Número que indica en cuántas partes iguales se divide la unidad en una fracción.'],
    ['E','Ecuación','Igualdad matemática que incluye una o más incógnitas.'],
    ['F','Fracción','Expresión que representa un cociente mediante un numerador y un denominador distinto de cero.'],
    ['H','Hipotenusa','Lado opuesto al ángulo recto y de mayor longitud en un triángulo rectángulo.'],
    ['M','Mediana','Valor central de un conjunto ordenado de datos; si hay dos centrales, se calcula su promedio.'],
    ['P','Perímetro','Longitud total del contorno de una figura plana.'],
    ['R','Radio','Segmento que une el centro de una circunferencia con cualquiera de sus puntos.'],
    ['T','Triángulo','Polígono de tres lados.'],
    ['V','Vértice','Punto donde se encuentran dos lados consecutivos de un polígono.']
  ].map(([letter,answer,question]) => ({letter,answer,question,rule:'starts',aliases:''}));
  const normalize = v => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
  const resolved = q => ['solved','revealed'].includes(q.status);
  const make = (tag,props={}) => Object.assign(document.createElement(tag),props);
  let game=null,draft=null,timerId=null,noticeId=null,confirmAction=null,audio=null,sound=false,storageWarning=false;
  function notify(text) { $('#notice').textContent=text; $('#notice').hidden=false; clearTimeout(noticeId); noticeId=setTimeout(()=>{$('#notice').hidden=true;},4500); }
  function persist() { try { localStorage.setItem(KEY,JSON.stringify({version:1,draft,game})); } catch { if(!storageWarning){notify('El navegador no pudo guardar. Podés jugar mientras mantengas esta pestaña abierta.');storageWarning=true;} } }
  function validDraft(d) {
    return d && typeof d.title==='string' && d.title.trim() && d.title.length<=70 && Array.isArray(d.teams) && d.teams.length===2 && d.teams.every(t=>typeof t==='string' && t.trim() && t.length<=28)
      && [20,30,45,60].includes(d.duration) && Array.isArray(d.questions) && d.questions.length>=3 && d.questions.length<=26 && new Set(d.questions.map(q=>q?.letter)).size===d.questions.length
      && d.questions.every(q=>q && /^[A-ZÑ]$/.test(q.letter) && ['starts','contains'].includes(q.rule) && typeof q.answer==='string' && q.answer.trim() && q.answer.length<=120 && typeof q.question==='string' && q.question.trim() && q.question.length<=600 && typeof q.aliases==='string' && q.aliases.length<=300 && (q.rule==='starts'?normalize(q.answer).startsWith(normalize(q.letter)):normalize(q.answer).includes(normalize(q.letter))));
  }
  function validGame(g) {
    return validDraft(g) && ['playing','finished'].includes(g.phase) && Number.isInteger(g.index) && g.index>=0 && g.index<g.questions.length && [0,1].includes(g.turn)
      && Array.isArray(g.scores) && g.scores.length===2 && g.scores.every(s=>Number.isInteger(s)&&s>=0&&s<=26) && Number.isFinite(g.remaining) && g.remaining>=0 && g.remaining<=g.duration
      && Number.isInteger(g.attempts) && g.attempts>=0 && g.questions.every(q=>['pending','passed','solved','revealed'].includes(q.status));
  }
  function validEditor(d) {
    return d && typeof d.title==='string' && d.title.length<=70 && Array.isArray(d.teams) && d.teams.length===2 && d.teams.every(t=>typeof t==='string'&&t.length<=28)
      && [20,30,45,60].includes(d.duration) && Array.isArray(d.questions) && d.questions.length<=26
      && d.questions.every(q=>q && typeof q.letter==='string' && q.letter.length<=1 && ['starts','contains'].includes(q.rule) && typeof q.answer==='string' && q.answer.length<=120 && typeof q.question==='string' && q.question.length<=600 && typeof q.aliases==='string' && q.aliases.length<=300);
  }
  function restore() { try {const data=JSON.parse(localStorage.getItem(KEY));if(data?.version===1){if(validEditor(data.draft))draft=data.draft;if(validGame(data.game))game=data.game;}}catch{/* Broken or inaccessible storage starts fresh. */} }
  function labeled(text,element,className='') {const label=make('label',{className,textContent:text});label.append(element);return label;}
  function count() {const n=$('#questions').children.length;$('#question-count').textContent=`${n} preguntas`;$('#add-question').disabled=n>=26;}
  function addRow(q={letter:'',rule:'starts',answer:'',question:'',aliases:''}) {
    if($('#questions').children.length>=26)return;
    const row=make('div',{className:'question-row'}),rule=make('select',{className:'q-rule'});
    for(const [value,textContent] of [['starts','Empieza con'],['contains','Contiene']])rule.append(make('option',{value,textContent}));rule.value=q.rule;
    const answers=make('div',{className:'answer-fields'});
    answers.append(labeled('Respuesta',make('input',{value:q.answer,maxLength:120,className:'q-answer',required:true})),labeled('Otras respuestas aceptadas (opcional)',make('input',{value:q.aliases,maxLength:300,className:'q-aliases',placeholder:'Variante; otra variante'})));
    const remove=make('button',{type:'button',className:'delete-question',textContent:'×'});remove.setAttribute('aria-label','Eliminar pregunta');
    remove.addEventListener('click',()=>{const next=row.nextElementSibling||row.previousElementSibling;row.remove();count();cache();next?.querySelector('input')?.focus();});
    row.append(labeled('Letra',make('input',{value:q.letter,maxLength:1,className:'q-letter',required:true})),labeled('La respuesta…',rule),labeled('Definición para leer al curso',make('textarea',{value:q.question,maxLength:600,className:'q-question',required:true}),'question-text'),remove,answers);
    $('#questions').append(row);count();
  }
  function fill(d={title:'Matemática en juego',teams:['Los Radicales','Las Potencias'],duration:30,questions:examples}) {
    $('#rosco-title').value=d.title;$('#team-a').value=d.teams[0];$('#team-b').value=d.teams[1];$('#duration').value=d.duration;$('#questions').replaceChildren();d.questions.forEach(addRow);
  }
  function read() {return {title:$('#rosco-title').value.trim(),teams:[$('#team-a').value.trim(),$('#team-b').value.trim()],duration:Number($('#duration').value),questions:[...$('#questions').children].map(row=>({letter:row.querySelector('.q-letter').value.trim().toUpperCase(),rule:row.querySelector('.q-rule').value,question:row.querySelector('.q-question').value.trim(),answer:row.querySelector('.q-answer').value.trim(),aliases:row.querySelector('.q-aliases').value.trim()}))};}
  function cache(){draft=read();persist();}
  function validate() {
    const d=read();let message='',target=null;
    if(!d.title||d.teams.some(t=>!t)){message='Completá el nombre del rosco y de los dos equipos.';target=!d.title?$('#rosco-title'):!d.teams[0]?$('#team-a'):$('#team-b');}
    else if(d.questions.length<3)message='Agregá al menos tres preguntas para armar el rosco.';
    else {const seen=new Set();for(let i=0;i<d.questions.length;i++){
      const q=d.questions[i],row=$('#questions').children[i];
      if(!/^[A-ZÑ]$/.test(q.letter)){message=`Pregunta ${i+1}: elegí una letra entre A y Z o Ñ.`;target=row.querySelector('.q-letter');break;}
      if(seen.has(q.letter)){message=`La letra ${q.letter} aparece dos veces. Usá letras distintas.`;target=row.querySelector('.q-letter');break;}seen.add(q.letter);
      if(!q.question||!q.answer){message=`Pregunta ${q.letter}: completá la definición y la respuesta.`;target=row.querySelector(!q.question?'.q-question':'.q-answer');break;}
      if(!(q.rule==='starts'?normalize(q.answer).startsWith(normalize(q.letter)):normalize(q.answer).includes(normalize(q.letter)))){message=`La respuesta de ${q.letter} debe ${q.rule==='starts'?'empezar con':'contener'} esa letra. Revisá la letra o la regla.`;target=row.querySelector('.q-answer');break;}
    }}
    $('#setup-error').textContent=message;
    if(message){$('#questions').classList.remove('answers-hidden');$('#answers-toggle').textContent='Ocultar respuestas';$('#answers-toggle').setAttribute('aria-pressed','true');if(target)target.focus();else $('#setup-error').scrollIntoView({block:'center'});return null;}
    draft=d;persist();return d;
  }
  function resumeBanner(){ $('#resume-banner').hidden=!game; $('#resume-banner strong').textContent=game?.phase==='finished'?'El último desafío ya tiene resultados.':'Hay un desafío en marcha.'; $('#resume-banner p').textContent=game?.phase==='finished'?'Revisá cómo les fue o prepará la próxima partida.':'Podés retomar el rosco donde lo dejaron.'; $('#resume').textContent=game?.phase==='finished'?'Ver resultados':'Continuar partida'; }
  function screen(name){for(const id of ['setup','game','result'])$(`#${id}-screen`).hidden=name!==id;resumeBanner();window.scrollTo({top:0,behavior:'instant'});$(name==='setup'?'#setup-heading':name==='game'?'#game-title':'#result-title').focus({preventScroll:true});}
  function ask(title,detail,action){$('#confirm-title').textContent=title;$('#confirm-detail').textContent=detail;confirmAction=action;$('#confirm-dialog').showModal();}
  function start(d){pause();game={...structuredClone(d),phase:'playing',index:0,turn:0,scores:[0,0],remaining:d.duration,attempts:0,questions:d.questions.map(q=>({...q,status:'pending'}))};persist();render();screen('game');}
  function requestStart(d){if(game?.phase==='playing')ask('¿Empezar este nuevo desafío?','La partida en curso será reemplazada. Las preguntas del editor se conservan.',()=>start(d));else start(d);}
  function tone(correct){if(!sound)return;try{audio||=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.connect(gain);gain.connect(audio.destination);osc.frequency.value=correct?680:330;gain.gain.setValueAtTime(.07,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.18);osc.start();osc.stop(audio.currentTime+.2);}catch{/* Audio is optional. */}}
  function mascot(mode,text){const el=$('.mascot');el.classList.remove('celebrate','oops','thinking');if(mode){void el.offsetWidth;el.classList.add(mode);}$('#mascot-caption').textContent=text;}
  function timerDisplay(){if(!game)return;$('#timer-value').textContent=game.remaining;$('#timer-action').textContent=timerId?'Pausar':game.remaining<game.duration?'Seguir':'Iniciar';$('#timer').classList.toggle('running',!!timerId);$('#timer').classList.toggle('urgent',game.remaining<=5);$('#timer').setAttribute('aria-label',`${timerId?'Pausar':'Iniciar'} cronómetro: ${game.remaining} segundos`);}
  function pause(){clearInterval(timerId);timerId=null;timerDisplay();}
  function wheel(){
    $('#nodes').replaceChildren();game.questions.forEach((q,i)=>{
      const angle=i/game.questions.length*Math.PI*2-Math.PI/2,node=make('button',{type:'button',className:`letter-node ${q.status}${game.index===i?' current':''}`});
      node.style.left=`${50+40*Math.cos(angle)}%`;node.style.top=`${50+40*Math.sin(angle)}%`;node.append(make('span',{textContent:q.letter}));const symbol={solved:'✓',revealed:'×',passed:'↻'}[q.status];if(symbol)node.append(make('small',{textContent:symbol}));
      node.setAttribute('aria-label',`${q.letter}: ${{pending:'pendiente',passed:'pasada',solved:'acertada',revealed:'respuesta revelada'}[q.status]}`);if(game.index===i)node.setAttribute('aria-current','step');
      node.addEventListener('click',()=>{pause();game.index=i;game.remaining=game.duration;persist();render();});$('#nodes').append(node);
    });
    const angle=game.index/game.questions.length*Math.PI*2-Math.PI/2;$('#orbit-marker').style.left=`${50+48*Math.cos(angle)}%`;$('#orbit-marker').style.top=`${50+48*Math.sin(angle)}%`;
    const done=game.questions.filter(resolved).length;$('#progress-text').textContent=`${done} de ${game.questions.length} resueltas`;$('#progress-fill').style.width=`${done/game.questions.length*100}%`;
  }
  function feedback(title,detail,type=''){const panel=$('#feedback');panel.replaceChildren(make('strong',{textContent:title}),make('span',{textContent:detail}));panel.className=`feedback ${type}`;panel.hidden=false;}
  function render(){
    const q=game.questions[game.index],done=resolved(q);$('#game-title').textContent=game.title;
    for(const [i,id]of [[0,'a'],[1,'b']]){$(`#score-${id} span`).textContent=game.teams[i];$(`#score-${id} strong`).textContent=game.scores[i];$(`#score-${id}`).classList.toggle('is-turn',game.turn===i);}
    $('#turn-label').textContent=`Turno de ${game.teams[game.turn]}`;$('#turn-label').classList.toggle('coral',game.turn===1);$('#letter-rule').textContent=`${q.rule==='starts'?'Empieza con':'Contiene'} ${q.letter}`;$('#question-title').textContent=q.question;$('#answer').value='';$('#answer-form').hidden=done;$('#feedback').hidden=true;$('#pass').hidden=done;$('#reveal').hidden=done;$('#next').hidden=!done;$('#timer').disabled=done;
    $('#next').textContent=game.questions.every(resolved)?'Ver resultados ↗':'Siguiente letra ↗';
    if(done)feedback(q.status==='solved'?`✓ ${q.answer}`:q.answer,q.status==='solved'?'Respuesta acertada. Vamos con la próxima.':'Una idea más para llevarse de esta partida.',q.status==='solved'?'':'error');
    mascot('',done?'Siempre se aprende algo.':'Vamos de a una.');wheel();timerDisplay();
  }
  function next(switchTeam=true){
    pause();if(game.questions.every(resolved)){finish();return;}
    for(let offset=1;offset<=game.questions.length;offset++){const i=(game.index+offset)%game.questions.length;if(!resolved(game.questions[i])){game.index=i;break;}}
    if(switchTeam)game.turn=1-game.turn;game.remaining=game.duration;persist();render();$('#question-title').focus({preventScroll:true});
  }
  function answer(event){
    event.preventDefault();const q=game.questions[game.index];if(resolved(q))return;const entered=normalize($('#answer').value);if(!entered){$('#answer').focus();return;}
    pause();game.attempts++;const correct=[q.answer,...q.aliases.split(';')].some(value=>normalize(value)===entered);q.status=correct?'solved':'revealed';if(correct)game.scores[game.turn]++;persist();render();
    feedback(correct?`✓ Bien pensado: ${q.answer}`:`Esta era: ${q.answer}`,correct?'Un punto para el equipo. Sigamos conectando ideas.':'No resta puntos. Lean la definición una vez más y conecten la idea.',correct?'':'error');mascot(correct?'celebrate':'oops',correct?'¡Esa idea suma!':'La próxima puede ser.');tone(correct);$('#next').focus({preventScroll:true});
  }
  function finish(){pause();game.phase='finished';persist();results();screen('result');tone(true);}
  function results(){
    const [a,b]=game.scores,done=game.questions.every(resolved),correct=game.questions.filter(q=>q.status==='solved').length;
    $('#result-kicker').textContent=done?'El rosco llegó a la meta':'Desafío cerrado por el profe';$('#result-title').textContent=a===b?'¡Esto termina en empate!':`¡${game.teams[a>b?0:1]} se lleva el rosco!`;$('#result-subtitle').textContent=`${game.title}. Cada respuesta abrió una conversación.`;
    $('#result-scores').replaceChildren();game.teams.forEach((name,i)=>{const box=make('div');box.append(make('span',{textContent:name}),make('strong',{textContent:String(game.scores[i])}));$('#result-scores').append(box);});
    $('#result-correct').textContent=`${correct}/${game.questions.length}`;$('#result-attempts').textContent=game.attempts;$('#result-pending').textContent=game.questions.length-correct;
  }
  $('#setup-form').addEventListener('input',cache);$('#setup-form').addEventListener('change',cache);
  $('#setup-form').addEventListener('submit',e=>{e.preventDefault();const d=validate();if(d)requestStart(d);});
  $('#add-question').addEventListener('click',()=>{addRow();cache();$('#questions').lastElementChild.querySelector('input').focus();});
  $('#restore-examples').addEventListener('click',()=>ask('¿Volver a las preguntas de ejemplo?','Esto reemplaza las preguntas que editaste. Los equipos y el nombre se mantienen.',()=>{$('#questions').replaceChildren();examples.forEach(addRow);cache();}));
  $('#answers-toggle').addEventListener('click',()=>{const hidden=$('#questions').classList.toggle('answers-hidden');$('#answers-toggle').textContent=hidden?'Mostrar respuestas':'Ocultar respuestas';$('#answers-toggle').setAttribute('aria-pressed',String(!hidden));});
  $('#preview').addEventListener('click',()=>{const d=validate();if(!d)return;const q=d.questions[0];$('#preview-rule').textContent=`${q.rule==='starts'?'Empieza con':'Contiene'} ${q.letter}`;$('#preview-question').textContent=q.question;$('#preview-dialog').showModal();});
  $('#close-preview').addEventListener('click',()=>$('#preview-dialog').close());$('#preview-start').addEventListener('click',()=>{$('#preview-dialog').close();const d=validate();if(d)requestStart(d);});
  $('#confirm-cancel').addEventListener('click',()=>{$('#confirm-dialog').close();confirmAction=null;});$('#confirm-accept').addEventListener('click',()=>{const action=confirmAction;confirmAction=null;$('#confirm-dialog').close();action?.();});$('#confirm-dialog').addEventListener('cancel',()=>{confirmAction=null;});
  $('#resume').addEventListener('click',()=>{if(!game)return;if(game.phase==='finished'){results();screen('result');}else{render();screen('game');}});$('#back-editor').addEventListener('click',()=>{pause();persist();screen('setup');});
  $('#answer-form').addEventListener('submit',answer);$('#next').addEventListener('click',()=>next());
  $('#pass').addEventListener('click',()=>{const q=game.questions[game.index];if(resolved(q))return;q.status='passed';next();notify('Pasapalabra. Esta letra vuelve a la ronda.');});
  $('#reveal').addEventListener('click',()=>{const q=game.questions[game.index];if(resolved(q))return;pause();q.status='revealed';persist();render();feedback(q.answer,'Sin puntos. La idea queda para la próxima ronda.','info');$('#next').focus({preventScroll:true});});
  $('#timer').addEventListener('click',()=>{
    if(resolved(game.questions[game.index]))return;if(timerId){pause();mascot('','Tomamos aire.');persist();return;}
    const deadline=Date.now()+game.remaining*1000;mascot('thinking','Hay una idea dando vueltas…');
    timerId=setInterval(()=>{game.remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));timerDisplay();persist();if(game.remaining===0){pause();const q=game.questions[game.index];q.status='passed';next();feedback('Se terminó el tiempo.','La letra anterior quedó pasada. Ahora juega el otro equipo.','info');mascot('','Todavía queda otra oportunidad.');tone(false);}},200);timerDisplay();
  });
  $('#finish').addEventListener('click',()=>{pause();ask('¿Cerrar la partida?','Se mostrarán los resultados actuales. Las preguntas pendientes quedarán para seguir practicando.',finish);});
  $('#play-again').addEventListener('click',()=>start({title:game.title,teams:[...game.teams],duration:game.duration,questions:game.questions.map(({letter,rule,answer,question,aliases})=>({letter,rule,answer,question,aliases}))}));$('#edit-again').addEventListener('click',()=>screen('setup'));
  $('#sound').addEventListener('click',()=>{sound=!sound;$('#sound').textContent=`Sonido: ${sound?'activado':'apagado'}`;$('#sound').setAttribute('aria-pressed',String(sound));if(sound)tone(true);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&timerId){pause();persist();mascot('','El reloj está en pausa.');}});window.addEventListener('pagehide',()=>{pause();persist();});
  restore();fill(draft||undefined);resumeBanner();
})();
