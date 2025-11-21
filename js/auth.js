/**
 * 前端认证模块
 * 负责登录、会话校验与角色分级显示控制。
 */
(function () {
  /**
   * login
   * 参数：username, password
   * 行为：调用服务端登录；若未启用认证，直接返回guest。
   */
  async function login(username, password) {
    try {
      if (!CONFIG.security.enableAuth) return { ok: true, role: 'guest' };
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || '登录失败');
      return data;
    } catch (err) {
      logger.error('登录失败', err);
      ErrorCenter.reportError('AUTH_FAIL', '登录失败', { reason: String(err && err.message || err) });
      return { ok: false, role: null, error: err };
    }
  }

  /** 获取当前会话 */
  async function getSession() {
    try {
      if (!CONFIG.security.enableAuth) return { ok: true, session: { role: 'guest' } };
      const res = await fetch('/api/session');
      return await res.json();
    } catch (err) {
      logger.error('会话获取失败', err);
      return { ok: false, session: null };
    }
  }

  window.Auth = { login, getSession };
})();