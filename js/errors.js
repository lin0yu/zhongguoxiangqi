/**
 * 错误体系模块
 * 建立错误代码、上下文解决方案与自动上报。
 */
(function () {
  /** 错误代码与建议 */
  const CODE_MAP = {
    AUTH_FAIL: { level: 'warn', solution: '检查用户名/密码；联系管理员重置。' },
    SEC_DENY: { level: 'error', solution: 'IP或设备未授权；联系管理员加入白名单。' },
    NET_FAIL: { level: 'error', solution: '网络异常；稍后重试或联系内网支持。' },
    SAVE_FAIL: { level: 'error', solution: '存储失败；检查浏览器权限与磁盘空间。' },
    LOAD_FAIL: { level: 'error', solution: '读取失败；确认数据文件格式正确。' },
    RENDER_FAIL: { level: 'error', solution: '渲染异常；请刷新页面或重启浏览器。' }
  };

  /**
   * ErrorCenter
   * 方法：reportError(code, message, ctx)
   * 行为：记录错误并尝试上报到服务端
   */
  class ErrorCenter {
    static reportError(code, message, ctx = {}) {
      try {
        const meta = CODE_MAP[code] || { level: 'error', solution: '未知错误，请联系支持。' };
        logger[meta.level](`${code}: ${message}`, ctx);
        const payload = { code, message, ctx, ts: Date.now() };
        if (CONFIG.security && CONFIG.security.reportEndpoints) {
          fetch(CONFIG.security.reportEndpoints.error, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
          }).catch(() => {});
        }
        // 展示友好错误提示UI（若存在容器）
        const box = document.getElementById('errorBox');
        if (box) {
          box.innerHTML = `错误(${code})：${message}<br/>解决方案：${meta.solution}<br/>如需帮助，请联系内网支持服务台。`;
          box.style.display = 'block';
        }
      } catch (err) {
        console.error('ErrorCenter report failed', err);
      }
    }
  }

  window.ErrorCenter = ErrorCenter;
})();