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
  
  // Show the install button in the UI
  showInstallButton();
});

function showInstallButton() {
  // Look for the install button placeholder in the dashboard header
  const existing = document.getElementById('pwa-install-btn');
  if (existing) {
    existing.style.display = 'flex';
    return;
  }
  
  // If the dashboard hasn't rendered yet, wait and retry
  const observer = new MutationObserver(() => {
    const btn = document.getElementById('pwa-install-btn');
    if (btn) {
      btn.style.display = 'flex';
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  
  // Auto-disconnect after 10 seconds to avoid leaks
  setTimeout(() => observer.disconnect(), 10000);
}

// Global install handler — called by the install button in UI
window.triggerPWAInstall = async () => {
  if (!deferredInstallPrompt) return;
  
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  
  if (outcome === 'accepted') {
    // Hide the install button after successful install
    const btn = document.getElementById('pwa-install-btn');
    if (btn) btn.style.display = 'none';
  }
  
  deferredInstallPrompt = null;
};

// Hide install button if app is already installed
window.addEventListener('appinstalled', () => {
  const btn = document.getElementById('pwa-install-btn');
  if (btn) btn.style.display = 'none';
  deferredInstallPrompt = null;
});
