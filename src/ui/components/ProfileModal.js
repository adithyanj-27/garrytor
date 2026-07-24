import { getUserDisplayName, signOut } from '../../supabase/auth';
import { getProjects } from '../../supabase/database';
import { Toast } from './Toast';
import { Icons } from './Icons';

export class ProfileModal {
  constructor(user, options = {}) {
    this.user = user || { isGuest: true, email: 'Guest User' };
    this.onSignOut = options.onSignOut || null;
    this.onUpdateUser = options.onUpdateUser || null;

    this.overlay = null;
  }

  async open() {
    this.close(); // remove any existing modal

    const displayName = getUserDisplayName(this.user);
    const initial = displayName.charAt(0).toUpperCase() || 'U';
    const email = this.user.email || 'Guest Session';
    const isGuest = !!this.user.isGuest;

    // Fetch projects count
    let projectCount = 0;
    if (!isGuest && this.user.id) {
      const { data } = await getProjects(this.user.id);
      projectCount = data ? data.length : 0;
    } else {
      const local = JSON.parse(localStorage.getItem('garrytor_projects') || '[]');
      projectCount = local.length;
    }

    // Create backdrop overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
    overlay.style.backdropFilter = 'blur(12px)';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '20px';

    // Modal Card
    const card = document.createElement('div');
    card.className = 'profile-modal-card';
    card.style.backgroundColor = 'var(--bg-secondary)';
    card.style.border = '1px solid var(--border-color)';
    card.style.borderRadius = 'var(--radius-lg)';
    card.style.padding = '28px';
    card.style.width = '100%';
    card.style.maxWidth = '420px';
    card.style.boxShadow = 'var(--shadow-lg)';
    card.style.position = 'relative';
    card.style.fontFamily = 'var(--font-family)';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-ghost btn-icon';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '16px';
    closeBtn.style.right = '16px';
    closeBtn.innerHTML = '✕';
    closeBtn.style.fontSize = '18px';
    closeBtn.style.lineHeight = '1';
    closeBtn.addEventListener('click', () => this.close());
    card.appendChild(closeBtn);

    // Profile Header: Large Avatar + Name
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.flexDirection = 'column';
    header.style.alignItems = 'center';
    header.style.textAlign = 'center';
    header.style.marginBottom = '24px';

    const avatar = document.createElement('div');
    avatar.style.width = '72px';
    avatar.style.height = '72px';
    avatar.style.borderRadius = '50%';
    avatar.style.background = 'linear-gradient(135deg, var(--accent-color) 0%, #ff3e55 100%)';
    avatar.style.color = '#fff';
    avatar.style.fontSize = '32px';
    avatar.style.fontWeight = '700';
    avatar.style.display = 'flex';
    avatar.style.alignItems = 'center';
    avatar.style.justifyContent = 'center';
    avatar.style.marginBottom = '12px';
    avatar.style.boxShadow = '0 0 16px var(--accent-glow)';
    avatar.textContent = initial;
    header.appendChild(avatar);

    const nameRow = document.createElement('div');
    nameRow.style.display = 'flex';
    nameRow.style.alignItems = 'center';
    nameRow.style.gap = '8px';

    const nameText = document.createElement('h2');
    nameText.style.fontSize = '20px';
    nameText.style.fontWeight = '700';
    nameText.style.color = 'var(--text-primary)';
    nameText.style.margin = '0';
    nameText.textContent = displayName;
    nameRow.appendChild(nameText);

    header.appendChild(nameRow);

    const emailText = document.createElement('div');
    emailText.style.fontSize = '13px';
    emailText.style.color = 'var(--text-secondary)';
    emailText.style.marginTop = '4px';
    emailText.textContent = email;
    header.appendChild(emailText);

    // Member Badge
    const badge = document.createElement('div');
    badge.style.display = 'inline-block';
    badge.style.marginTop = '10px';
    badge.style.padding = '4px 12px';
    badge.style.borderRadius = '20px';
    badge.style.fontSize = '12px';
    badge.style.fontWeight = '600';
    badge.style.backgroundColor = isGuest ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 140, 66, 0.15)';
    badge.style.border = isGuest ? '1px solid var(--border-color)' : '1px solid rgba(255, 140, 66, 0.3)';
    badge.style.color = isGuest ? 'var(--text-secondary)' : 'var(--accent-color)';
    badge.textContent = isGuest ? 'Guest Mode' : 'Pro Studio Account';
    header.appendChild(badge);

    card.appendChild(header);

    // Divider
    const hr = document.createElement('div');
    hr.style.height = '1px';
    hr.style.backgroundColor = 'var(--border-color)';
    hr.style.marginBottom = '20px';
    card.appendChild(hr);

    // Details Grid
    const detailsGrid = document.createElement('div');
    detailsGrid.style.display = 'grid';
    detailsGrid.style.gridTemplateColumns = '1fr 1fr';
    detailsGrid.style.gap = '12px';
    detailsGrid.style.marginBottom = '24px';

    const box1 = this._createDetailBox('Saved Projects', `${projectCount} Photos`);
    const box2 = this._createDetailBox('Sync Engine', isGuest ? 'Local Cache' : 'Supabase Cloud');

    detailsGrid.appendChild(box1);
    detailsGrid.appendChild(box2);
    card.appendChild(detailsGrid);

    // Action Buttons
    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.flexDirection = 'column';
    actions.style.gap = '10px';

    if (isGuest) {
      const loginBtn = document.createElement('button');
      loginBtn.className = 'btn btn-primary';
      loginBtn.style.width = '100%';
      loginBtn.style.justifyContent = 'center';
      loginBtn.style.padding = '10px';
      loginBtn.textContent = 'Sign In to Cloud Account';
      loginBtn.addEventListener('click', () => {
        this.close();
        window.location.hash = '#/login';
      });
      actions.appendChild(loginBtn);
    } else {
      const signoutBtn = document.createElement('button');
      signoutBtn.className = 'btn btn-ghost';
      signoutBtn.style.width = '100%';
      signoutBtn.style.justifyContent = 'center';
      signoutBtn.style.color = 'var(--error)';
      signoutBtn.style.border = '1px solid rgba(239, 68, 68, 0.3)';
      signoutBtn.style.padding = '10px';
      signoutBtn.textContent = 'Sign Out Account';
      signoutBtn.addEventListener('click', async () => {
        this.close();
        await signOut();
        if (this.onSignOut) this.onSignOut();
      });
      actions.appendChild(signoutBtn);
    }

    card.appendChild(actions);

    overlay.appendChild(card);
    
    // Close on backdrop click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    document.body.appendChild(overlay);
    this.overlay = overlay;
  }

  _createDetailBox(label, value) {
    const box = document.createElement('div');
    box.style.backgroundColor = 'var(--bg-tertiary)';
    box.style.border = '1px solid var(--border-color)';
    box.style.borderRadius = 'var(--radius-sm)';
    box.style.padding = '12px';

    const lbl = document.createElement('div');
    lbl.style.fontSize = '12px';
    lbl.style.color = 'var(--text-secondary)';
    lbl.style.marginBottom = '4px';
    lbl.textContent = label;
    box.appendChild(lbl);

    const val = document.createElement('div');
    val.style.fontSize = '14px';
    val.style.fontWeight = '600';
    val.style.color = 'var(--text-primary)';
    val.textContent = value;
    box.appendChild(val);

    return box;
  }

  close() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
  }
}
