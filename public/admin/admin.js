// NovaCMS Administrator Dashboard JS SPA Controller

const app = {
  currentPageId: null,
  pages: [],
  settings: {},
  currentMediaPath: '',

  // Initialize Admin Panel
  async init() {
    // 1. Verify authorization status
    const authorized = await this.checkAuth();
    if (!authorized) return;

    // 2. Load settings (Accent color, site metadata)
    await this.loadSettings();

    // 3. Load sections
    await this.loadDashboardData();
    await this.loadPagesData();

    // 4. Register Event Listeners
    this.registerEventListeners();
    
    // 5. Initialize Dialog Polyfill/Fallback for Light-Dismiss
    this.initDialogDismiss();

    // 6. Initialize Theme switch icons
    this.initTheme();
  },

  // Check login authorization status
  async checkAuth() {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      if (!data.loggedIn) {
        window.location.href = '/admin/login.html';
        return false;
      }
      return true;
    } catch (err) {
      console.error('Failed to authenticate session:', err);
      window.location.href = '/admin/login.html';
      return false;
    }
  },

  // Get site configurations
  async loadSettings() {
    try {
      const res = await fetch('/api/admin/settings');
      if (!res.ok) throw new Error('Failed to retrieve settings');
      
      const settings = await res.json();
      this.settings = settings;

      // Populate Settings inputs
      document.getElementById('siteName').value = settings.site_name || '';
      document.getElementById('siteDescription').value = settings.site_description || '';
      document.getElementById('siteFooter').value = settings.site_footer || '';
      
      const accent = settings.accent_color || '#8b5cf6';
      document.getElementById('accentColorPicker').value = accent;
      document.getElementById('accentColorText').value = accent;

      // Dynamically apply accent color to the admin console theme
      this.applyThemeAccent(accent);
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // Save Settings
  async saveSettings(e) {
    e.preventDefault();
    const site_name = document.getElementById('siteName').value.trim();
    const site_description = document.getElementById('siteDescription').value.trim();
    const site_footer = document.getElementById('siteFooter').value.trim();
    const accent_color = document.getElementById('accentColorText').value.trim();

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_name, site_description, site_footer, accent_color })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to update settings');

      this.showToast('Settings saved successfully!');
      this.applyThemeAccent(accent_color);
      
      // Update logo and navbar live in admin UI
      document.title = `Admin Dashboard | ${site_name}`;
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // Apply theme accent color
  applyThemeAccent(hex) {
    document.documentElement.style.setProperty('--accent', hex);
    
    // Hex to RGB parser for transparent glows
    let r = 139, g = 92, b = 246; // fallback fuchsia
    if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
      let c = hex.substring(1).split('');
      if(c.length === 3) {
        c = [c[0], c[0], c[1], c[1], c[2], c[2]];
      }
      c = '0x' + c.join('');
      r = (c>>16)&255;
      g = (c>>8)&255;
      b = c&255;
    }
    document.documentElement.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
    document.documentElement.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.15)`);
  },

  // Fetch metrics and update dashboard cards
  async loadDashboardData() {
    try {
      const res = await fetch('/api/admin/pages');
      if (!res.ok) throw new Error('Failed to retrieve pages data');
      
      const pages = await res.json();
      this.pages = pages;

      // Update counters
      const total = pages.length;
      const published = pages.filter(p => p.status === 'published').length;
      const drafts = pages.filter(p => p.status === 'draft').length;

      document.getElementById('statTotalPages').textContent = total;
      document.getElementById('statPublishedPages').textContent = published;
      document.getElementById('statDraftPages').textContent = drafts;

      // Render recent activity (up to 5 recently updated pages)
      const sortedByUpdate = [...pages].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      const recent = sortedByUpdate.slice(0, 5);
      
      const tbody = document.getElementById('recentPagesTableBody');
      if (recent.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No pages found. Click "Pages" to create one.</td></tr>`;
        return;
      }

      tbody.innerHTML = recent.map(p => `
        <tr>
          <td style="font-weight: 600; color: #ffffff;">${this.escapeHtml(p.title)}</td>
          <td style="font-family: monospace; color: var(--text-muted);">/${p.slug}</td>
          <td>
            <span class="badge badge-${p.status}">${p.status}</span>
          </td>
          <td>${new Date(p.updated_at).toLocaleString()}</td>
        </tr>
      `).join('');

    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // Load pages management table
  async loadPagesData() {
    try {
      const res = await fetch('/api/admin/pages');
      if (!res.ok) throw new Error('Failed to fetch pages database');
      
      const pages = await res.json();
      this.pages = pages;
      this.renderPagesTable();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // Render list of pages with filter option
  renderPagesTable(searchQuery = '') {
    const tbody = document.getElementById('pagesTableBody');
    const query = searchQuery.toLowerCase().trim();
    
    const filtered = this.pages.filter(p => 
      p.title.toLowerCase().includes(query) || 
      p.slug.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No matching pages found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(p => `
      <tr>
        <td style="font-weight: 600; color: #ffffff;">${this.escapeHtml(p.title)}</td>
        <td style="font-family: monospace; color: var(--accent);"><a href="/${p.slug}" target="_blank" style="color: inherit; text-decoration: none;">/${p.slug} ↗</a></td>
        <td>
          <span class="badge badge-${p.status}">${p.status}</span>
        </td>
        <td>${new Date(p.updated_at).toLocaleString()}</td>
        <td>
          <div class="actions-cell">
            <button class="btn btn-secondary btn-sm" onclick="app.openEditDialog(${p.id})">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="app.deletePage(${p.id})">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  // Delete page
  async deletePage(id) {
    const page = this.pages.find(p => p.id === id);
    if (!page) return;

    if (!confirm(`Are you sure you want to delete the page "${page.title}"? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/pages/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete page');

      this.showToast('Page deleted successfully.');
      
      // Reload page list and dashboard stats
      await this.loadDashboardData();
      await this.loadPagesData();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // Open Dialog Modal in "Create Mode"
  openCreateDialog() {
    const dialog = document.getElementById('pageDialog');
    document.getElementById('dialogTitle').textContent = 'Create New Page';
    document.getElementById('editPageId').value = '';
    
    // Clear form fields
    document.getElementById('pageTitle').value = '';
    document.getElementById('pageSlug').value = '';
    document.getElementById('pageContent').value = '';
    document.getElementById('pageStatus').value = 'draft';

    dialog.showModal();
  },

  // Open Dialog Modal in "Edit Mode"
  openEditDialog(id) {
    const page = this.pages.find(p => p.id === id);
    if (!page) return;

    const dialog = document.getElementById('pageDialog');
    document.getElementById('dialogTitle').textContent = 'Edit Page';
    document.getElementById('editPageId').value = page.id;
    
    document.getElementById('pageTitle').value = page.title;
    document.getElementById('pageSlug').value = page.slug;
    document.getElementById('pageContent').value = page.content;
    document.getElementById('pageStatus').value = page.status;

    dialog.showModal();
  },

  // Save Page (Create or Update)
  async savePage(e) {
    e.preventDefault();
    const id = document.getElementById('editPageId').value;
    const title = document.getElementById('pageTitle').value.trim();
    const slug = document.getElementById('pageSlug').value.trim();
    const status = document.getElementById('pageStatus').value;
    const content = document.getElementById('pageContent').value;

    const url = id ? `/api/admin/pages/${id}` : '/api/admin/pages';
    const method = id ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, slug, content, status })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to save page');

      this.showToast(id ? 'Page updated successfully!' : 'Page created successfully!');
      document.getElementById('pageDialog').close();

      // Refresh data models
      await this.loadDashboardData();
      await this.loadPagesData();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // Update Password security settings
  async changePassword(e) {
    e.preventDefault();
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;

    if (newPassword !== confirmNewPassword) {
      this.showToast('New passwords do not match!', 'error');
      return;
    }

    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to change password');

      this.showToast('Password updated successfully!');
      document.getElementById('securityForm').reset();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // User Logout
  async logout() {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        window.location.href = '/admin/login.html';
      } else {
        throw new Error('Logout failed');
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // Navigate between SPA dashboard sections
  navigateToSection(sectionId) {
    // Remove active state from current link and section
    document.querySelectorAll('.sidebar-link').forEach(link => {
      if (link.getAttribute('data-section') === sectionId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    document.querySelectorAll('.dashboard-section').forEach(sec => {
      if (sec.id === `section-${sectionId}`) {
        sec.classList.add('active');
      } else {
        sec.classList.remove('active');
      }
    });

    // Update headings dynamically
    const title = document.getElementById('sectionTitle');
    const subtitle = document.getElementById('sectionSubtitle');

    if (sectionId === 'dashboard') {
      title.textContent = 'Dashboard Overview';
      subtitle.textContent = 'Welcome back to NovaCMS. Here is your site status.';
      this.loadDashboardData();
    } else if (sectionId === 'pages') {
      title.textContent = 'Pages Management';
      subtitle.textContent = 'Create, modify, view, or delete pages and posts.';
      this.loadPagesData();
    } else if (sectionId === 'settings') {
      title.textContent = 'System Settings';
      subtitle.textContent = 'Manage site metadata, theme accent color, and change admin credentials.';
      this.loadSettings();
    } else if (sectionId === 'media') {
      title.textContent = 'Media Library Explorer';
      subtitle.textContent = 'Upload PDF documents and organize them in custom folders.';
      this.loadMediaData(this.currentMediaPath);
    }
  },

  // Register Event Listeners
  registerEventListeners() {
    // Sidebar Tabs navigation
    document.querySelectorAll('.sidebar-link').forEach(link => {
      link.addEventListener('click', (e) => {
        const sectionId = link.getAttribute('data-section');
        this.navigateToSection(sectionId);
      });
    });

    // Search bar filter keyup
    document.getElementById('pageSearchInput').addEventListener('input', (e) => {
      this.renderPagesTable(e.target.value);
    });

    // Open Modal button
    document.getElementById('createPageBtn').addEventListener('click', () => {
      this.openCreateDialog();
    });

    // Save Page Dialog Form Submit
    document.getElementById('pageForm').addEventListener('submit', (e) => this.savePage(e));

    // Save Settings Submit
    document.getElementById('settingsForm').addEventListener('submit', (e) => this.saveSettings(e));

    // Change Password Security Submit
    document.getElementById('securityForm').addEventListener('submit', (e) => this.changePassword(e));

    // Logout Button Trigger
    document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

    // Color Pickers sync setting
    const picker = document.getElementById('accentColorPicker');
    const hexInput = document.getElementById('accentColorText');
    
    picker.addEventListener('input', (e) => {
      hexInput.value = e.target.value;
    });
    hexInput.addEventListener('input', (e) => {
      const val = e.target.value;
      if (/^#[A-Fa-f0-9]{6}$/.test(val)) {
        picker.value = val;
      }
    });

    // Auto-generate Slug from Title (Only for new pages, where edit ID is empty)
    document.getElementById('pageTitle').addEventListener('input', (e) => {
      const editId = document.getElementById('editPageId').value;
      if (!editId) {
        const titleVal = e.target.value;
        const slugVal = titleVal
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, '') // remove special chars
          .replace(/\s+/g, '-')         // replace spaces with hyphens
          .replace(/-+/g, '-');         // remove duplicate hyphens
        document.getElementById('pageSlug').value = slugVal;
      }
    });

    // Media Library Events
    document.getElementById('newFolderBtn').addEventListener('click', () => {
      this.openCreateFolderFolderDialog();
    });

    document.getElementById('folderForm').addEventListener('submit', (e) => this.createFolder(e));

    // File Selector upload trigger
    const fileInput = document.getElementById('mediaFileInput');
    document.getElementById('uploadTriggerBtn').addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        const file = e.target.files[0];
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
          this.showToast('Only PDF files are allowed!', 'error');
          fileInput.value = '';
          return;
        }
        if (file.size > 10 * 1024 * 1024) {
          this.showToast('File size exceeds 10MB limit!', 'error');
          fileInput.value = '';
          return;
        }
        this.uploadMediaFile(file);
        fileInput.value = '';
      }
    });

    // Drag and Drop event handlers
    const dropzone = document.getElementById('mediaDropzone');
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      }, false);
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;

      if (files.length > 0) {
        const file = files[0];
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
          this.showToast('Only PDF files are allowed!', 'error');
          return;
        }
        if (file.size > 10 * 1024 * 1024) {
          this.showToast('File size exceeds 10MB limit!', 'error');
          return;
        }
        this.uploadMediaFile(file);
      }
    });

    // Theme toggle listener
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const activeTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', activeTheme);
        localStorage.setItem('site-theme', activeTheme);
        this.initTheme();
        this.showToast(`Theme switched to ${activeTheme}!`);
      });
    }
  },

  // Native Dialog backdrop clicks fallback (light-dismiss)
  initDialogDismiss() {
    ['pageDialog', 'folderDialog'].forEach(dialogId => {
      const dialog = document.getElementById(dialogId);
      if (!dialog) return;
      
      if (!('closedBy' in HTMLDialogElement.prototype)) {
        dialog.addEventListener('click', (event) => {
          if (event.target !== dialog) return;

          const rect = dialog.getBoundingClientRect();
          const isDialogContent = (
            rect.top <= event.clientY &&
            event.clientY <= rect.top + rect.height &&
            rect.left <= event.clientX &&
            event.clientX <= rect.left + rect.width
          );

          if (isDialogContent) return;

          dialog.close();
        });
      }
    });
  },

  // Dynamic Toast alerts system
  showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // SVG icons
    const icon = type === 'success' 
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    
    toast.innerHTML = `
      ${icon}
      <span>${this.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    // Fadeout timer
    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  // Load media items from backend
  async loadMediaData(relativePath = '') {
    this.currentMediaPath = relativePath;
    try {
      const res = await fetch(`/api/admin/media?path=${encodeURIComponent(relativePath)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load media files');

      this.renderMediaBreadcrumbs(data.breadcrumbs, data.currentPath);
      this.renderMediaGrid(data.items);
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // Render breadcrumbs navigation
  renderMediaBreadcrumbs(breadcrumbs, currentPath) {
    const container = document.getElementById('mediaBreadcrumbs');
    let html = '';
    let accumulatedPath = '';

    breadcrumbs.forEach((crumb, idx) => {
      if (idx === 0) {
        if (breadcrumbs.length === 1) {
          html += `<span class="media-breadcrumb-active">Root</span>`;
        } else {
          html += `<span class="media-breadcrumb" onclick="app.loadMediaData('')">Root</span>`;
        }
      } else {
        accumulatedPath = accumulatedPath ? `${accumulatedPath}/${crumb}` : crumb;
        html += `<span class="media-breadcrumb-sep">></span>`;
        
        if (idx === breadcrumbs.length - 1) {
          html += `<span class="media-breadcrumb-active">${this.escapeHtml(crumb)}</span>`;
        } else {
          const targetPath = accumulatedPath;
          html += `<span class="media-breadcrumb" onclick="app.loadMediaData('${targetPath}')">${this.escapeHtml(crumb)}</span>`;
        }
      }
    });

    container.innerHTML = html;
  },

  // Render items in explorer grid
  renderMediaGrid(items) {
    const grid = document.getElementById('mediaGrid');
    
    if (items.length === 0) {
      grid.innerHTML = `<div class="media-item-placeholder">This folder is empty. Drag and drop PDF files here to upload.</div>`;
      return;
    }

    grid.innerHTML = items.map(item => {
      const isDir = item.type === 'directory';
      const iconClass = isDir ? 'folder' : 'file';
      
      const iconSvg = isDir 
        ? `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`
        : `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
      
      const clickHandler = isDir 
        ? `onclick="app.loadMediaData('${item.relativePath}')"`
        : `onclick="window.open('${item.url}', '_blank')"`;
      
      const sizeText = isDir ? '' : `<div class="media-item-size">${this.formatBytes(item.size)}</div>`;
      
      return `
        <div class="media-item" ${clickHandler}>
          <div class="media-item-delete" onclick="event.stopPropagation(); app.deleteMedia('${item.relativePath}', '${this.escapeHtml(item.name)}')">&times;</div>
          <div class="media-item-icon ${iconClass}">
            ${iconSvg}
          </div>
          <div class="media-item-name" title="${this.escapeHtml(item.name)}">${this.escapeHtml(item.name)}</div>
          ${sizeText}
        </div>
      `;
    }).join('');
  },

  // Open Create Folder Modal
  openCreateFolderFolderDialog() {
    document.getElementById('folderName').value = '';
    document.getElementById('folderDialog').showModal();
  },

  // Create folder
  async createFolder(e) {
    e.preventDefault();
    const name = document.getElementById('folderName').value.trim();
    if (!name) return;

    try {
      const res = await fetch('/api/admin/media/folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: this.currentMediaPath, name })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to create folder');

      this.showToast('Folder created successfully.');
      document.getElementById('folderDialog').close();
      await this.loadMediaData(this.currentMediaPath);
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // Delete media item
  async deleteMedia(relativePath, name) {
    if (!confirm(`Are you sure you want to delete "${name}"? If it is a folder, all of its contents will be deleted.`)) {
      return;
    }

    try {
      const res = await fetch('/api/admin/media', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: relativePath })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete item');

      this.showToast('Item deleted successfully.');
      await this.loadMediaData(this.currentMediaPath);
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // Upload file to current folder
  async uploadMediaFile(file) {
    const formData = new FormData();
    formData.append('path', this.currentMediaPath);
    formData.append('file', file);

    try {
      this.showToast('Uploading PDF file...');
      const res = await fetch('/api/admin/media/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      this.showToast('File uploaded successfully!');
      await this.loadMediaData(this.currentMediaPath);
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // Format bytes helper
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  },

  // Init Theme switches
  initTheme() {
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
      const sun = btn.querySelector('.sun-icon');
      const moon = btn.querySelector('.moon-icon');
      const text = document.getElementById('themeToggleText');
      
      const theme = document.documentElement.getAttribute('data-theme') || 'dark';
      if (theme === 'light') {
        sun.style.display = 'block';
        moon.style.display = 'none';
        text.textContent = 'Theme: Light';
      } else {
        sun.style.display = 'none';
        moon.style.display = 'block';
        text.textContent = 'Theme: Dark';
      }
    }
  },

  // Escape HTML helper to prevent XSS in toasts and recent listings
  escapeHtml(string) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(string).replace(/[&<>"']/g, (m) => map[m]);
  }
};

// Start application on load
document.addEventListener('DOMContentLoaded', () => app.init());
