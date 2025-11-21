/**
 * 存储模块
 * 提供本地存储保存/读取、JSON文件导出/导入。
 */
(function () {
  /**
   * serializeEngine
   * 参数：engine(GameEngine)
   * 返回：可序列化对象 { sideToMove, grid }
   * 说明：仅保存必要对局信息，避免历史造成文件膨胀。
   */
  function serializeEngine(engine) {
    try {
      const grid = engine.board.grid.map(row => row.map(cell => cell ? { t: cell.type, s: cell.side } : null));
      return { sideToMove: engine.sideToMove, grid };
    } catch (err) {
      logger.error('序列化失败', err);
      return null;
    }
  }

  /**
   * applyToEngine
   * 参数：data, engine
   * 行为：将数据应用到引擎（重建棋盘），清空历史与状态。
   */
  function applyToEngine(data, engine) {
    try {
      if (!data || !Array.isArray(data.grid)) throw new Error('无效的存档数据');
      const b = new Board();
      for (let r = 0; r < b.rows; r++) {
        for (let c = 0; c < b.cols; c++) {
          const cell = data.grid[r][c];
          b.grid[r][c] = cell ? new Piece(cell.t, cell.s) : null;
        }
      }
      engine.board = b;
      engine.sideToMove = data.sideToMove === 'black' ? 'black' : 'red';
      engine.selected = null;
      engine.history = [];
      engine.redoStack = [];
      engine.gameOver = false;
      engine.gameOverReason = '';
      logger.info('读取对局成功');
      return true;
    } catch (err) {
      logger.error('应用存档失败', err);
      return false;
    }
  }

  /** 保存到localStorage */
  function saveToLocalStorage(engine) {
    try {
      const data = serializeEngine(engine);
      if (!data) return false;
      localStorage.setItem(CONFIG.storageKeys.localState, JSON.stringify(data));
      logger.info('已保存到本地存储');
      return true;
    } catch (err) {
      logger.error('本地存储保存失败', err);
      return false;
    }
  }

  /** 从localStorage读取 */
  function loadFromLocalStorage(engine) {
    try {
      const raw = localStorage.getItem(CONFIG.storageKeys.localState);
      if (!raw) throw new Error('未找到本地存储记录');
      const data = JSON.parse(raw);
      return applyToEngine(data, engine);
    } catch (err) {
      logger.error('本地存储读取失败', err);
      return false;
    }
  }

  /** 导出为文件 */
  function exportToFile(engine, filename = 'xiangqi_state.json') {
    try {
      const data = serializeEngine(engine);
      if (!data) return false;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      logger.info('已导出JSON文件');
      return true;
    } catch (err) {
      logger.error('导出失败', err);
      return false;
    }
  }

  /** 从文件导入 */
  function importFromFile(file, engine) {
    return new Promise((resolve) => {
      try {
        const reader = new FileReader();
        reader.onerror = () => {
          logger.error('文件读取失败');
          resolve(false);
        };
        reader.onload = () => {
          try {
            const data = JSON.parse(reader.result);
            const ok = applyToEngine(data, engine);
            resolve(ok);
          } catch (err) {
            logger.error('导入解析失败', err);
            resolve(false);
          }
        };
        reader.readAsText(file);
      } catch (err) {
        logger.error('导入失败', err);
        resolve(false);
      }
    });
  }

  window.StorageAdapter = {
    serializeEngine,
    applyToEngine,
    saveToLocalStorage,
    loadFromLocalStorage,
    exportToFile,
    importFromFile,
  };
})();