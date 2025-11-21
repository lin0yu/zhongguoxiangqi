/**
 * 性能监控模块
 * 采集关键交互耗时，提供看板数据并上报服务端。
 */
(function () {
  const store = {
    clickToRender: [],
    moveDecision: [],
  };

  /** 记录指标 */
  function recordMetric(name, value) {
    try {
      if (!store[name]) store[name] = [];
      store[name].push(value);
      // 上报（异步）
      if (CONFIG.security && CONFIG.security.reportEndpoints) {
        fetch(CONFIG.security.reportEndpoints.perf, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, value, ts: Date.now() })
        }).catch(() => {});
      }
    } catch (err) {
      logger.warn('性能指标记录失败', err);
    }
  }

  /** 获取聚合结果 */
  function getSummary() {
    function avg(arr) { return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0; }
    return {
      clickToRenderAvg: avg(store.clickToRender),
      moveDecisionAvg: avg(store.moveDecision),
    };
  }

  /** 更新看板UI */
  function updateDashboard() {
    const box = document.getElementById('perfBox');
    if (!box) return;
    const s = getSummary();
    box.innerHTML = `点击到渲染平均耗时：${s.clickToRenderAvg}ms<br/>走子判定平均耗时：${s.moveDecisionAvg}ms`;
  }

  window.Metrics = { recordMetric, getSummary, updateDashboard };
})();