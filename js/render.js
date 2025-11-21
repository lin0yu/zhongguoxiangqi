/**
 * 渲染模块（Canvas）
 * 绘制棋盘、河界与九宫、棋子与提示，支持响应式尺寸。
 */
(function () {
  let ctx = null;
  let canvas = null;
  let metrics = null; // { padding, cellW, cellH, originX, originY }

  /**
   * init
   * 参数：canvasEl
   * 行为：初始化上下文并计算度量
   */
  function init(canvasEl) {
    try {
      canvas = canvasEl;
      ctx = canvas.getContext('2d');
      computeMetrics();
    } catch (err) {
      logger.error('渲染初始化失败', err);
    }
  }

  /** 计算度量 */
  function computeMetrics() {
    const p = CONFIG.canvas.padding;
    metrics = {
      padding: p,
      originX: p,
      originY: p,
      cellW: (canvas.width - 2 * p) / (CONFIG.cols - 1),
      cellH: (canvas.height - 2 * p) / (CONFIG.rows - 1),
    };
  }

  /**
   * resizeToContainer
   * 自适应父容器宽度，保持纵横比
   */
  function resizeToContainer() {
    try {
      const parent = canvas.parentElement;
      const maxW = parent.clientWidth - 16; // 容器内边距留余量
      const aspect = CONFIG.canvas.height / CONFIG.canvas.width;
      const targetW = Math.min(maxW, CONFIG.canvas.width);
      const targetH = Math.round(targetW * aspect);
      canvas.width = targetW;
      canvas.height = targetH;
      computeMetrics();
    } catch (err) {
      logger.error('Canvas自适应失败', err);
    }
  }

  /** 将格点(row,col)转为像素坐标 */
  function gridToPixel(row, col) {
    const x = metrics.originX + metrics.cellW * col;
    const y = metrics.originY + metrics.cellH * row;
    return { x, y };
  }

  /** 获取棋子中文标签 */
  function getPieceLabel(type, side) {
    const redMap = { K: '帅', A: '仕', E: '相', H: '马', R: '车', C: '炮', S: '兵' };
    const blackMap = { K: '将', A: '士', E: '象', H: '馬', R: '車', C: '炮', S: '卒' };
    return side === 'red' ? redMap[type] : blackMap[type];
  }

  /** 画棋盘网格与河界 */
  function drawBoard() {
    try {
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = CONFIG.theme.boardBg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = CONFIG.theme.boardLine;
      ctx.lineWidth = 2;

      // 横线 10 条
      for (let r = 0; r < CONFIG.rows; r++) {
        const { x: x0, y } = gridToPixel(r, 0);
        const { x: x1 } = gridToPixel(r, CONFIG.cols - 1);
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        ctx.stroke();
      }

      // 竖线 9 条，中间列在河界处断开
      for (let c = 0; c < CONFIG.cols; c++) {
        const top = gridToPixel(0, c);
        const bottom = gridToPixel(CONFIG.rows - 1, c);
        ctx.beginPath();
        if (c === 0 || c === CONFIG.cols - 1) {
          // 两侧贯通
          ctx.moveTo(top.x, top.y);
          ctx.lineTo(bottom.x, bottom.y);
        } else {
          // 上半部分到河界上沿（行4）
          const riverTop = gridToPixel(4, c);
          const riverBottom = gridToPixel(5, c);
          ctx.moveTo(top.x, top.y);
          ctx.lineTo(riverTop.x, riverTop.y);
          ctx.stroke();
          // 下半部分从河界下沿到底部
          ctx.beginPath();
          ctx.moveTo(riverBottom.x, riverBottom.y);
          ctx.lineTo(bottom.x, bottom.y);
        }
        ctx.stroke();
      }

      // 九宫对角线
      // 黑方九宫
      drawPalaceDiagonals(0, 2, 3, 5);
      // 红方九宫
      drawPalaceDiagonals(7, 9, 3, 5);

      // 河界文字
      ctx.fillStyle = CONFIG.theme.riverText;
      ctx.font = CONFIG.theme.textFont;
      ctx.textAlign = 'center';
      const riverY = (gridToPixel(4, 4).y + gridToPixel(5, 4).y) / 2 + 10;
      ctx.fillText('楚河', gridToPixel(4, 2).x, riverY);
      ctx.fillText('汉界', gridToPixel(5, 6).x, riverY);

      ctx.restore();
    } catch (err) {
      logger.error('棋盘绘制失败', err);
    }
  }

  /** 绘制九宫对角线 */
  function drawPalaceDiagonals(rStart, rEnd, cStart, cEnd) {
    const p1 = gridToPixel(rStart, cStart);
    const p2 = gridToPixel(rEnd, cEnd);
    const p3 = gridToPixel(rStart, cEnd);
    const p4 = gridToPixel(rEnd, cStart);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.stroke();
  }

  /** 绘制棋子与提示 */
  function drawPieces(board, selection, legalMoves) {
    try {
      const radius = Math.min(metrics.cellW, metrics.cellH) * 0.38;
      for (let r = 0; r < board.rows; r++) {
        for (let c = 0; c < board.cols; c++) {
          const p = board.getPiece(r, c);
          const { x, y } = gridToPixel(r, c);
          // 选中高亮
          if (selection && selection.row === r && selection.col === c) {
            ctx.strokeStyle = CONFIG.theme.selectStroke;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
            ctx.stroke();
          }
          // 棋子
          if (p) {
            const isRed = p.side === 'red';
            ctx.fillStyle = isRed ? CONFIG.theme.redPieceFill : CONFIG.theme.blackPieceFill;
            ctx.strokeStyle = isRed ? CONFIG.theme.redPieceStroke : CONFIG.theme.blackPieceStroke;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = isRed ? CONFIG.theme.redText : CONFIG.theme.blackText;
            ctx.font = CONFIG.theme.pieceFont;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(getPieceLabel(p.type, p.side), x, y);
          }
        }
      }

      // 合法落点提示
      if (Array.isArray(legalMoves)) {
        ctx.fillStyle = CONFIG.theme.legalDot;
        legalMoves.forEach(m => {
          const { x, y } = gridToPixel(m.row, m.col);
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    } catch (err) {
      logger.error('棋子绘制失败', err);
    }
  }

  /**
   * renderAll
   * 参数：board, selection, legalMoves
   * 行为：重绘棋盘与棋子
   */
  function renderAll(board, selection, legalMoves) {
    drawBoard();
    drawPieces(board, selection, legalMoves);
  }

  window.Renderer = {
    init,
    resizeToContainer,
    gridToPixel,
    renderAll,
  };
})();