/**
 * 数据模型模块
 * 定义棋子、棋盘与初始布局，提供基础数据操作。
 */
(function () {
  /**
   * Piece 棋子
   * 字段：
   * - type: 'K'|'A'|'E'|'H'|'R'|'C'|'S' （帅/士/相/马/车/炮/兵）
   * - side: 'red'|'black'
   */
  class Piece {
    constructor(type, side) {
      this.type = type;
      this.side = side;
    }
  }

  /**
   * Board 棋盘
   * 提供：取子、落子、克隆、初始布局设置、将位置查找等。
   */
  class Board {
    constructor(rows = CONFIG.rows, cols = CONFIG.cols) {
      this.rows = rows;
      this.cols = cols;
      this.grid = Array.from({ length: rows }, () => Array(cols).fill(null));
    }

    /**
     * getPiece
     * 参数：row, col
     * 返回：指定位置棋子或 null
     */
    getPiece(row, col) {
      if (!Utils.inBounds(row, col, this.rows, this.cols)) return null;
      return this.grid[row][col];
    }

    /**
     * setPiece
     * 参数：row, col, piece(Piece|null)
     * 返回：void
     */
    setPiece(row, col, piece) {
      if (!Utils.inBounds(row, col, this.rows, this.cols)) return;
      this.grid[row][col] = piece;
    }

    /**
     * movePiece
     * 参数：fromRow, fromCol, toRow, toCol
     * 返回：{ captured?: Piece|null }
     * 错误处理：边界检查，非法坐标不抛错，仅安全返回
     */
    movePiece(fromRow, fromCol, toRow, toCol) {
      if (!Utils.inBounds(fromRow, fromCol, this.rows, this.cols)) return { captured: null };
      if (!Utils.inBounds(toRow, toCol, this.rows, this.cols)) return { captured: null };
      const piece = this.getPiece(fromRow, fromCol);
      const captured = this.getPiece(toRow, toCol);
      this.setPiece(toRow, toCol, piece);
      this.setPiece(fromRow, fromCol, null);
      return { captured };
    }

    /**
     * clone
     * 返回：棋盘的深拷贝副本
     */
    clone() {
      const b = new Board(this.rows, this.cols);
      b.grid = this.grid.map(row => row.map(cell => cell ? new Piece(cell.type, cell.side) : null));
      return b;
    }

    /**
     * getGeneralPosition
     * 参数：side('red'|'black')
     * 返回：{ row, col }或 null
     */
    getGeneralPosition(side) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const p = this.grid[r][c];
          if (p && p.type === 'K' && p.side === side) return { row: r, col: c };
        }
      }
      return null;
    }

    /**
     * setupInitial
     * 设置标准中国象棋初始布局。
     */
    setupInitial() {
      try {
        // 清空棋盘
        for (let r = 0; r < this.rows; r++) {
          for (let c = 0; c < this.cols; c++) this.grid[r][c] = null;
        }

        // 黑方
        this.setPiece(0, 0, new Piece('R', 'black'));
        this.setPiece(0, 1, new Piece('H', 'black'));
        this.setPiece(0, 2, new Piece('E', 'black'));
        this.setPiece(0, 3, new Piece('A', 'black'));
        this.setPiece(0, 4, new Piece('K', 'black'));
        this.setPiece(0, 5, new Piece('A', 'black'));
        this.setPiece(0, 6, new Piece('E', 'black'));
        this.setPiece(0, 7, new Piece('H', 'black'));
        this.setPiece(0, 8, new Piece('R', 'black'));

        this.setPiece(2, 1, new Piece('C', 'black'));
        this.setPiece(2, 7, new Piece('C', 'black'));

        this.setPiece(3, 0, new Piece('S', 'black'));
        this.setPiece(3, 2, new Piece('S', 'black'));
        this.setPiece(3, 4, new Piece('S', 'black'));
        this.setPiece(3, 6, new Piece('S', 'black'));
        this.setPiece(3, 8, new Piece('S', 'black'));

        // 红方
        this.setPiece(9, 0, new Piece('R', 'red'));
        this.setPiece(9, 1, new Piece('H', 'red'));
        this.setPiece(9, 2, new Piece('E', 'red'));
        this.setPiece(9, 3, new Piece('A', 'red'));
        this.setPiece(9, 4, new Piece('K', 'red'));
        this.setPiece(9, 5, new Piece('A', 'red'));
        this.setPiece(9, 6, new Piece('E', 'red'));
        this.setPiece(9, 7, new Piece('H', 'red'));
        this.setPiece(9, 8, new Piece('R', 'red'));

        this.setPiece(7, 1, new Piece('C', 'red'));
        this.setPiece(7, 7, new Piece('C', 'red'));

        this.setPiece(6, 0, new Piece('S', 'red'));
        this.setPiece(6, 2, new Piece('S', 'red'));
        this.setPiece(6, 4, new Piece('S', 'red'));
        this.setPiece(6, 6, new Piece('S', 'red'));
        this.setPiece(6, 8, new Piece('S', 'red'));
      } catch (err) {
        logger.error('初始化布局失败', err);
      }
    }
  }

  window.Piece = Piece;
  window.Board = Board;
})();