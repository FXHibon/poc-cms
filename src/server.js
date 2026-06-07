const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'novacms-super-secret-development-key-987654';

// Ensure uploads directory exists
const UPLOADS_DIR = path.resolve(__dirname, '../public/uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Path traversal validation helper
const getSafePath = (relativePath) => {
  const resolvedPath = path.resolve(UPLOADS_DIR, relativePath || '');
  if (!resolvedPath.startsWith(UPLOADS_DIR)) {
    throw new Error('Directory traversal attempt detected');
  }
  return resolvedPath;
};

// HTML escaping helper
const escapeHtml = (string) => {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(string).replace(/[&<>"']/g, (m) => map[m]);
};

// Format bytes helper
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Parse content and replace folder widgets with actual PDF lists
const renderPageContent = (content) => {
  if (!content) return '';
  
  const widgetRegex = /<div\s+class=["']pdf-folder-widget["']\s+data-folder=["']([^"']*)["']>([\s\S]*?)<\/div>/gi;
  
  return content.replace(widgetRegex, (match, folderPath) => {
    try {
      const relativePath = folderPath;
      const targetFolder = getSafePath(relativePath);

      if (fs.existsSync(targetFolder) && fs.statSync(targetFolder).isDirectory()) {
        const files = fs.readdirSync(targetFolder, { withFileTypes: true });
        const pdfFiles = [];

        for (const file of files) {
          if (file.isFile() && path.extname(file.name).toLowerCase() === '.pdf') {
            const itemPath = path.join(targetFolder, file.name);
            const stats = fs.statSync(itemPath);
            const relativeItemPath = path.relative(UPLOADS_DIR, itemPath).replace(/\\/g, '/');
            pdfFiles.push({
              name: file.name,
              size: stats.size,
              url: `/uploads/${relativeItemPath}`.replace(/\\/g, '/')
            });
          }
        }

        if (pdfFiles.length === 0) {
          return `<div class="pdf-public-widget empty-widget"><div class="widget-icon">📁</div><p>No PDF files found in folder: <strong>${escapeHtml(relativePath || 'Root')}</strong></p></div>`;
        }

        return `
          <div class="pdf-public-widget">
            <h3 class="widget-title">📁 Documents: ${escapeHtml(relativePath || 'Root')}</h3>
            <div class="pdf-files-list">
              ${pdfFiles.map(file => `
                <a href="${file.url}" target="_blank" class="pdf-file-link">
                  <div class="pdf-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  </div>
                  <div class="pdf-details">
                    <span class="pdf-name">${escapeHtml(file.name)}</span>
                    <span class="pdf-size">${formatBytes(file.size)}</span>
                  </div>
                  <div class="pdf-download-arrow">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.04A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></svg>
                  </div>
                </a>
              `).join('')}
            </div>
          </div>`;
      } else {
        return `<div class="pdf-public-widget error-widget">Folder not found: ${escapeHtml(relativePath)}</div>`;
      }
    } catch (err) {
      console.error('Error rendering widget:', err);
      return `<div class="pdf-public-widget error-widget">Error rendering folder widget</div>`;
    }
  });
};

// Middleware configuration
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Set EJS as view engine for server-side rendering (SSR)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Admin authorization middleware
const authMiddleware = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }
    return res.redirect('/admin/login.html');
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.clearCookie('token');
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    return res.redirect('/admin/login.html');
  }
};

// Public middleware to load site settings and menu pages
const loadSettings = async (req, res, next) => {
  try {
    const settingsRes = await db.query('SELECT key, value FROM settings');
    const settings = {};
    settingsRes.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    res.locals.settings = settings;

    // Fetch published pages for the navigation menu (exclude 'home' if we want it hardcoded or include it)
    const pagesRes = await db.query(
      "SELECT slug, title FROM pages WHERE status = 'published' ORDER BY id ASC"
    );
    res.locals.menuPages = pagesRes.rows;
    next();
  } catch (err) {
    console.error('Failed to load settings:', err);
    res.locals.settings = {
      site_name: 'NovaCMS',
      site_description: 'Modern simple CMS',
      site_footer: '© 2026 NovaCMS.',
      accent_color: '#8b5cf6',
      site_theme: 'midnight-violet'
    };
    res.locals.menuPages = [];
    next();
  }
};

// Static files for the Admin dashboard panel
// Place it BEFORE the wildcard EJS routes, but AFTER express.static
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));

