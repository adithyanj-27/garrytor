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

// ── PWA: Check If Running as Installed App ──
window.isPWAInstalled = () => {
  return window.matchMedia('(display-mode: standalone)').matches || 
         window.navigator.standalone === true;
};

// Clean up any stale localStorage flag from previous sessions
try { localStorage.removeItem('garrytor_pwa_installed'); } catch (e) {}

// ── PWA: Capture Install Prompt ──
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  showInstallButton();
});

function showInstallButton() {
  if (window.isPWAInstalled()) return;
  const btns = document.querySelectorAll('.pwa-install-btn');
  btns.forEach(btn => {
    btn.style.display = 'flex';
  });
}

// Global install handler — called by the install button in UI
window.triggerPWAInstall = async () => {
  if (window.isPWAInstalled()) {
    if (window.GarrytorToast) window.GarrytorToast.info('Garrytor is already running as an installed desktop app!');
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
    const msg = "To install Garrytor: Click the Install icon (⤓) in your browser address bar, or click Menu (⋮) → 'Install Garrytor'.";
    if (window.GarrytorToast) {
      window.GarrytorToast.info(msg);
    } else {
      alert(msg);
    }
  }
};

// Hide install button when app installation completes
window.addEventListener('appinstalled', () => {
  const btns = document.querySelectorAll('.pwa-install-btn');
  btns.forEach(b => b.style.display = 'none');
  deferredInstallPrompt = null;
});
