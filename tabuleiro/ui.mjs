import {createDamas} from './damas.mjs';
import {createXadrez} from './xadrez.mjs';

const $ = id => document.getElementById(id);
const family = document.querySelector('main').dataset.game;
const chess = family === 'xadrez';
const create = chess ? createXadrez : createDamas;
const names = {p:'peão',n:'cavalo',b:'bispo',r:'torre',q:'dama',k:'rei'};
const glyphs = {p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'};
const label = side => chess ? (side === 1 ? 'Brancas' : 'Pretas') : (side === 1 ? 'Vermelhas' : 'Pretas');
try { document.documentElement.dataset.theme = localStorage.getItem('prisma_theme') || ''; } catch {}
let rules, mode, own, from, path, options, finished, lost, ply, timer, peer, conn, room, pending;
const buttons = [];
const square = i => 'abcdefgh'[i % 8] + (8 - (i >> 3));
const show = id => ['menu','lobby','game'].forEach(key => $(key).classList.toggle('hide',key !== id));
const canPlay = () => finished === null && !lost && (mode === 'local' || rules.turn() === own);
const status = text => { $('lobby-status').textContent = text; };

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
  lost = false;
  finished = null;
  resetSelection();
  $('mode').textContent = {local:'2 jogadores',ai:'Computador',online:'Online · '+label(own)}[mode];
  show('game');
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
    : finished !== null ? label(finished)+' venceram!'
    : path.length ? 'Continue a captura.'
    : 'Vez das '+label(rules.turn()).toLowerCase()+(rules.check?.() ? ' · Xeque!' : '.');
  $('again').classList.toggle('hide',finished === null || lost || mode === 'online');
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
  resetSelection();
  finished = rules.result();
  render();
}

function submit(move) {
  if (mode === 'online') {
    if (!conn?.open) return disconnected();
    conn.send({type:'move',ply,from:move.from,path:move.path,promotion:move.promotion ?? null});
  }
  apply(move);
  if (mode === 'ai' && finished === null) timer = setTimeout(ai,300);
}

function ai() {
  const value = {p:1,n:3,b:3,r:5,q:9};
  const ranked = rules.moves().map(move => ({
    move,
    score: (value[move.captured] || move.victims.length) * 2 + (move.promotion ? value[move.promotion] : 0) + Math.random(),
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
  });
  connection.on('data',msg => {
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

function lobby(join) {
  show('lobby');
  $('create').classList.toggle('hide',join);
  $('create').disabled = false;
  $('join').classList.toggle('hide',!join);
  $('join-button').disabled = false;
  $('invite').classList.add('hide');
  status('');
  if (join) $('code').focus();
}

function connect(host) {
  cleanup();
  if (!window.Peer) { status('PeerJS indisponível. Recarregue a página.'); return; }
  if (host) room = family+'-'+crypto.randomUUID().slice(0,8);
  else room = $('code').value.trim().toLowerCase();
  if (!new RegExp('^'+family+'-[a-z0-9]{8}$').test(room)) { status('Confira o código da sala.'); return; }
  $('join-button').disabled = $('create').disabled = true;
  $('invite').classList.add('hide');
  status('Conectando...');
  const config = {debug:0};
  const current = peer = host ? new Peer(room,config) : new Peer(config);
  const fail = text => {
    if (peer !== current) return;
    cleanup();
    $('join-button').disabled = $('create').disabled = false;
    $('invite').classList.add('hide');
    status(text);
  };
  pending = setTimeout(() => fail('Tempo esgotado. Tente novamente.'),15000);
  current.on('open',() => {
    if (peer !== current) return;
    if (!host) { wire(current.connect(room,{reliable:true}),-1); return; }
    clearTimeout(pending);
    $('invite').classList.remove('hide');
    $('copy-code').textContent = room;
    status('Sala pronta. Aguardando amigo…');
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
  try { await navigator.clipboard.writeText(text); status('Copiado!'); }
  catch { status(text); }
}

$('local').onclick = () => start('local');
$('computer').onclick = () => start('ai');
$('again').onclick = () => start(mode);
$('online').onclick = () => lobby(false);
$('show-join').onclick = () => lobby(true);
$('create').onclick = () => connect(true);
$('join').onsubmit = event => { event.preventDefault(); connect(false); };
$('copy-code').onclick = () => copy(room);
$('copy-link').onclick = () => copy(location.origin+location.pathname+'#'+room);
document.querySelectorAll('.back-menu').forEach(button => {
  button.onclick = () => {
    cleanup();
    history.replaceState(null,'',location.pathname+location.search);
    show('menu');
  };
});
window.addEventListener('pagehide',cleanup);
if (new RegExp('^'+family+'-[a-z0-9]{8}$').test(location.hash.slice(1))) {
  $('code').value = location.hash.slice(1);
  lobby(true);
}
