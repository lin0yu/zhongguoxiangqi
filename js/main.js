/**
 * 入口模块
 * 负责页面交互绑定与整体初始化。
 */
(function () {
  let engine = null;
  let canvas = null;
  let turnStatus = null;
  let checkStatus = null;
  let gameStatus = null;
  let loginOverlay = null;
  // 轻量本地缓存：保存当前选中棋子的合法落点，避免重复计算
  let legalCache = { key: null, moves: null };

  /**
   * 异步更新性能看板
   *
   * 说明：将性能看板的刷新延后到空闲或下一事件循环，避免占用关键交互路径，确保响应 < 300ms。
   */
  function scheduleMetricsUpdate() {
    try {
      const fn = () => {
        try { Metrics.updateDashboard(); } catch (e) { logger.error('性能看板更新失败', e); }
      };
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(fn, { timeout: 200 });
      } else {
        setTimeout(fn, 0);
      }
    } catch (err) {
      logger.error('性能看板更新调度失败', err);
    }
  }

  /**
   * initApp
   * 初始化应用：绑定DOM、渲染器、引擎与事件。
   */
  function initApp() {
    try {
      canvas = document.getElementById('boardCanvas');
      loginOverlay = document.getElementById('loginOverlay');
      turnStatus = document.getElementById('turnStatus');
      checkStatus = document.getElementById('checkStatus');
      gameStatus = document.getElementById('gameStatus');
      logger.attachPanel(document.getElementById('logPanel'));

      Renderer.init(canvas);
      Renderer.resizeToContainer();
      bindEvents();
      Feedback.initAudio();
      initAuthFlow();
      logger.info('应用初始化完成');
    } catch (err) {
      logger.error('应用初始化失败', err);
    }
  }

  /**
   * 渲染当前状态
   *
   * 功能：绘制棋盘与棋子，显示选中高亮与合法落点提示。
   * 性能优化：对“当前选中棋子的合法落点”进行一次性内存缓存，避免同一选择周期内重复计算。
   * 错误处理：渲染异常将记录日志并不中断交互。
   */
  function renderNow() {
    try {
      // 基于选中点和当前行方构造缓存键
      const sel = engine.selected;
      const key = sel ? `${sel.row},${sel.col}-${engine.sideToMove}` : 'none';
      let legal = null;
      if (legalCache.key === key && Array.isArray(legalCache.moves)) {
        legal = legalCache.moves;
      } else {
        legal = engine.getLegalMovesOfSelection();
        legalCache = { key, moves: legal };
      }
      Renderer.renderAll(engine.board, engine.selected, legal);
    } catch (err) {
      logger.error('渲染失败', err);
    }
  }

  /** 更新状态文本 */
  function updateStatus() {
    try {
      turnStatus.textContent = `回合：${engine.sideToMove === 'red' ? '红方' : '黑方'}`;
      const st = engine.getStatus();
      checkStatus.textContent = st.inCheck ? '（被将）' : '';
      gameStatus.textContent = st.gameOver ? `结果：${st.gameOverReason}` : '';
    } catch (err) {
      logger.error('状态更新失败', err);
    }
  }

  /** 将点击坐标转换为棋盘格点 */
  function pixelToGrid(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // 由于canvas缩放，需换算到实际canvas坐标
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = x * scaleX;
    const cy = y * scaleY;
    // 使用Renderer内部度量转格点
    // grid坐标在等距网格上，取最近交点
    const p = CONFIG.canvas.padding;
    const cellW = (canvas.width - 2 * p) / (CONFIG.cols - 1);
    const cellH = (canvas.height - 2 * p) / (CONFIG.rows - 1);
    const col = Math.round((cx - p) / cellW);
    const row = Math.round((cy - p) / cellH);
    return {
      row: Math.max(0, Math.min(CONFIG.rows - 1, row)),
      col: Math.max(0, Math.min(CONFIG.cols - 1, col)),
    };
  }

  /** 绑定事件 */
  function bindEvents() {
    try {
      // Canvas点击
      canvas.addEventListener('click', (e) => {
        // 点击可能改变选中或走子，先清理缓存
        legalCache = { key: null, moves: null };
        const g = pixelToGrid(e);
        const ok = engine.selectSquare(g.row, g.col);
        if (ok) {
          const t0 = performance.now();
          renderNow();
          updateStatus();
          const t1 = performance.now();
          Metrics.recordMetric('clickToRender', Math.round(t1 - t0));
          scheduleMetricsUpdate();
          const st = engine.getStatus();
          if (st.gameOver) {
            Feedback.showSuccess('critical', st.gameOverReason);
          }
        } else {
          // 无效点击也重绘以更新提示
          renderNow();
        }
      });

      // 窗口尺寸变化
      window.addEventListener('resize', () => {
        Renderer.resizeToContainer();
        renderNow();
      });

      // 控件绑定
      document.getElementById('newGameBtn').addEventListener('click', () => {
        engine.newGame();
        legalCache = { key: null, moves: null };
        renderNow();
        updateStatus();
      });
      document.getElementById('undoBtn').addEventListener('click', () => {
        engine.undo();
        legalCache = { key: null, moves: null };
        renderNow();
        updateStatus();
      });
      document.getElementById('redoBtn').addEventListener('click', () => {
        engine.redo();
        legalCache = { key: null, moves: null };
        renderNow();
        updateStatus();
      });
      document.getElementById('saveLocalBtn').addEventListener('click', () => {
        StorageAdapter.saveToLocalStorage(engine);
      });
      document.getElementById('loadLocalBtn').addEventListener('click', () => {
        StorageAdapter.loadFromLocalStorage(engine);
        legalCache = { key: null, moves: null };
        renderNow();
        updateStatus();
      });
      document.getElementById('exportBtn').addEventListener('click', () => {
        StorageAdapter.exportToFile(engine);
      });
      document.getElementById('importFile').addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          const ok = await StorageAdapter.importFromFile(file, engine);
          if (ok) {
            legalCache = { key: null, moves: null };
            renderNow();
            updateStatus();
            scheduleMetricsUpdate();
          }
        }
      });
      // 登录按钮
      const loginBtn = document.getElementById('loginBtn');
      if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
          const u = document.getElementById('loginUser').value.trim();
          const p = document.getElementById('loginPass').value;
          const t0 = performance.now();
          const res = await Auth.login(u, p);
          const t1 = performance.now();
          Metrics.recordMetric('clickToRender', Math.round(t1 - t0));
          if (res.ok) {
            loginOverlay.style.display = 'none';
            Feedback.showSuccess('important', '登录成功，欢迎使用中国象棋');
            window.USER_ROLE = res.role;
            const perfWrap = document.querySelector('.perf');
            if (perfWrap) perfWrap.style.display = (res.role === 'admin') ? 'block' : 'none';
            startGame();
          } else {
            ErrorCenter.reportError('AUTH_FAIL', '登录失败', { user: u });
          }
          scheduleMetricsUpdate();
        });
      }
    } catch (err) {
      logger.error('事件绑定失败', err);
    }
  }

  /**
   * startGame
   * 启动对局并渲染状态
   */
  function startGame() {
    engine = new GameEngine();
    legalCache = { key: null, moves: null };
    renderNow();
    updateStatus();
    scheduleMetricsUpdate();
  }

  /**
   * initAuthFlow
   * 认证流程初始化：启用时显示登录覆盖，否则直接进入游戏
   */
  /**
   * 初始化认证流程
   *
   * 说明：根据 `CONFIG.security.enableAuth` 判断是否需要显示登录覆盖层。
   * - 启用认证时：展示登录覆盖层并隐藏性能看板，待管理员登录后再显示。
   * - 未启用认证时：直接启动游戏。
   *
   * 错误处理：任何异常会记录到 `logger` 并通过错误中心上报（如可用），同时保证不阻塞后续渲染。
   */
  async function initAuthFlow() {
    try {
      if (CONFIG.security.enableAuth) {
        loginOverlay.style.display = 'flex';
        const perfWrap = document.querySelector('.perf');
        if (perfWrap) perfWrap.style.display = 'none';
      } else {
        startGame();
      }
    } catch (err) {
      logger.error('认证流程初始化失败', err);
    }
  }

  // 启动
  window.addEventListener('DOMContentLoaded', initApp);
})();