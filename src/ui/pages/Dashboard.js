import { getProjects, createProject, deleteProject } from '../../supabase/database';
import { uploadImage, uploadExport, getImageUrl, deleteImage } from '../../supabase/storage';
import { signOut, getUserDisplayName } from '../../supabase/auth';
import { validateFile, loadImageElement, generateThumbnail, isRawFile } from '../../utils/ImageLoader';
import { Toast } from '../components/Toast';
import { Icons } from '../components/Icons';
import { ProfileModal } from '../components/ProfileModal';

export class Dashboard {
  constructor(container, user, onSelectProject, onSignOut) {
    this.container = container;
    this.user = user;
    this.onSelectProject = onSelectProject;
    this.onSignOut = onSignOut;
    this.projects = [];

    this.init();
  }

  init() {
    this.container.innerHTML = '';
    
    const dashboard = document.createElement('div');
    dashboard.className = 'dashboard-container fade-in';

    // Header
    const header = document.createElement('header');
    header.className = 'dashboard-header';

    const logo = document.createElement('div');
    logo.className = 'auth-logo';
    logo.style.fontSize = '20px';
    logo.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="url(#aperture-grad-dash)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 4px rgba(255, 140, 66, 0.45));">
        <defs>
          <linearGradient id="aperture-grad-dash" x1="0%" y1="0%" x2="100%" y2="100%">
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
    `;
    header.appendChild(logo);

    const rightGroup = document.createElement('div');
    rightGroup.className = 'flex-row gap-md align-center';

    // Clickable User Profile Pill
    const displayName = getUserDisplayName(this.user);
    const initial = displayName.charAt(0).toUpperCase() || 'U';

    const profilePill = document.createElement('div');
    profilePill.className = 'profile-pill flex-row gap-xs align-center';
    profilePill.style.cursor = 'pointer';
    profilePill.style.padding = '4px 10px 4px 6px';
    profilePill.style.backgroundColor = 'var(--bg-tertiary)';
    profilePill.style.border = '1px solid var(--border-color)';
    profilePill.style.borderRadius = '20px';
    profilePill.style.fontSize = 'var(--font-size-xs)';
    profilePill.style.fontWeight = '600';
    profilePill.style.transition = 'all 0.2s';
    profilePill.title = 'View Profile Details';
    profilePill.innerHTML = `
      <div style="width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(135deg, var(--accent-color) 0%, #ff3e55 100%); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px;">${initial}</div>
      <span style="color: var(--text-primary);">${displayName}</span>
    `;
    profilePill.addEventListener('click', () => {
      new ProfileModal(this.user, { onSignOut: this.onSignOut }).open();
    });
    rightGroup.appendChild(profilePill);

    // PWA Install Button
    const installBtn = document.createElement('button');
    installBtn.id = 'pwa-install-btn';
    installBtn.className = 'btn btn-ghost pwa-install-btn';
    installBtn.style.fontSize = 'var(--font-size-xs)';
    installBtn.style.display = 'flex';
    installBtn.style.alignItems = 'center';
    installBtn.style.gap = '6px';
    installBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span class="btn-text">Install App</span>
    `;
    installBtn.addEventListener('click', () => {
      if (window.triggerPWAInstall) window.triggerPWAInstall();
    });
    rightGroup.appendChild(installBtn);

    header.appendChild(rightGroup);
    dashboard.appendChild(header);

    // Content container
    const content = document.createElement('main');
    content.className = 'dashboard-content';

    // Row: Title & Upload Button
    const titleRow = document.createElement('div');
    titleRow.className = 'flex-between';
    
    const title = document.createElement('h1');
    title.style.fontSize = 'var(--font-size-xl)';
    title.style.fontWeight = '700';
    title.textContent = 'Photo Studio';
    titleRow.appendChild(title);

    // File input (hidden)
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = 'image/*';
    this.fileInput.style.display = 'none';
    this.fileInput.addEventListener('change', (e) => this.handleUpload(e.target.files[0]));
    const fileInput = this.fileInput;
    content.appendChild(fileInput);

    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'btn btn-primary';
    uploadBtn.innerHTML = '➕ Upload Photo';
    uploadBtn.addEventListener('click', () => fileInput.click());
    titleRow.appendChild(uploadBtn);
    content.appendChild(titleRow);

    // Drag and Drop Area
    const dropzone = document.createElement('div');
    dropzone.className = 'dashboard-dropzone';
    dropzone.style.border = '2px dashed var(--border-color)';
    dropzone.style.borderRadius = 'var(--radius-md)';
    dropzone.style.padding = 'var(--spacing-xxl) 0';
    dropzone.style.marginTop = 'var(--spacing-lg)';
    dropzone.style.textAlign = 'center';
    dropzone.style.color = 'var(--text-secondary)';
    dropzone.style.transition = 'border-color 0.2s';
    dropzone.style.cursor = 'pointer';
    dropzone.innerHTML = `
      <div style="font-size: 24px; margin-bottom: 8px;">📷</div>
      <div style="font-size: var(--font-size-sm); font-weight: 600; color: var(--text-primary);">Drag & drop image here</div>
      <div style="font-size: var(--font-size-xs); margin-top: 4px;">Supports JPG, PNG, WebP or RAW up to 30MB</div>
    `;
    
    dropzone.addEventListener('click', () => fileInput.click());
    
    // Drag-drop events
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--accent-color)';
    });
    
    dropzone.addEventListener('dragleave', () => {
      dropzone.style.borderColor = 'var(--border-color)';
    });
    
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--border-color)';
      if (e.dataTransfer.files.length > 0) {
        this.handleUpload(e.dataTransfer.files[0]);
      }
    });

    content.appendChild(dropzone);

    // Upload Progress Box
    const progressBox = document.createElement('div');
    progressBox.className = 'upload-progress-box';
    progressBox.style.display = 'none';
    progressBox.style.marginTop = '16px';
    progressBox.style.padding = 'var(--spacing-md)';
    progressBox.style.backgroundColor = 'var(--bg-secondary)';
    progressBox.style.border = '1px solid var(--border-color)';
    progressBox.style.borderRadius = 'var(--radius-sm)';
    
    const progressText = document.createElement('div');
    progressText.style.fontSize = 'var(--font-size-xs)';
    progressText.style.marginBottom = '6px';
    progressText.textContent = 'Uploading... 0%';
    progressBox.appendChild(progressText);

    const progressBarBg = document.createElement('div');
    progressBarBg.style.height = '6px';
    progressBarBg.style.backgroundColor = 'var(--bg-primary)';
    progressBarBg.style.borderRadius = '3px';
    progressBarBg.style.overflow = 'hidden';

    const progressBarFill = document.createElement('div');
    progressBarFill.style.height = '100%';
    progressBarFill.style.width = '0%';
    progressBarFill.style.backgroundColor = 'var(--accent-color)';
    progressBarFill.style.transition = 'width 0.1s';
    progressBarBg.appendChild(progressBarFill);
    progressBox.appendChild(progressBarBg);
    
    content.appendChild(progressBox);
    this.progressBox = progressBox;
    this.progressText = progressText;
    this.progressBarFill = progressBarFill;

    // Library Grid list container
    const grid = document.createElement('div');
    grid.className = 'dashboard-grid';
    content.appendChild(grid);
    this.grid = grid;

    dashboard.appendChild(content);
    this.container.appendChild(dashboard);

    // Initial load
    this.loadProjectGrid();
  }

  // Fetch projects metadata from database
  async loadProjectGrid() {
    this.grid.innerHTML = '';
    
    // Show skeleton loader
    this.grid.innerHTML = Array.from({ length: 4 }).map(() => `
      <div class="image-card" style="pointer-events: none; opacity: 0.5;">
        <div class="card-thumbnail" style="background-color: var(--bg-tertiary);"></div>
        <div class="card-info">
          <div style="height: 14px; background: var(--bg-tertiary); width: 70%; border-radius: 2px;"></div>
          <div style="height: 10px; background: var(--bg-tertiary); width: 40%; border-radius: 2px; margin-top: 6px;"></div>
        </div>
      </div>
    `).join('');

    const { data, error } = await getProjects(this.user.id);
    this.grid.innerHTML = '';

    if (error) {
      Toast.error('Failed to load project database.');
      return;
    }

    this.projects = data || [];
    
    if (this.projects.length === 0) {
      const empty = document.createElement('div');
      empty.style.gridColumn = '1 / -1';
      empty.style.textAlign = 'center';
      empty.style.padding = '48px';
      empty.style.color = 'var(--text-secondary)';
      empty.innerHTML = `
        <div style="font-size: 32px; margin-bottom: 12px; display: flex; justify-content: center; opacity: 0.5;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
        </div>
        <div>No projects found. Upload a photo to start editing!</div>
      `;
      this.grid.appendChild(empty);
      return;
    }

    // Render cards
    for (const proj of this.projects) {
      const card = document.createElement('div');
      card.className = 'image-card';
      
      const thumbContainer = document.createElement('div');
      thumbContainer.className = 'card-thumbnail';
      
      // Load thumbnail URL securely
      getImageUrl(proj.thumbnail_path).then(url => {
        if (url) {
          const img = document.createElement('img');
          img.src = url;
          img.alt = proj.name;
          thumbContainer.appendChild(img);
        } else {
          thumbContainer.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>`;
        }
      });
      card.appendChild(thumbContainer);

      const info = document.createElement('div');
      info.className = 'card-info';
      
      const title = document.createElement('div');
      title.className = 'card-title';
      title.textContent = proj.name;
      info.appendChild(title);

      const date = document.createElement('div');
      date.className = 'card-date';
      date.textContent = new Date(proj.created_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      info.appendChild(date);
      card.appendChild(info);

      // Card hovering action overlay for deletions
      const actions = document.createElement('div');
      actions.className = 'card-actions';
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-ghost btn-icon flex-row align-center justify-center';
      deleteBtn.style.backgroundColor = 'rgba(0,0,0,0.6)';
      deleteBtn.style.padding = '6px';
      deleteBtn.innerHTML = Icons.trash;
      deleteBtn.title = 'Delete Project';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent opening editor
        this.onDeleteProjectPrompt(proj);
      });
      actions.appendChild(deleteBtn);
      thumbContainer.appendChild(actions);

      // Click card -> Open in editor
      card.addEventListener('click', () => {
        if (this.onSelectProject) this.onSelectProject(proj);
      });

      this.grid.appendChild(card);
    }
  }

  // Orchestrate file upload and database mapping
  async handleUpload(file) {
    if (!file) return;
    if (this.isUploading) return;
    this.isUploading = true;

    // Validate size and format
    const { valid, error } = validateFile(file);
    if (!valid) {
      Toast.error(error);
      this.isUploading = false;
      return;
    }

    this.progressBox.style.display = 'block';
    this.progressText.textContent = 'Analyzing photo...';
    this.progressBarFill.style.width = '10%';

    try {
      let uploadFile = file;
      const originalFilename = file.name;

      // Extract high-resolution embedded JPEG if this is a camera RAW file
      if (isRawFile(file.name)) {
        this.progressText.textContent = 'Decoding RAW image preview...';
        this.progressBarFill.style.width = '20%';

        const arrayBuffer = await file.arrayBuffer();
        const rawWorker = new Worker(new URL('../../workers/raw.worker.js', import.meta.url), { type: 'module' });

        const decodedBytes = await new Promise((resolve, reject) => {
          rawWorker.onmessage = (e) => {
            rawWorker.terminate();
            if (e.data.success) {
              resolve(e.data.jpegBytes);
            } else {
              reject(new Error(e.data.error || 'Failed to extract RAW preview.'));
            }
          };
          rawWorker.onerror = (err) => {
            rawWorker.terminate();
            reject(err);
          };
          rawWorker.postMessage({ arrayBuffer }, [arrayBuffer]);
        });

        // Create a new File reference targeting the extracted JPEG data
        const newName = file.name.replace(/\.[^/.]+$/, "") + '.jpg';
        uploadFile = new File([decodedBytes], newName, { type: 'image/jpeg' });
      }

      // 1. Load file locally to generate compressed thumbnail
      const fileUrl = URL.createObjectURL(uploadFile);
      const imgEl = await loadImageElement(fileUrl);
      const thumbBlob = await generateThumbnail(imgEl);
      URL.revokeObjectURL(fileUrl);

      this.progressText.textContent = 'Uploading high-resolution image...';
      this.progressBarFill.style.width = '40%';

      // 2. Upload Original Image
      const { path: originalPath, error: upError } = await uploadImage(this.user.id, uploadFile);
      if (upError) throw upError;

      this.progressBarFill.style.width = '70%';
      this.progressText.textContent = 'Uploading project thumbnail...';

      // 3. Upload Thumbnail
      const thumbFilename = `thumb_${Date.now()}.jpg`;
      const { path: thumbnailPath, error: thumbUpError } = await uploadExport(
        this.user.id, 
        `thumbs/${Date.now()}`, 
        thumbBlob
      );
      if (thumbUpError) throw thumbUpError;

      this.progressBarFill.style.width = '90%';
      this.progressText.textContent = 'Creating project metadata...';

      // 4. Save to Postgres
      const { data, error: dbError } = await createProject(
        this.user.id,
        originalFilename,
        originalPath,
        thumbnailPath
      );
      if (dbError) throw dbError;

      this.progressBarFill.style.width = '100%';
      this.progressText.textContent = 'Upload complete!';
      Toast.success('Photo added successfully!');
      
      setTimeout(() => {
        this.progressBox.style.display = 'none';
        this.isUploading = false;
        if (this.fileInput) this.fileInput.value = '';
        this.loadProjectGrid();
        
        // Auto open new project in editor
        if (data && this.onSelectProject) this.onSelectProject(data);
      }, 500);

    } catch (err) {
      console.error(err);
      this.progressBox.style.display = 'none';
      this.isUploading = false;
      if (this.fileInput) this.fileInput.value = '';
      Toast.error('Upload failed: ' + err.message);
    }
  }

  // Delete project workflow
  async onDeleteProjectPrompt(project) {
    const confirmDelete = confirm(`Are you sure you want to delete "${project.name}"? This action cannot be undone.`);
    if (!confirmDelete) return;

    try {
      // Delete metadata row
      const { error: dbError } = await deleteProject(project.id);
      if (dbError) throw dbError;

      // Delete storage files (ignore failures here)
      deleteImage(this.user.id, project.original_path);
      deleteImage(this.user.id, project.thumbnail_path);

      Toast.success('Project deleted.');
      this.loadProjectGrid();
    } catch (err) {
      Toast.error('Failed to delete project: ' + err.message);
    }
  }
}
