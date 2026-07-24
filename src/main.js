// Import global stylesheet rules
import './styles/main.css';
import './styles/components.css';
import './styles/auth.css';

// Import core App coordinator
import { App } from './ui/App';

// Instantiate app on load
window.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app');
  if (root) {
    const app = new App(root);
    
    // Save reference on window for easy browser console debugging
    window.Garrytor = app;
  }
});

// ── PWA: Register Service Worker ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration failed silently — not critical
    });
  });
}

// ── PWA: Capture Install Prompt ──
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  showInstallButton();
});

function showInstallButton() {
  const btns = document.querySelectorAll('.pwa-install-btn');
  btns.forEach(btn => {
    btn.style.display = 'flex';
  });
}

// Global install handler — called by the install button in UI
window.triggerPWAInstall = async () => {
  if (window.matchMedia('(display-mode: standalone)').matches) {
    if (window.GarrytorToast) window.GarrytorToast.info('Garrytor is already installed and running as an app!');
    return;
  }
  
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      const btns = document.querySelectorAll('.pwa-install-btn');
      btns.forEach(b => b.style.display = 'none');
    }
    deferredInstallPrompt = null;
  } else {
    if (window.GarrytorToast) {
      window.GarrytorToast.info("To install: Click your browser menu (⋮ or ⎋) and select 'Install Garrytor' or 'Add to Home Screen'.");
    } else {
      alert("To install Garrytor: Click your browser menu (⋮ or ⎋) and select 'Install Garrytor' or 'Add to Home Screen'.");
    }
  }
};

// Hide install button if app is already installed
window.addEventListener('appinstalled', () => {
  const btns = document.querySelectorAll('.pwa-install-btn');
  btns.forEach(b => b.style.display = 'none');
  deferredInstallPrompt = null;
});
