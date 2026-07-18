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
