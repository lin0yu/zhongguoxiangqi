/**
 * 规则模块
 * 实现棋子走法、吃子规则、将军与将死判断，以及“飞将”规则。
 * 复杂算法说明：
 * - 走子合法性校验：先做棋子本身的几何规则判断，再模拟落子后检查是否导致己方被将或出现“飞将”。
 * - 将军判断：定位己方帅的位置，遍历对方所有棋子，检查是否能在下一步吃到该位置。
 * - 将死判断：在“被将”状态下枚举己方所有合法走子，若无则判定将死；若未被将且无合法走子则为僵局。
 */
(function () {
  /**
   * canBasicMove
   * 参数：board(Board), piece(Piece), fromRow, fromCol, toRow, toCol
   * 返回：不考虑“自陷被将/飞将”的棋子几何走法合法性
   */
  function canBasicMove(board, piece, fromRow, fromCol, toRow, toCol) {
    if (fromRow === toRow && fromCol === toCol) return false;
    if (!Utils.inBounds(toRow, toCol)) return false;
    const target = board.getPiece(toRow, toCol);
    if (target && target.side === piece.side) return false; // 不能吃己方子

    const dr = toRow - fromRow;
    const dc = toCol - fromCol;
    const adr = Math.abs(dr);
    const adc = Math.abs(dc);

    switch (piece.type) {
      case 'K': {
        // 帅：九宫内水平/垂直走一步
        if (!Utils.inPalace(toRow, toCol, piece.side)) return false;
        return (adr + adc === 1);
      }
      case 'A': {
        // 士：九宫内斜走一步
        if (!Utils.inPalace(toRow, toCol, piece.side)) return false;
        return (adr === 1 && adc === 1);
      }
      case 'E': {
        // 相：斜走两步，不可过河，中点不得有子（相眼）
        if (!(adr === 2 && adc === 2)) return false;
        const midRow = fromRow + Utils.sign(dr);
        const midCol = fromCol + Utils.sign(dc);
        if (board.getPiece(midRow, midCol)) return false; // 相眼被堵
        if (piece.side === 'red' && toRow <= 4) return false; // 红相不过河
        if (piece.side === 'black' && toRow >= 5) return false; // 黑相不过河
        return true;
      }
      case 'H': {
        // 马：日字（2+1），马腿不得被堵
        if (!((adr === 2 && adc === 1) || (adr === 1 && adc === 2))) return false;
        if (adr === 2 && adc === 1) {
          const blockRow = fromRow + Utils.sign(dr);
          if (board.getPiece(blockRow, fromCol)) return false; // 纵向马腿
        } else {
          const blockCol = fromCol + Utils.sign(dc);
          if (board.getPiece(fromRow, blockCol)) return false; // 横向马腿
        }
        return true;
      }
      case 'R': {
        // 车：直线行走，路径需无阻挡
        if (!(fromRow === toRow || fromCol === toCol)) return false;
        return Utils.pathClear(board, fromRow, fromCol, toRow, toCol);
      }
      case 'C': {
        // 炮：直线行走；不吃子时需无阻挡；吃子时必须隔一个子
        if (!(fromRow === toRow || fromCol === toCol)) return false;
        const between = Utils.countPiecesBetween(board, fromRow, fromCol, toRow, toCol);
        if (!target) {
          return between === 0; // 不吃子，必须无阻挡
        } else {
          return between === 1; // 吃子，必须隔一个子
        }
      }
      case 'S': {
        // 兵：未过河仅前进一格；过河可前进或左右一格，不可后退
        const dir = piece.side === 'red' ? -1 : 1; // 红向上，黑向下
        const crossedRiver = piece.side === 'red' ? (fromRow <= 4) : (fromRow >= 5);
        if (adr + adc !== 1) return false; // 只能走一步
        if (dr === dir && dc === 0) return true; // 前进
        if (crossedRiver && dr === 0 && Math.abs(dc) === 1) return true; // 过河后左右
        return false;
      }
      default:
        return false;
    }
  }

  /**
   * isFacingGeneral
   * 参数：board(Board)
   * 返回：两帅是否在同一列且中间无子（飞将非法态）
   */
  function isFacingGeneral(board) {
    const redK = board.getGeneralPosition('red');
    const blackK = board.getGeneralPosition('black');
    if (!redK || !blackK) return false;
    if (redK.col !== blackK.col) return false;
    const between = Utils.countPiecesBetween(board, redK.row, redK.col, blackK.row, blackK.col);
    return between === 0;
  }

  /**
   * canPieceAttackSquare
   * 参数：board, piece, fromRow, fromCol, toRow, toCol
   * 返回：该棋子是否能按走法规则攻击目标格（不考虑己方被将）
   */
  function canPieceAttackSquare(board, piece, fromRow, fromCol, toRow, toCol) {
    return canBasicMove(board, piece, fromRow, fromCol, toRow, toCol);
  }

  /**
   * isInCheck
   * 参数：board, side('red'|'black')
   * 返回：该方是否处于被将状态
   */
  function isInCheck(board, side) {
    const kingPos = board.getGeneralPosition(side);
    if (!kingPos) return false;
    const targetRow = kingPos.row;
    const targetCol = kingPos.col;
    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        const p = board.getPiece(r, c);
        if (!p || p.side === side) continue;
        if (canPieceAttackSquare(board, p, r, c, targetRow, targetCol)) {
          // 飞将也会造成被将（若敌方帅对面），但局面非法，我们仍视为危险
          return true;
        }
      }
    }
    return false;
  }

  /**
   * isLegalMove
   * 参数：board, fromRow, fromCol, toRow, toCol, side
   * 返回：该走子在完整规则下是否合法
   * 过程：先做基本几何判断 -> 模拟走子 -> 检查飞将与己方被将
   */
  function isLegalMove(board, fromRow, fromCol, toRow, toCol, side) {
    const piece = board.getPiece(fromRow, fromCol);
    if (!piece || piece.side !== side) return false;
    if (!canBasicMove(board, piece, fromRow, fromCol, toRow, toCol)) return false;
    // 模拟走子
    const nb = board.clone();
    nb.movePiece(fromRow, fromCol, toRow, toCol);
    // 飞将检查
    if (isFacingGeneral(nb)) return false;
    // 己方不得自陷被将
    if (isInCheck(nb, side)) return false;
    return true;
  }

  /**
   * getLegalMovesForPiece
   * 参数：board, row, col
   * 返回：[{row, col}] 合法落点集合
   */
  function getLegalMovesForPiece(board, row, col) {
    const piece = board.getPiece(row, col);
    if (!piece) return [];
    const side = piece.side;
    const moves = [];
    // 枚举棋盘所有格（小规模，足够快）
    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        if (isLegalMove(board, row, col, r, c, side)) moves.push({ row: r, col: c });
      }
    }
    return moves;
  }

  /**
   * generateLegalMoves
   * 参数：board, side
   * 返回：[{from:{row,col}, to:{row,col}}] 当前方所有合法着法
   */
  function generateLegalMoves(board, side) {
    const all = [];
    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        const p = board.getPiece(r, c);
        if (!p || p.side !== side) continue;
        const moves = getLegalMovesForPiece(board, r, c);
        moves.forEach(m => all.push({ from: { row: r, col: c }, to: m }));
      }
    }
    return all;
  }

  /**
   * isCheckmate
   * 参数：board, side
   * 返回：若被将且无任何合法走子，则为将死
   */
  function isCheckmate(board, side) {
    if (!isInCheck(board, side)) return false;
    const legal = generateLegalMoves(board, side);
    return legal.length === 0;
  }

  /**
   * isStalemate
   * 参数：board, side
   * 返回：未被将且无合法走子 -> 僵局
   */
  function isStalemate(board, side) {
    if (isInCheck(board, side)) return false;
    const legal = generateLegalMoves(board, side);
    return legal.length === 0;
  }

  window.Rules = {
    canBasicMove,
    isFacingGeneral,
    canPieceAttackSquare,
    isInCheck,
    isLegalMove,
    getLegalMovesForPiece,
    generateLegalMoves,
    isCheckmate,
    isStalemate,
  };
})();