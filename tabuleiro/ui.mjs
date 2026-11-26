import {createDamas} from './damas.mjs';
import {createXadrez} from './xadrez.mjs';

const $ = id => document.getElementById(id);
const family = document.querySelector('main').dataset.game;
const chess = family === 'xadrez';
const create = chess ? createXadrez : createDamas;
const names = {p:'peão',n:'cavalo',b:'bispo',r:'torre',q:'dama',k:'rei'};
const glyphs = {p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'};
const label = side => chess ? (side === 1 ? 'Brancas' : 'Pretas') : (side === 1 ? 'Vermelhas' : 'Pretas');
const PEER_CONFIG = {
  debug: 0,
  config: {
    iceServers: [
      {urls: 'stun:stun.l.google.com:19302'},
      {urls: 'stun:stun1.l.google.com:19302'},
      {urls: 'stun:stun.cloudflare.com:3478'},
      {urls: ['turn:openrelay.metered.ca:80','turn:openrelay.metered.ca:443','turn:openrelay.metered.ca:443?transport=tcp','turns:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject'},
    ],
    iceCandidatePoolSize: 4,
  },
};
const store = {
  get(key) { try { return localStorage.getItem(key) || ''; } catch { return ''; } },
  set(key,value) { try { localStorage.setItem(key,value); } catch {} },
};

let rules, mode, own, from, path, options, finished, lost, ply, timer, peer, conn, room, pending;
let wantMine = false, wantTheirs = false, lastMove = null;
let level = store.get(family+'_level') || 'mid', score = [0,0], sound = store.get(family+'_sound') !== '0', roundActive = false;
let onlineNames = {1:'Anfitrião', '-1':'Convidado(a)'};
const buttons = [];
const square = i => 'abcdefgh'[i % 8] + (8 - (i >> 3));
const show = id => ['menu','setup','lobby','game'].forEach(key => $(key).classList.toggle('hide',key !== id));
const canPlay = () => finished === null && !lost && (mode === 'local' || rules.turn() === own);
const status = text => { $('lobby-status-join').textContent = text; };

for (let i = 0; i < 64; i++) {
  const cell = document.createElement('button');
  cell.type = 'button';
  cell.classList.toggle('dark',((i >> 3) + i % 8) % 2 === 1);
  cell.onclick = () => select(i);
  $('board').append(cell);
  buttons.push(cell);
}

function start(nextMode, side = 1) {
  clearTimeout(timer);
  mode = nextMode;
  own = side;
  rules = create();
  ply = 0;
  lastMove = null;
  wantMine = wantTheirs = false;
  lost = false;
  finished = null;
  if (!roundActive) score = [0,0];
  roundActive = true;
  resetSelection();
  $('mode').textContent = {local:'2 jogadores',ai:'Computador',online:'Online · '+label(own)}[mode];
  show('game');
  renderScore();
  render();
}

function resetSelection() {
  from = null;
  path = [];
  options = [];
  $('promotion').classList.add('hide');
}

function render() {
  const targets = new Set(options.map(m => m.path[path.length]));
  const board = rules.board();
  if (path.length) {
    board[path.at(-1)] = board[from];
    board[from] = null;
    if (!chess) for (const victim of options[0].victims.slice(0,path.length)) board[victim] = null;
  }
  board.forEach((piece,i) => {
    const cell = buttons[i];
    const active = i === (path.at(-1) ?? from);
    cell.classList.toggle('selected',active);
    cell.classList.toggle('target',targets.has(i));
    cell.classList.toggle('last',lastMove?.includes(i));
    cell.setAttribute('aria-pressed',String(active));
    cell.setAttribute('aria-label',square(i)+(piece ? ', '+(names[piece.kind] || piece.kind)+' · '+label(piece.side) : '')+(targets.has(i) ? ', destino válido' : ''));
    cell.replaceChildren();
    if (!piece) return;
    const token = document.createElement('span');
    token.className = (chess ? 'chess' : 'disc')+(piece.side === 1 ? ' light-piece' : '');
    token.textContent = chess ? glyphs[piece.kind] : piece.kind === 'dama' ? '◆' : '';
    token.setAttribute('aria-hidden','true');
    cell.append(token);
  });
  $('message').textContent = lost ? 'A conexão com o outro jogador foi encerrada.'
    : finished === 0 ? 'Empate.'
    : finished !== null ? (mode === 'local' ? label(finished)+' venceram!' : finished === own ? 'Você venceu! 🎉' : 'Você perdeu.')
    : path.length ? 'Continue a captura.'
    : (mode !== 'local' && rules.turn() === own ? 'Sua vez' : 'Vez das '+label(rules.turn()).toLowerCase())+(rules.check?.() ? ' · Xeque!' : '.');
  renderScore();
  $('end-bar').classList.toggle('hide',finished === null && !lost);
  $('message').classList.toggle('result',finished !== null || lost);
  $('again').classList.toggle('hide',finished === null || lost);
  $('again').textContent = mode === 'online' ? (wantMine ? 'Aguardando adversário...' : 'Pedir revanche') : 'Jogar novamente';
  $('again').disabled = wantMine;
}

function select(i) {
  if (!canPlay() || !$('promotion').classList.contains('hide')) return;
  const matches = options.filter(m => m.path[path.length] === i);
  if (matches.length) {
    path.push(i);
    const complete = matches.filter(m => m.path.length === path.length);
    if (!complete.length) { options = matches; render(); return; }
    if (complete.length === 1) { submit(complete[0]); return; }
    $('promotion').replaceChildren(...complete.map(move => {
      const button = document.createElement('button');
      button.className = 'sec';
      button.textContent = names[move.promotion];
      button.onclick = () => submit(move);
      return button;
    }));
    $('promotion').classList.remove('hide');
    $('promotion').firstElementChild.focus();
    return;
  }
  if (path.length) return;
  const choices = rules.moves().filter(m => m.from === i);
  from = choices.length ? i : null;
  options = choices;
  render();
}

function apply(move) {
  rules.play(move);
  ply++;
  lastMove = [move.from, move.path.at(-1)];
  resetSelection();
  finished = rules.result();
  if (finished !== null) {
    if (finished === 1) score[0]++;
    if (finished === -1) score[1]++;
    roundActive = false;
  }
  render();
  renderScore();
}

function renderScore() {
  $('score').innerHTML = `<span>Você <strong>${mode === 'online' && own === -1 ? score[1] : score[0]}</strong></span><span>×</span><span>Adversário <strong>${mode === 'online' && own === -1 ? score[0] : score[1]}</strong></span>`;
  const labels = $('score').querySelectorAll('span');
  labels[0].firstChild.textContent = (mode === 'online' ? onlineNames[own] : $('local-name').value.trim() || label(1))+' ';
  const firstSide = mode === 'online' ? own : 1;
  labels[0].classList.toggle('active',finished === null && !lost && rules.turn() === firstSide);
  labels[2].classList.toggle('active',finished === null && !lost && rules.turn() !== firstSide);
  labels[0].setAttribute('aria-label',label(firstSide)+': '+labels[0].textContent+' vitórias');
  labels[2].firstChild.textContent = (mode === 'local' ? $('second-name').value.trim() || label(-1) : mode === 'ai' ? 'Computador' : onlineNames[-own])+' ';
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  store.set('prisma_theme',next);
  const meta = document.getElementById('meta-theme');
  if (meta) meta.content = next === 'dark' ? '#181817' : '#faf8f3';
}

function submit(move) {
  if (mode === 'online') {
    if (!conn?.open) return disconnected();
    conn.send({type:'move',ply,from:move.from,path:move.path,promotion:move.promotion ?? null});
  }
  apply(move);
  if (sound) { try { const audio = new AudioContext(); const tone = audio.createOscillator(); tone.connect(audio.destination); tone.frequency.value = move.captured || move.victims.length ? 260 : 420; tone.start(); tone.stop(audio.currentTime + .07); tone.onended = () => audio.close(); if (navigator.vibrate) navigator.vibrate(move.captured || move.victims.length ? [25,40,25] : 12); } catch {} }
  if (mode === 'ai' && finished === null) timer = setTimeout(ai,300);
}

function ai() {
  const value = {p:1,n:3,b:3,r:5,q:9};
  const ranked = rules.moves().map(move => ({
    move,
    score: (value[move.captured] || move.victims.length) * 2 + (move.promotion ? value[move.promotion] : 0) + Math.random() * (level === 'easy' ? 20 : level === 'mid' ? 5 : 1),
  }));
  ranked.sort((a,b) => b.score-a.score);
  apply(ranked[0].move);
}

function disconnected() {
  if ($('game').classList.contains('hide')) {
    status('A conexão foi encerrada. Tente novamente.');
    $('join-button').disabled = false;
    $('create').disabled = false;
  } else {
    lost = true;
    resetSelection();
    render();
  }
}

function cleanup() {
  clearTimeout(timer);
  clearTimeout(pending);
  const old = peer;
  peer = null;
  conn = null;
  old?.destroy();
}

function wire(connection, side) {
  conn = connection;
  connection.on('open',() => {
    if (conn !== connection) return;
    clearTimeout(pending);
    start('online',side);
    connection.send({type:'hello',name:onlineNames[side]});
  });
  connection.on('data',msg => {
    if (msg?.type === 'hello' && conn === connection) {
      onlineNames[-side] = String(msg.name || 'Adversário').trim().slice(0,14) || 'Adversário';
      if (mode === 'online' && rules) renderScore();
      return;
    }
    if (msg?.type === 'rematch' && conn === connection && mode === 'online' && finished !== null && !lost) {
      wantTheirs = true;
      if (wantMine) rematch(); else $('message').textContent = 'O adversário quer revanche.';
      return;
    }
    if (conn !== connection || !rules || mode !== 'online' || lost || finished !== null || rules.turn() === own ||
        msg?.type !== 'move' || msg.ply !== ply || !Array.isArray(msg.path)) return;
    const move = rules.moves().find(m => m.from === msg.from && (m.promotion ?? null) === (msg.promotion ?? null) &&
      m.path.length === msg.path.length && m.path.every((step,i) => step === msg.path[i]));
    if (move) apply(move);
  });
  for (const event of ['close','error']) connection.on(event,() => {
    if (conn === connection) { conn = null; disconnected(); }
  });
}

function waitingRoom(waiting) {
  $('lobby').classList.toggle('waiting',waiting);
  $('room-badge').classList.toggle('hide',!waiting);
  $('invite').classList.toggle('hide',!waiting);
  $('lobby-title').textContent = waiting ? 'Aguardando amigo' : $('join').classList.contains('hide') ? 'Partida Online' : 'Entrar na sala';
  $('lobby-back').textContent = waiting ? '← Cancelar' : '← Voltar';
}

function lobby(join, fromInvite = false) {
  show('lobby');
  $('online-setup').classList.toggle('hide',join);
  $('create').disabled = false;
  $('join').classList.toggle('hide',!join);
  $('join-button').disabled = false;
  $('join-code-wrap').classList.toggle('hide',!join || fromInvite);
  $('join-badge').classList.toggle('hide',!join || !fromInvite);
  $('join-badge').textContent = fromInvite ? $('code').value : '';
  waitingRoom(false);
  status(''); $('lobby-status').textContent='Sala pronta';
  if (join) (fromInvite ? $('join-name') : $('code')).focus();
}

function connect(host) {
  cleanup();
  if (!window.Peer) { status('PeerJS indisponível. Recarregue a página.'); return; }
  if (host) room = family+'-'+crypto.randomUUID().replaceAll('-','').slice(0,7);
  else room = $('code').value.trim().toLowerCase();
  if (!new RegExp('^'+family+'-[a-z0-9]{7}$').test(room)) { status('Confira o código da sala.'); return; }
  onlineNames = host
    ? {1:$('player-name').value.trim().slice(0,14) || 'Anfitrião', '-1':'Convidado(a)'}
    : {1:'Anfitrião', '-1':$('join-name').value.trim().slice(0,14) || 'Convidado(a)'};
  $('join-button').disabled = $('create').disabled = true;
  waitingRoom(false);
  status('Conectando...');
  const current = peer = host ? new Peer(room,PEER_CONFIG) : new Peer(PEER_CONFIG);
  const fail = text => {
    if (peer !== current) return;
    cleanup();
    $('join-button').disabled = $('create').disabled = false;
    waitingRoom(false);
    $('online-setup').classList.toggle('hide',!host);
    status(text);
  };
  pending = setTimeout(() => fail('Tempo esgotado. Tente novamente.'),15000);
  current.on('open',() => {
    if (peer !== current) return;
    if (!host) { wire(current.connect(room,{reliable:true}),-1); return; }
    clearTimeout(pending);
    waitingRoom(true);
    status('');
    $('online-setup').classList.add('hide');
    $('lobby-info').textContent = onlineNames[1];
    $('room-code').textContent = room;
    $('lobby-status').textContent = 'Sala pronta';
  });
  current.on('connection',connection => {
    if (host && peer === current && !conn && $('game').classList.contains('hide')) wire(connection,1);
    else connection.close();
  });
  current.on('error',() => {
    if (peer !== current) return;
    if ($('game').classList.contains('hide')) fail('Não foi possível conectar. Confira a sala e tente novamente.');
  });
  current.on('disconnected',() => {
    if (peer === current && !current.destroyed) current.reconnect();
  });
}

async function copy(text) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard indisponível');
    await navigator.clipboard.writeText(text);
    status('Copiado!');
  } catch { prompt('Copie o texto abaixo:',text); }
}