// ----------------------------------------------------
// Public APIs
// ----------------------------------------------------
app.get('/api/health', async (req, res) => {
  try {
    // Check database connection
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'disconnected', details: err.message });
  }
});

// ----------------------------------------------------
// Authentication APIs
// ----------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const userRes = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = userRes.rows[0];
    const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.json({ message: 'Login successful', user: { username: user.username } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/auth/status', (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.json({ loggedIn: false });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ loggedIn: true, user: { username: decoded.username } });
  } catch (err) {
    res.json({ loggedIn: false });
  }
});

// ----------------------------------------------------
// Admin APIs (Auth Required)
// ----------------------------------------------------

// Pages CRUD
app.get('/api/admin/pages', authMiddleware, async (req, res) => {
  try {
    const pagesRes = await db.query('SELECT * FROM pages ORDER BY id ASC');
    res.json(pagesRes.rows);
  } catch (err) {
    console.error('Error fetching admin pages:', err);
    res.status(500).json({ error: 'Failed to fetch pages' });
  }
});

app.post('/api/admin/pages', authMiddleware, async (req, res) => {
  const { title, slug, content, status } = req.body;
  if (!title || !slug || !content) {
    return res.status(400).json({ error: 'Title, slug, and content are required' });
  }

  // Format and validate slug
  const formattedSlug = slug.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-');
  if (formattedSlug === 'admin') {
    return res.status(400).json({ error: 'The slug "admin" is reserved' });
  }

  try {
    // Check if slug already exists
    const checkRes = await db.query('SELECT 1 FROM pages WHERE slug = $1', [formattedSlug]);
    if (checkRes.rows.length > 0) {
      return res.status(400).json({ error: 'A page with this slug already exists' });
    }

    const insertRes = await db.query(
      'INSERT INTO pages (title, slug, content, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [title.trim(), formattedSlug, content, status || 'draft']
    );
    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    console.error('Error creating page:', err);
    res.status(500).json({ error: 'Failed to create page' });
  }
});

app.put('/api/admin/pages/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { title, slug, content, status } = req.body;
  if (!title || !slug || !content) {
    return res.status(400).json({ error: 'Title, slug, and content are required' });
  }

  const formattedSlug = slug.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-');
  if (formattedSlug === 'admin') {
    return res.status(400).json({ error: 'The slug "admin" is reserved' });
  }

  try {
    // Check if slug is taken by another page
    const checkRes = await db.query('SELECT id FROM pages WHERE slug = $1 AND id != $2', [
      formattedSlug,
      id
    ]);
    if (checkRes.rows.length > 0) {
      return res.status(400).json({ error: 'A page with this slug already exists' });
    }

    const updateRes = await db.query(
      'UPDATE pages SET title = $1, slug = $2, content = $3, status = $4, updated_at = NOW() WHERE id = $5 RETURNING *',
      [title.trim(), formattedSlug, content, status, id]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json(updateRes.rows[0]);
  } catch (err) {
    console.error('Error updating page:', err);
    res.status(500).json({ error: 'Failed to update page' });
  }
});

app.delete('/api/admin/pages/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const deleteRes = await db.query('DELETE FROM pages WHERE id = $1 RETURNING slug', [id]);
    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }
    res.json({ message: 'Page deleted successfully', slug: deleteRes.rows[0].slug });
  } catch (err) {
    console.error('Error deleting page:', err);
    res.status(500).json({ error: 'Failed to delete page' });
  }
});

// Settings CRUD
app.get('/api/admin/settings', authMiddleware, async (req, res) => {
  try {
    const settingsRes = await db.query('SELECT key, value FROM settings');
    const settings = {};
    settingsRes.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json(settings);
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.post('/api/admin/settings', authMiddleware, async (req, res) => {
  const { site_name, site_description, site_footer, accent_color, site_theme } = req.body;
  
  if (!site_name || !accent_color) {
    return res.status(400).json({ error: 'Site name and Accent Color are required' });
  }

  try {
    const queries = [
      db.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['site_name', site_name]),
      db.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['site_description', site_description || '']),
      db.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['site_footer', site_footer || '']),
      db.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['accent_color', accent_color]),
      db.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['site_theme', site_theme || 'midnight-violet'])
    ];

    await Promise.all(queries);
    res.json({ message: 'Settings updated successfully' });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

app.post('/api/admin/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  try {
    // Get current user credentials
    const userRes = await db.query('SELECT * FROM users WHERE username = $1', [req.user.username]);
    const user = userRes.rows[0];

    const isPasswordValid = bcrypt.compareSync(currentPassword, user.password_hash);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid current password' });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Error changing password:', err);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// ----------------------------------------------------
// Folder-based PDF Media APIs (Auth Required)
// ----------------------------------------------------

const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, `${Date.now()}-${sanitizedName}`);
  }
});

