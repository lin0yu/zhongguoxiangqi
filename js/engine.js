/**
 * 引擎模块
 * 管理整局状态：当前棋盘、回合方、选择与走子、悔棋/重做、胜负判定。
 */
(function () {
  /**
   * GameEngine
   * 方法：
   * - newGame(): 新开一局
   * - selectSquare(row, col): 选择或执行走子
   * - getLegalMovesOfSelection(): 当前选中棋子的合法落点
   * - undo()/redo(): 悔棋/重做
   * - getStatus(): 获取状态（被将、将死、僵局）
   */
  class GameEngine {
    constructor() {
      this.board = new Board();
      this.sideToMove = 'red';
      this.selected = null; // { row, col }
      this.history = []; // 存储克隆棋盘与当前方
      this.redoStack = [];
      this.gameOver = false;
      this.gameOverReason = '';
      this.newGame();
    }

    /**
     * newGame
     * 说明：重置棋盘与状态，开局为红方先
     */
    newGame() {
      try {
        this.board.setupInitial();
        this.sideToMove = 'red';
        this.selected = null;
        this.history = [];
        this.redoStack = [];
        this.gameOver = false;
        this.gameOverReason = '';
        logger.info('新开一局');
      } catch (err) {
        logger.error('新开一局失败', err);
      }
    }

    /**
     * getLegalMovesOfSelection
     * 返回：当前选中棋子的合法落点集合，用于渲染提示
     */
    getLegalMovesOfSelection() {
      if (!this.selected) return [];
      const { row, col } = this.selected;
      return Rules.getLegalMovesForPiece(this.board, row, col);
    }

    /**
     * selectSquare
     * 参数：row, col
     * 行为：
     * - 若点击己方棋子 => 选中该子
     * - 若已选中并点击合法落点 => 执行走子
     */
    selectSquare(row, col) {
      try {
        if (this.gameOver) return false;
        const clicked = this.board.getPiece(row, col);
        if (clicked && clicked.side === this.sideToMove) {
          this.selected = { row, col };
          logger.info('选中棋子', { row, col, type: clicked.type, side: clicked.side });
          return true;
        }
        if (this.selected) {
          const { row: sr, col: sc } = this.selected;
          if (Rules.isLegalMove(this.board, sr, sc, row, col, this.sideToMove)) {
            // 执行走子并入历史
            const before = this.board.clone();
            const moveRes = this.board.movePiece(sr, sc, row, col);
            const after = this.board.clone();
            this.history.push({ before, after, side: this.sideToMove });
            this.redoStack = []; // 清空重做栈
            logger.info('走子成功', { from: { row: sr, col: sc }, to: { row, col }, captured: !!moveRes.captured });

            // 回合切换
            this.sideToMove = this.sideToMove === 'red' ? 'black' : 'red';
            this.selected = null;

            // 胜负判定
            const enemy = this.sideToMove;
            const inCheck = Rules.isInCheck(this.board, enemy);
            const checkmate = Rules.isCheckmate(this.board, enemy);
            const stalemate = Rules.isStalemate(this.board, enemy);
            if (checkmate) {
              this.gameOver = true;
              this.gameOverReason = `${enemy === 'red' ? '红方' : '黑方'}被将死，${enemy === 'red' ? '黑方' : '红方'}胜！`;
              logger.info('对局结束', { reason: this.gameOverReason });
            } else if (stalemate) {
              this.gameOver = true;
              this.gameOverReason = '双方僵局，无合法着法。';
              logger.info('对局结束', { reason: this.gameOverReason });
            } else if (inCheck) {
              logger.warn(`${enemy === 'red' ? '红方' : '黑方'}被将！`);
            }
            return true;
          } else {
            logger.warn('非法走子', { from: this.selected, to: { row, col } });
            return false;
          }
        }
        return false;
      } catch (err) {
        logger.error('选择/走子失败', err);
        return false;
      }
    }

    /** 悔棋 */
    undo() {
      try {
        if (!this.history.length) return false;
        const last = this.history.pop();
        this.redoStack.push({ before: last.before, after: last.after, side: last.side });
        this.board = last.before.clone();
        this.sideToMove = last.side; // 回合回退到执行走子前方
        this.selected = null;
        this.gameOver = false;
        this.gameOverReason = '';
        logger.info('悔棋成功');
        return true;
      } catch (err) {
        logger.error('悔棋失败', err);
        return false;
      }
    }

    /** 重做 */
    redo() {
      try {
        if (!this.redoStack.length) return false;
        const next = this.redoStack.pop();
        this.board = next.after.clone();
        // 重做后切换到对方
        this.sideToMove = next.side === 'red' ? 'black' : 'red';
        this.selected = null;
        logger.info('重做成功');
        return true;
      } catch (err) {
        logger.error('重做失败', err);
        return false;
      }
    }

    /** 获取当前状态 */
    getStatus() {
      try {
        const enemy = this.sideToMove;
        const inCheck = Rules.isInCheck(this.board, enemy);
        const checkmate = Rules.isCheckmate(this.board, enemy);
        const stalemate = Rules.isStalemate(this.board, enemy);
        return { inCheck, checkmate, stalemate, gameOver: this.gameOver, gameOverReason: this.gameOverReason };
      } catch (err) {
        logger.error('状态计算失败', err);
        return { inCheck: false, checkmate: false, stalemate: false, gameOver: false, gameOverReason: '' };
      }
    }
  }

  window.GameEngine = GameEngine;
})();