let setupMode = 'ai';
function configure(next) {
  setupMode = next;
  $('setup-heading').textContent = next === 'local' ? '2 Jogadores' : 'Contra o Computador';
  $('second-player').classList.toggle('hide',next !== 'local');
  $('difficulty-setup').classList.toggle('hide',next === 'local');
  show('setup');
}
$('local').onclick = () => configure('local');
$('computer').onclick = () => configure('ai');
$('start-ai').onclick = () => start(setupMode);
function rematch() { roundActive = true; score.reverse(); start('online',-own); }
$('again').onclick = () => {
  if (mode !== 'online') { roundActive = true; start(mode); return; }
  if (!conn?.open) return disconnected();
  wantMine = true;
  conn.send({type:'rematch'});
  if (wantTheirs) rematch(); else render();
};
$('sound').textContent = sound ? '🔊' : '🔇';
$('sound').onclick = () => { sound = !sound; store.set(family+'_sound',sound ? '1' : '0'); $('sound').textContent = sound ? '🔊' : '🔇'; };
document.querySelectorAll('.theme-toggle').forEach(button => button.onclick = toggleTheme);
document.querySelectorAll('[data-level]').forEach(button => button.onclick = () => {
  level = button.dataset.level;
  store.set(family+'_level',level);
  document.querySelectorAll('[data-level]').forEach(item => item.classList.toggle('active',item === button));
});
document.querySelectorAll('[data-level]').forEach(button => button.classList.toggle('active',button.dataset.level === level));
$('online').onclick = () => lobby(false);
$('show-join').onclick = () => lobby(true);
$('create').onclick = () => connect(true);
$('join').onsubmit = event => { event.preventDefault(); connect(false); };
$('share-link').onclick = async () => {
  const link = location.origin+location.pathname+'#'+room;
  if (navigator.share) {
    try { await navigator.share({title:document.title,text:'Vamos jogar '+document.title+'?',url:link}); return; }
    catch (error) { if (error?.name === 'AbortError') return; }
  }
  window.open('https://api.whatsapp.com/send?text='+encodeURIComponent('Vamos jogar '+document.title+'? '+link),'_blank','noopener');
};
$('copy-code').onclick = () => copy(room);
$('copy-link').onclick = () => copy(location.origin+location.pathname+'#'+room);
document.querySelectorAll('.back-menu').forEach(button => {
  button.onclick = () => {
    cleanup();
    roundActive = false;
    $('score').replaceChildren();
    $('setup').classList.add('hide');
    document.querySelector('.modes').classList.remove('hide');
    history.replaceState(null,'',location.pathname+location.search);
    show('menu');
  };
});
window.addEventListener('pagehide',cleanup);
if (new RegExp('^'+family+'-[a-z0-9]{7}$').test(location.hash.slice(1))) {
  $('code').value = location.hash.slice(1);
  lobby(true,true);
}