const fileUploadHandler = multer({
  storage: uploadStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const uploadSingle = fileUploadHandler.single('file');

// Get items in directory
app.get('/api/admin/media', authMiddleware, async (req, res) => {
  const relativeQueryPath = req.query.path || '';
  try {
    const targetFolder = getSafePath(relativeQueryPath);
    
    if (!fs.existsSync(targetFolder) || !fs.statSync(targetFolder).isDirectory()) {
      return res.status(404).json({ error: 'Directory not found' });
    }

    const files = fs.readdirSync(targetFolder, { withFileTypes: true });
    const items = [];

    for (const file of files) {
      const itemPath = path.join(targetFolder, file.name);
      const relativeItemPath = path.relative(UPLOADS_DIR, itemPath).replace(/\\/g, '/');

      if (file.isDirectory()) {
        items.push({
          name: file.name,
          type: 'directory',
          relativePath: relativeItemPath
        });
      } else if (file.isFile() && path.extname(file.name).toLowerCase() === '.pdf') {
        const stats = fs.statSync(itemPath);
        items.push({
          name: file.name,
          type: 'file',
          size: stats.size,
          url: `/uploads/${relativeItemPath}`.replace(/\\/g, '/'),
          relativePath: relativeItemPath
        });
      }
    }

    const breadcrumbs = ['Root'];
    if (relativeQueryPath) {
      breadcrumbs.push(...relativeQueryPath.split('/').filter(Boolean));
    }

    res.json({
      currentPath: relativeQueryPath.replace(/\\/g, '/'),
      breadcrumbs,
      items
    });
  } catch (err) {
    console.error('Error reading media directory:', err);
    res.status(400).json({ error: err.message });
  }
});

// Get list of all folders recursively (for widget insertion)
app.get('/api/admin/media/folders', authMiddleware, async (req, res) => {
  try {
    const getFoldersRecursive = (dir, list = []) => {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        if (file.isDirectory()) {
          const fullPath = path.join(dir, file.name);
          // Verify safe path against path traversal
          getSafePath(path.relative(UPLOADS_DIR, fullPath));
          const relativePath = path.relative(UPLOADS_DIR, fullPath).replace(/\\/g, '/');
          list.push(relativePath);
          getFoldersRecursive(fullPath, list);
        }
      }
      return list;
    };
    
    const folders = getFoldersRecursive(UPLOADS_DIR);
    // Include root folder as empty string
    folders.unshift('');
    res.json(folders);
  } catch (err) {
    console.error('Error listing folders:', err);
    res.status(500).json({ error: 'Failed to retrieve folders list' });
  }
});

// Create directory
app.post('/api/admin/media/folder', authMiddleware, async (req, res) => {
  const { path: parentRelativePath, name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Folder name is required' });
  }

  const sanitizedName = name.trim().replace(/[^a-zA-Z0-9\s_-]/g, '');
  if (!sanitizedName) {
    return res.status(400).json({ error: 'Invalid folder name' });
  }

  try {
    const parentFolder = getSafePath(parentRelativePath);
    const newFolderPath = path.join(parentFolder, sanitizedName);

    if (!newFolderPath.startsWith(UPLOADS_DIR)) {
      return res.status(400).json({ error: 'Invalid operation' });
    }

    if (fs.existsSync(newFolderPath)) {
      return res.status(400).json({ error: 'Folder already exists' });
    }

    fs.mkdirSync(newFolderPath);
    res.status(201).json({
      message: 'Folder created successfully',
      folder: {
        name: sanitizedName,
        relativePath: path.relative(UPLOADS_DIR, newFolderPath).replace(/\\/g, '/')
      }
    });
  } catch (err) {
    console.error('Error creating folder:', err);
    res.status(400).json({ error: err.message });
  }
});

// Upload file to directory
app.post('/api/admin/media/upload', authMiddleware, (req, res, next) => {
  uploadSingle(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const destRelativePath = req.body.path || '';
  try {
    const destFolder = getSafePath(destRelativePath);

    // Get original filename and remove Date.now() prefix
    const filename = req.file.filename.split('-').slice(1).join('-');
    let finalName = filename;
    let targetPath = path.join(destFolder, finalName);
    
    // Handle name collision by appending _1, _2 etc.
    let counter = 1;
    while (fs.existsSync(targetPath)) {
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      finalName = `${base}_${counter}${ext}`;
      targetPath = path.join(destFolder, finalName);
      counter++;
    }

    fs.renameSync(req.file.path, targetPath);

    const relativeUrlPath = path.join('uploads', destRelativePath, finalName).replace(/\\/g, '/');
    res.status(201).json({
      message: 'File uploaded successfully',
      file: {
        name: finalName,
        size: req.file.size,
        url: `/${relativeUrlPath}`
      }
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Upload error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Delete file or folder
app.delete('/api/admin/media', authMiddleware, async (req, res) => {
  const { path: itemRelativePath } = req.body;
  if (!itemRelativePath) {
    return res.status(400).json({ error: 'Item path is required' });
  }

  try {
    const targetPath = getSafePath(itemRelativePath);

    if (targetPath === UPLOADS_DIR) {
      return res.status(400).json({ error: 'Cannot delete root uploads directory' });
    }

    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(targetPath);
    }

    res.json({ message: 'Item deleted successfully' });
  } catch (err) {
    console.error('Error deleting item:', err);
    res.status(400).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Public EJS Views SSR Routing
// ----------------------------------------------------

// Redirect /admin to dashboard index
app.get('/admin', (req, res) => {
  res.redirect('/admin/index.html');
});

// Render Home Page
app.get('/', loadSettings, async (req, res) => {
  try {
    const pageRes = await db.query("SELECT * FROM pages WHERE slug = 'home' AND status = 'published'");
    if (pageRes.rows.length === 0) {
      // If home page is not published or deleted, show default page
      return res.render('page', {
        page: {
          title: 'Welcome',
          content: '<h1>Welcome to NovaCMS</h1><p>Set up a page with the slug <strong>home</strong> and publish it to replace this content.</p>'
        },
        preview: false
      });
    }
    const page = pageRes.rows[0];
    page.content = renderPageContent(page.content);
    res.render('page', { page, preview: false });
  } catch (err) {
    console.error('Error fetching home page:', err);
    res.status(500).render('error', { title: 'Server Error', message: 'An internal server error occurred.' });
  }
});

// Wildcard Page rendering by Slug
app.get('/:slug', loadSettings, async (req, res) => {
  const slug = req.params.slug.trim().toLowerCase();

  try {
    const pageRes = await db.query('SELECT * FROM pages WHERE slug = $1', [slug]);
    if (pageRes.rows.length === 0) {
      return res.status(404).render('error', {
        title: 'Page Not Found',
        message: 'The page you requested could not be found.'
      });
    }

    const page = pageRes.rows[0];

    // If page is a draft, only show it to logged in admin previewing it
    if (page.status === 'draft') {
      const token = req.cookies.token;
      let isAdmin = false;
      if (token) {
        try {
          jwt.verify(token, JWT_SECRET);
          isAdmin = true;
        } catch (err) {
          // invalid token
        }
      }
      if (!isAdmin) {
        return res.status(404).render('error', {
          title: 'Page Not Found',
          message: 'The page you requested is currently a draft.'
        });
      }
    }

    page.content = renderPageContent(page.content);
    res.render('page', { page, preview: page.status === 'draft' });
  } catch (err) {
    console.error('Error fetching page:', err);
    res.status(500).render('error', { title: 'Server Error', message: 'An internal server error occurred.' });
  }
});

// 404 Handler for undefined routes
app.use(loadSettings, (req, res) => {
  res.status(404).render('error', {
    title: '404 Page Not Found',
    message: 'The resource you are looking for does not exist.'
  });
});

// Start the server
const server = app.listen(PORT, () => {
  console.log(`NovaCMS backend running on port ${PORT}`);
});

module.exports = { app, server };
