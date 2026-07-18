import { signInWithEmail, signUpWithEmail, signInWithGoogle } from '../../supabase/auth';
import { Toast } from '../components/Toast';

export class AuthPage {
  constructor(container, onLoginSuccess) {
    this.container = container;
    this.onLoginSuccess = onLoginSuccess;
    this.isLoginMode = true; // toggles between login and signup
    
    this.init();
  }

  init() {
    this.container.innerHTML = '';
    
    const wrapper = document.createElement('div');
    wrapper.className = 'auth-container fade-in';

    const card = document.createElement('div');
    card.className = 'auth-card';
    
    wrapper.appendChild(card);
    this.container.appendChild(wrapper);
    this.card = card;

    this.renderForm();
  }

  renderForm() {
    this.card.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'auth-header';
    header.innerHTML = `
      <div class="auth-logo">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="url(#aperture-grad)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 6px rgba(255, 140, 66, 0.45));">
          <defs>
            <linearGradient id="aperture-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ff8c42" />
              <stop offset="100%" stop-color="#ff3e55" />
            </linearGradient>
          </defs>
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="14.31" y1="8" x2="20.05" y2="17.94"></line>
          <line x1="9.69" y1="8" x2="21.17" y2="8"></line>
          <line x1="7.38" y1="12" x2="13.12" y2="2.06"></line>
          <line x1="9.69" y1="16" x2="3.95" y2="6.06"></line>
          <line x1="14.31" y1="16" x2="2.83" y2="16"></line>
          <line x1="16.62" y1="12" x2="10.88" y2="21.94"></line>
        </svg>
        <span class="brand-glow">Garrytor</span>
      </div>
      <div class="auth-tagline">${this.isLoginMode ? 'Sign in to access your photo studio' : 'Create an account to save your projects'}</div>
    `;
    this.card.appendChild(header);

    // Form Container
    const form = document.createElement('form');
    form.className = 'auth-form';
    
    // Display Name (only in signup mode)
    if (!this.isLoginMode) {
      const nameGroup = this._createFormGroup('Display Name', 'text', 'displayName', 'John Doe');
      form.appendChild(nameGroup);
    }

    // Email
    const emailGroup = this._createFormGroup('Email Address', 'email', 'email', 'name@example.com');
    form.appendChild(emailGroup);

    // Password
    const passwordGroup = this._createFormGroup('Password', 'password', 'password', '••••••••');
    form.appendChild(passwordGroup);

    // Error Box (hidden initially)
    const errorBox = document.createElement('div');
    errorBox.className = 'auth-error';
    errorBox.style.display = 'none';
    form.appendChild(errorBox);

    // Submit Button
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn btn-primary';
    submitBtn.style.padding = '12px';
    submitBtn.style.justifyContent = 'center';
    submitBtn.textContent = this.isLoginMode ? 'Sign In' : 'Create Account';
    form.appendChild(submitBtn);

    this.card.appendChild(form);

    // Divider
    const divider = document.createElement('div');
    divider.className = 'auth-divider';
    divider.textContent = 'or';
    this.card.appendChild(divider);

    // Google Sign In
    const googleBtn = document.createElement('button');
    googleBtn.type = 'button';
    googleBtn.className = 'btn btn-google';
    googleBtn.style.padding = '12px';
    googleBtn.innerHTML = `
      <svg style="width: 18px; height: 18px;" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Continue with Google
    `;
    googleBtn.addEventListener('click', async () => {
      submitBtn.disabled = true;
      googleBtn.disabled = true;
      const { data, error } = await signInWithGoogle();
      if (error) {
        errorBox.textContent = error.message;
        errorBox.style.display = 'block';
        submitBtn.disabled = false;
        googleBtn.disabled = false;
      } else {
        Toast.success('Welcome to Garrytor!');
        if (this.onLoginSuccess) this.onLoginSuccess(data.user);
      }
    });
    this.card.appendChild(googleBtn);

    // Switch Mode footer link
    const footer = document.createElement('div');
    footer.className = 'auth-switch';
    footer.innerHTML = this.isLoginMode
      ? `Don't have an account? <span class="auth-switch-link">Sign Up</span>`
      : `Already have an account? <span class="auth-switch-link">Sign In</span>`;
    
    footer.querySelector('.auth-switch-link').addEventListener('click', () => {
      this.isLoginMode = !this.isLoginMode;
      this.renderForm();
    });
    
    this.card.appendChild(footer);

    // Submit Handler
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = form.querySelector('#email').value.trim();
      const password = form.querySelector('#password').value;
      const displayName = !this.isLoginMode ? form.querySelector('#displayName').value.trim() : '';

      if (!email || !password) {
        errorBox.textContent = 'Please fill out all fields.';
        errorBox.style.display = 'block';
        return;
      }

      submitBtn.disabled = true;
      googleBtn.disabled = true;
      errorBox.style.display = 'none';

      let result;
      if (this.isLoginMode) {
        result = await signInWithEmail(email, password);
      } else {
        if (!displayName) {
          errorBox.textContent = 'Display name is required.';
          errorBox.style.display = 'block';
          submitBtn.disabled = false;
          googleBtn.disabled = false;
          return;
        }
        result = await signUpWithEmail(email, password, displayName);
      }

      const { data, error } = result;
      if (error) {
        errorBox.textContent = error.message;
        errorBox.style.display = 'block';
        submitBtn.disabled = false;
        googleBtn.disabled = false;
      } else {
        Toast.success(this.isLoginMode ? 'Welcome back!' : 'Account created successfully!');
        if (this.onLoginSuccess) this.onLoginSuccess(data.user);
      }
    });
  }

  // Create standard text fields
  _createFormGroup(labelText, type, id, placeholder) {
    const group = document.createElement('div');
    group.className = 'form-group';

    const label = document.createElement('label');
    label.className = 'form-label';
    label.setAttribute('for', id);
    label.textContent = labelText;

    const input = document.createElement('input');
    input.type = type;
    input.id = id;
    input.className = 'form-input';
    input.placeholder = placeholder;
    input.required = true;

    group.appendChild(label);
    group.appendChild(input);
    return group;
  }
}
