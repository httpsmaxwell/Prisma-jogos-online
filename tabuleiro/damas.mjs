const diagonals = [[1,1],[1,-1],[-1,1],[-1,-1]];
const inside = (r,c) => r >= 0 && r < 8 && c >= 0 && c < 8;

function steps(board, from, side, capture) {
  const r = from >> 3, c = from % 8, king = Math.abs(board[from]) === 2;
  const result = [];
  for (const [dr,dc] of diagonals) {
    if (!king && !capture && dr !== -side) continue;
    let victim = -1;
    for (let n = 1; inside(r+n*dr,c+n*dc); n++) {
      const to = (r+n*dr)*8+c+n*dc, piece = board[to];
      if (piece) {
        if (!capture || piece * side > 0 || victim !== -1) break;
        victim = to;
      } else if (!capture || victim !== -1) {
        result.push({to, victim});
      }
      if (!king && n >= (capture ? 2 : 1)) break;
      if (!king && capture && n === 1 && victim === -1) break;
    }
  }
  return result;
}

function chains(board, from, side) {
  return steps(board, from, side, true).flatMap(({to,victim}) => {
    const next = board.slice();
    next[to] = next[from];
    next[from] = 0;
    // Captured pieces stay blocked until the capture sequence ends.
    next[victim] = side * 3;
    const tails = chains(next,to,side);
    return tails.length
      ? tails.map(t => ({path:[to,...t.path], victims:[victim,...t.victims]}))
      : [{path:[to], victims:[victim]}];
  });
}

export function createDamas() {
  let side = 1, quiet = 0;
  const board = Array.from({length:64}, (_,i) =>
    ((i >> 3) + i % 8) % 2 ? (i < 24 ? -1 : i >= 40 ? 1 : 0) : 0);
  const seen = new Map();
  const key = () => side + ':' + board.join(',');
  seen.set(key(),1);
  function moves() {
    const captures = [], simple = [];
    board.forEach((piece,from) => {
      if (piece * side <= 0) return;
      for (const chain of chains(board,from,side)) captures.push({from,...chain});
      for (const {to} of steps(board,from,side,false)) simple.push({from,path:[to],victims:[]});
    });
    const max = Math.max(0,...captures.map(m => m.victims.length));
    return max ? captures.filter(m => m.victims.length === max) : simple;
  }
  return {
    board: () => board.map(n => n ? {side:Math.sign(n),kind:Math.abs(n) === 2 ? 'dama' : 'peça'} : null),
    turn: () => side,
    moves,
    play({from,path,victims}) {
      const to = path.at(-1), piece = board[from];
      board[from] = 0;
      for (const victim of victims) board[victim] = 0;
      board[to] = to >> 3 === (side === 1 ? 0 : 7) ? side * 2 : piece;
      quiet = victims.length || Math.abs(piece) === 1 ? 0 : quiet+1;
      side = -side;
      seen.set(key(),(seen.get(key()) || 0)+1);
    },
    result() {
      if (!moves().length) return -side;
      if (quiet >= 40 || seen.get(key()) >= 3) return 0;
      return null;
    },
  };
}
