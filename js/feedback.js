/**
 * 反馈模块
 * 提供多级成功提示（普通/重要/关键）、简单粒子动画与音效。
 */
(function () {
  let audioOk = null;

  /** 初始化音频资源（异步加载） */
  async function initAudio() {
    try {
      audioOk = new Audio();
      audioOk.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAZAAABAQAA'; // 极短占位音
      await audioOk.decodeAudioData?.(); // 兼容性容错
    } catch (err) {
      logger.warn('音频初始化失败', err);
    }
  }

  /**
   * showSuccess
   * 参数：level('normal'|'important'|'critical'), text
   * 行为：显示提示文本、播放音效并触发粒子动画
   */
  function showSuccess(level, text) {
    try {
      const toast = document.getElementById('successToast');
      if (!toast) return;
      toast.className = `success-toast ${level}`;
      toast.textContent = text;
      toast.style.display = 'block';
      setTimeout(() => { toast.style.display = 'none'; }, 2000);
      if (audioOk) audioOk.play().catch(() => {});
      particlesBurst(level);
    } catch (err) {
      logger.warn('成功反馈展示失败', err);
    }
  }

  /** 简易粒子爆裂动画 */
  function particlesBurst(level) {
    try {
      const canvas = document.getElementById('effectsCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width = canvas.clientWidth;
      const h = canvas.height = canvas.clientHeight;
      const count = level === 'critical' ? 80 : level === 'important' ? 40 : 20;
      const parts = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 30 + Math.random() * 30
      }));
      let frame = 0;
      function step() {
        ctx.clearRect(0, 0, w, h);
        parts.forEach(p => {
          p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life -= 1;
          ctx.fillStyle = 'rgba(44,152,240,0.7)';
          ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
        });
        frame++;
        if (frame < 60) requestAnimationFrame(step);
        else ctx.clearRect(0, 0, w, h);
      }
      requestAnimationFrame(step);
    } catch (err) {
      logger.warn('粒子动画失败', err);
    }
  }

  window.Feedback = { initAudio, showSuccess };
})();