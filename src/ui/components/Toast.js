export class Toast {
  static _container = null;

  static _init() {
    if (this._container) return;

    this._container = document.createElement('div');
    this._container.className = 'toast-container';
    document.body.appendChild(this._container);
  }

  static show(message, type = 'info', duration = 3000) {
    this._init();

    // Check if a similar toast is already visible to avoid spamming the screen
    const existingToasts = Array.from(this._container.querySelectorAll('.toast'));
    const isDuplicate = existingToasts.some(t => t.querySelector('.toast-message').textContent === message);
    if (isDuplicate) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
    
    // Choose icon based on type
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-message" style="margin-right: 12px;">${message}</span>
    `;

    // Manual Close button
    const closeBtn = document.createElement('span');
    closeBtn.innerHTML = '×';
    closeBtn.className = 'toast-close-btn';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.marginLeft = 'auto';
    closeBtn.style.fontSize = '18px';
    closeBtn.style.fontWeight = 'bold';
    closeBtn.style.opacity = '0.5';
    closeBtn.style.transition = 'opacity 0.2s';
    
    closeBtn.addEventListener('mouseenter', () => closeBtn.style.opacity = '1');
    closeBtn.addEventListener('mouseleave', () => closeBtn.style.opacity = '0.5');
    
    closeBtn.addEventListener('click', () => {
      this._dismiss(toast);
    });
    
    toast.appendChild(closeBtn);
    this._container.appendChild(toast);

    // Auto dismiss
    setTimeout(() => {
      this._dismiss(toast);
    }, duration);
  }

  static _dismiss(toast) {
    if (!toast.parentNode) return;
    
    // Smooth transition
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(120%)';
    
    // Remove from DOM after transition
    setTimeout(() => {
      toast.remove();
    }, 300);
  }

  static success(message, duration = 3000) {
    this.show(message, 'success', duration);
  }

  static error(message, duration = 4000) {
    this.show(message, 'error', duration);
  }

  static info(message, duration = 2500) {
    this.show(message, 'info', duration);
  }

  static warning(message, duration = 3000) {
    this.show(message, 'warning', duration);
  }
}
