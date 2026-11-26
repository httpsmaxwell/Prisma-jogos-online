import {Chess} from '../xadrez/vendor/chess.mjs';
const square = i => 'abcdefgh'[i%8] + (8-(i>>3));
const index = s => (8-Number(s[1]))*8+'abcdefgh'.indexOf(s[0]);
export function createXadrez() {
  const chess = new Chess();
  const turn = () => chess.turn() === 'w' ? 1 : -1;
  return {
    turn,
    board: () => chess.board().flat().map(p => p && {side:p.color === 'w' ? 1 : -1,kind:p.type}),
    moves: () => chess.moves({verbose:true}).map(m => ({
      from:index(m.from),path:[index(m.to)],promotion:m.promotion,
      victims:m.captured ? [index(m.to)] : [], captured:m.captured,
    })),
    play(m) { chess.move({from:square(m.from),to:square(m.path[0]),promotion:m.promotion}); },
    check: () => chess.inCheck(),
    result: () => chess.isCheckmate() ? -turn() : chess.isDraw() ? 0 : null,
  };
}
