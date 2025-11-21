/**
 * 工具函数模块
 * 提供坐标转换、路径检查与通用辅助方法，避免重复代码。
 */
(function () {
  /**
   * toKey
   * 参数：row(行), col(列)
   * 返回：用于Map或历史记录的唯一键
   */
  function toKey(row, col) {
    return `${row},${col}`;
  }

  /**
   * inBounds
   * 参数：row, col, rows, cols
   * 返回：是否在棋盘范围内
   */
  function inBounds(row, col, rows = CONFIG.rows, cols = CONFIG.cols) {
    return row >= 0 && row < rows && col >= 0 && col < cols;
  }

  /**
   * countPiecesBetween
   * 参数：board, fromRow, fromCol, toRow, toCol
   * 返回：直线（同列或同行）之间的棋子数量；若非直线返回-1
   * 说明：用于炮与飞将判定等。
   */
  function countPiecesBetween(board, fromRow, fromCol, toRow, toCol) {
    if (fromRow === toRow) {
      const step = fromCol < toCol ? 1 : -1;
      let cnt = 0;
      for (let c = fromCol + step; c !== toCol; c += step) {
        if (board.getPiece(fromRow, c)) cnt++;
      }
      return cnt;
    } else if (fromCol === toCol) {
      const step = fromRow < toRow ? 1 : -1;
      let cnt = 0;
      for (let r = fromRow + step; r !== toRow; r += step) {
        if (board.getPiece(r, fromCol)) cnt++;
      }
      return cnt;
    }
    return -1;
  }

  /**
   * pathClear
   * 参数：board, fromRow, fromCol, toRow, toCol
   * 返回：若水平或垂直直线无阻挡则为 true
   */
  function pathClear(board, fromRow, fromCol, toRow, toCol) {
    const between = countPiecesBetween(board, fromRow, fromCol, toRow, toCol);
    return between === 0;
  }

  /**
   * inPalace
   * 参数：row, col, side('red'|'black')
   * 返回：该坐标是否在对应一方的九宫格内
   */
  function inPalace(row, col, side) {
    if (col < 3 || col > 5) return false;
    if (side === 'red') {
      return row >= 7 && row <= 9;
    } else {
      return row >= 0 && row <= 2;
    }
  }

  /**
   * sign
   * 返回：-1/0/1，用于方向计算
   */
  function sign(n) { return n === 0 ? 0 : n > 0 ? 1 : -1; }

  /**
   * deepClone
   * 简单深拷贝（仅适用于本项目数据结构）
   */
  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  window.Utils = {
    toKey,
    inBounds,
    countPiecesBetween,
    pathClear,
    inPalace,
    sign,
    deepClone,
  };
})();