/**
 * 配置管理模块
 * 用于集中管理棋盘尺寸、主题颜色、字体、存储键名等配置项。
 * 通过公开的 updateConfig 方法支持后续扩展与可配置化。
 */
(function () {
  /**
   * CONFIG 全局配置对象
   * - rows/cols: 棋盘行列数
   * - canvas: 默认画布宽高与内边距
   * - theme: 颜色与字体
   * - storageKeys: 本地存储键名
   */
  const CONFIG = {
    rows: 10,
    cols: 9,
    canvas: {
      width: 720,
      height: 800,
      padding: 24,
    },
    theme: {
      boardBg: '#f2d39b',
      boardLine: '#8b5a2b',
      riverText: '#4682b4',
      redPieceFill: '#f9e2e2',
      redPieceStroke: '#be1c1c',
      redText: '#be1c1c',
      blackPieceFill: '#eaeaea',
      blackPieceStroke: '#222',
      blackText: '#111',
      highlight: '#2c98f0',
      legalDot: '#2c98f0',
      selectStroke: '#ff8800',
      textFont: '600 20px "Microsoft YaHei", sans-serif',
      pieceFont: '700 26px "Microsoft YaHei", sans-serif',
    },
    storageKeys: {
      localState: 'xiangqi_local_state_v1',
    },
    security: {
      enableAuth: true,
      enableIpWhitelist: true,
      enableMacBinding: true,
      failedLoginAlertThreshold: 5,
      reportEndpoints: {
        error: '/api/report/error',
        perf: '/api/report/perf'
      }
    },
  };

  /**
   * updateConfig
   * 参数说明：
   * - partial: Object，局部配置覆盖项（深度合并浅实现）
   * 返回：更新后的 CONFIG 引用
   */
  function updateConfig(partial) {
    try {
      if (!partial || typeof partial !== 'object') return CONFIG;
      // 简单浅合并，避免引入复杂依赖
      for (const k in partial) {
        if (Object.prototype.hasOwnProperty.call(partial, k)) {
          if (
            typeof CONFIG[k] === 'object' && CONFIG[k] !== null &&
            typeof partial[k] === 'object' && partial[k] !== null
          ) {
            Object.assign(CONFIG[k], partial[k]);
          } else {
            CONFIG[k] = partial[k];
          }
        }
      }
    } catch (err) {
      console.error('[CONFIG] updateConfig error:', err);
    }
    return CONFIG;
  }

  // 暴露到全局
  window.CONFIG = CONFIG;
  window.updateConfig = updateConfig;
})();