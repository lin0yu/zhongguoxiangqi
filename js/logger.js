/**
 * 日志模块
 * 提供统一日志记录与面板输出，支持级别过滤与简单错误处理。
 */
(function () {
  /**
   * Logger
   * 参数说明：
   * - options: { level?: 'debug'|'info'|'warn'|'error', panel?: HTMLElement }
   * 方法：debug/info/warn/error、setLevel、attachPanel、clear
   * 错误处理：在记录失败时降级仅输出到控制台
   */
  class Logger {
    constructor(options = {}) {
      this.level = options.level || 'info';
      this.panel = options.panel || null;
      this.levelOrder = { debug: 10, info: 20, warn: 30, error: 40 };
    }

    /** 设置日志级别 */
    setLevel(level) {
      if (this.levelOrder[level]) this.level = level;
    }

    /** 绑定日志面板 */
    attachPanel(panelEl) {
      this.panel = panelEl || this.panel;
    }

    /** 清空面板 */
    clear() {
      if (this.panel) this.panel.innerHTML = '';
    }

    /** 内部输出 */
    _write(level, message, data) {
      try {
        const now = new Date().toLocaleTimeString();
        const text = `[${now}] [${level}] ${message}`;
        // 控制台输出
        if (level === 'error') console.error(text, data || '');
        else if (level === 'warn') console.warn(text, data || '');
        else console.log(text, data || '');

        // 面板输出
        if (this.panel) {
          const row = document.createElement('div');
          row.className = `log-entry ${level}`;
          row.textContent = data ? `${text} ${JSON.stringify(data)}` : text;
          this.panel.appendChild(row);
          this.panel.scrollTop = this.panel.scrollHeight;
        }
      } catch (err) {
        // 面板渲染失败时降级
        console.error('[Logger] Write failure', err);
      }
    }

    /** 日志级别过滤 */
    _canLog(level) {
      return this.levelOrder[level] >= this.levelOrder[this.level];
    }

    /** 调试日志 */
    debug(message, data) {
      if (this._canLog('debug')) this._write('debug', message, data);
    }
    /** 信息日志 */
    info(message, data) {
      if (this._canLog('info')) this._write('info', message, data);
    }
    /** 警告日志 */
    warn(message, data) {
      if (this._canLog('warn')) this._write('warn', message, data);
    }
    /** 错误日志 */
    error(message, data) {
      if (this._canLog('error')) this._write('error', message, data);
    }
  }

  // 全局唯一默认 logger
  const defaultLogger = new Logger();
  window.Logger = Logger;
  window.logger = defaultLogger;
})();