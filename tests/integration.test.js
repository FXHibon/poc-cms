const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { server } = require('../src/server');
const db = require('../src/db');

const PORT = process.env.PORT || 3001;
const baseUrl = `http://localhost:${PORT}`;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

let authCookie = '';
let testPageId = null;
const testPageSlug = 'integration-test-page';

before(async () => {
  console.log('Starting Integration Test Suite...');
  // Give database connection a small moment to resolve if needed
  await new Promise(resolve => setTimeout(resolve, 500));
});

after(async () => {
  console.log('Tests finished. Closing resources...');
  server.close();
  await db.pool.end();
  console.log('Server and DB connection pool terminated.');
});

// ----------------------------------------------------
// Integration Tests
// ----------------------------------------------------

test('1. API Health Check', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.strictEqual(res.status, 200);
  
  const data = await res.json();
  assert.strictEqual(data.status, 'ok');
  assert.strictEqual(data.database, 'connected');
});

test('2. Public SSR rendering - Home Page', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.strictEqual(res.status, 200);
  
  const text = await res.text();
  assert.match(text, /Welcome to NovaCMS/);
  assert.match(text, /class="main-header"/);
  assert.match(text, /<footer>/);
});

test('3. Admin Login Failure (Invalid Credentials)', async () => {
  const wrongPassword = ADMIN_PASSWORD === 'wrongpassword' ? 'differentpassword' : 'wrongpassword';
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: wrongPassword })
  });
  
  assert.strictEqual(res.status, 401);
  const data = await res.json();
  assert.strictEqual(data.error, 'Invalid username or password');
});

test('4. Admin Login Success & Cookie Generation', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: ADMIN_PASSWORD })
  });
  
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.message, 'Login successful');
  assert.strictEqual(data.user.username, 'admin');

  // Extract session Cookie token
  const setCookieHeader = res.headers.get('set-cookie');
  assert.ok(setCookieHeader, 'Should receive set-cookie header');
  
  // Parse the token cookie part
  authCookie = setCookieHeader.split(';')[0];
  assert.match(authCookie, /token=/);
});

test('5. Verify Login Status Endpoint', async () => {
  // With cookie
  const res = await fetch(`${baseUrl}/api/auth/status`, {
    headers: { 'Cookie': authCookie }
  });
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.loggedIn, true);
  assert.strictEqual(data.user.username, 'admin');

  // Without cookie
  const resNoCookie = await fetch(`${baseUrl}/api/auth/status`);
  const dataNoCookie = await resNoCookie.json();
  assert.strictEqual(dataNoCookie.loggedIn, false);
});

test('6. Admin Pages Fetch Access Control', async () => {
  // Unauthorized request
  const unauthRes = await fetch(`${baseUrl}/api/admin/pages`);
  assert.strictEqual(unauthRes.status, 401);

  // Authorized request
  const authRes = await fetch(`${baseUrl}/api/admin/pages`, {
    headers: { 'Cookie': authCookie }
  });
  assert.strictEqual(authRes.status, 200);
  const pages = await authRes.json();
  assert.ok(Array.isArray(pages));
  
  // Seed files check
  const homePage = pages.find(p => p.slug === 'home');
  assert.ok(homePage);
  assert.strictEqual(homePage.title, 'Welcome to NovaCMS');
});

test('7. Admin Pages CRUD Flow & SSR Draft Security', async () => {
  // A. Create draft page
  const createRes = await fetch(`${baseUrl}/api/admin/pages`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': authCookie
    },
    body: JSON.stringify({
      title: 'Integration Test Page',
      slug: testPageSlug,
      content: '<p>Integration testing in progress</p>',
      status: 'draft'
    })
  });
  
  assert.strictEqual(createRes.status, 201);
  const newPage = await createRes.json();
  testPageId = newPage.id;
  assert.strictEqual(newPage.slug, testPageSlug);
  assert.strictEqual(newPage.status, 'draft');

  // B. Verify draft page returns 404 for anonymous users
  const anonViewRes = await fetch(`${baseUrl}/${testPageSlug}`);
  assert.strictEqual(anonViewRes.status, 404);

  // C. Verify draft page can be previewed by logged-in admin
  const adminViewRes = await fetch(`${baseUrl}/${testPageSlug}`, {
    headers: { 'Cookie': authCookie }
  });
  assert.strictEqual(adminViewRes.status, 200);
  const previewText = await adminViewRes.text();
  assert.match(previewText, /Draft Preview/);
  assert.match(previewText, /Integration testing in progress/);

  // D. Update page status to 'published'
  const updateRes = await fetch(`${baseUrl}/api/admin/pages/${testPageId}`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': authCookie
    },
    body: JSON.stringify({
      title: 'Integration Test Page (Published)',
      slug: testPageSlug,
      content: '<p>Integration testing completed and published</p>',
      status: 'published'
    })
  });
  assert.strictEqual(updateRes.status, 200);
  const updatedPage = await updateRes.json();
  assert.strictEqual(updatedPage.status, 'published');
  assert.strictEqual(updatedPage.title, 'Integration Test Page (Published)');

  // E. Verify page is now renderable to anonymous users
  const anonViewPubRes = await fetch(`${baseUrl}/${testPageSlug}`);
  assert.strictEqual(anonViewPubRes.status, 200);
  const pubText = await anonViewPubRes.text();
  assert.match(pubText, /Integration testing completed and published/);
  assert.doesNotMatch(pubText, /Draft Preview/);

  // F. Delete the page
  const deleteRes = await fetch(`${baseUrl}/api/admin/pages/${testPageId}`, {
    method: 'DELETE',
    headers: { 'Cookie': authCookie }
  });
  assert.strictEqual(deleteRes.status, 200);

  // G. Verify page returns 404 after deletion
  const postDeleteRes = await fetch(`${baseUrl}/${testPageSlug}`);
  assert.strictEqual(postDeleteRes.status, 404);
});

test('8. Admin Settings Updates', async () => {
  const settingsRes = await fetch(`${baseUrl}/api/admin/settings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': authCookie
    },
    body: JSON.stringify({
      site_name: 'NovaCMS Integration Test',
      site_description: 'Updated settings via automated test',
      site_footer: '© 2026 Test Suite Footer',
      accent_color: '#10b981',
      site_theme: 'cyberpunk'
    })
  });

  assert.strictEqual(settingsRes.status, 200);

  // Verify updates retrieve from settings GET API
  const getRes = await fetch(`${baseUrl}/api/admin/settings`, {
    headers: { 'Cookie': authCookie }
  });
  assert.strictEqual(getRes.status, 200);
  const settings = await getRes.json();
  assert.strictEqual(settings.site_theme, 'cyberpunk');
  
  // Verify updates reflect on homepage rendering
  const homeRes = await fetch(`${baseUrl}/`);
  const text = await homeRes.text();
  assert.match(text, /NovaCMS Integration Test/);
  assert.match(text, /© 2026 Test Suite Footer/);
  assert.match(text, /--accent: #10b981/);
  assert.match(text, /Share Tech Mono/);
  assert.match(text, /linear-gradient\(rgba\(0, 240, 255, 0.02\) 1px/);
});

test('9. Media Folder Creation and Navigation', async () => {
  // A. Create folder "test-media-folder"
  const createFolderRes = await fetch(`${baseUrl}/api/admin/media/folder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': authCookie
    },
    body: JSON.stringify({
      path: '',
      name: 'test-media-folder'
    })
  });
  
  assert.strictEqual(createFolderRes.status, 201);
  const folderData = await createFolderRes.json();
  assert.strictEqual(folderData.folder.name, 'test-media-folder');
  assert.strictEqual(folderData.folder.relativePath, 'test-media-folder');

  // B. Get media items in root (should contain the new folder)
  const rootMediaRes = await fetch(`${baseUrl}/api/admin/media`, {
    headers: { 'Cookie': authCookie }
  });
  assert.strictEqual(rootMediaRes.status, 200);
  const rootMedia = await rootMediaRes.json();
  assert.strictEqual(rootMedia.currentPath, '');
  const testFolderItem = rootMedia.items.find(item => item.name === 'test-media-folder');
  assert.ok(testFolderItem);
  assert.strictEqual(testFolderItem.type, 'directory');

  // C. Get media items in the subfolder (should be empty placeholder list)
  const subFolderMediaRes = await fetch(`${baseUrl}/api/admin/media?path=test-media-folder`, {
    headers: { 'Cookie': authCookie }
  });
  assert.strictEqual(subFolderMediaRes.status, 200);
  const subFolderMedia = await subFolderMediaRes.json();
  assert.strictEqual(subFolderMedia.currentPath, 'test-media-folder');
  assert.strictEqual(subFolderMedia.items.length, 0);
});

test('10. Media Upload Validation (PDF vs non-PDF)', async () => {
  // A. Upload valid PDF
  const pdfFormData = new FormData();
  const pdfBlob = new Blob(['%PDF-1.4 dummy pdf content'], { type: 'application/pdf' });
  pdfFormData.append('path', 'test-media-folder');
  pdfFormData.append('file', pdfBlob, 'integration-test.pdf');

  const pdfUploadRes = await fetch(`${baseUrl}/api/admin/media/upload`, {
    method: 'POST',
    headers: { 'Cookie': authCookie },
    body: pdfFormData
  });
  
  assert.strictEqual(pdfUploadRes.status, 201);
  const pdfUploadData = await pdfUploadRes.json();
  assert.strictEqual(pdfUploadData.file.name, 'integration-test.pdf');
  assert.match(pdfUploadData.file.url, /\/uploads\/test-media-folder\/integration-test.pdf/);

  // B. List folder and verify PDF exists
  const subFolderMediaRes = await fetch(`${baseUrl}/api/admin/media?path=test-media-folder`, {
    headers: { 'Cookie': authCookie }
  });
  const subFolderMedia = await subFolderMediaRes.json();
  const pdfItem = subFolderMedia.items.find(item => item.name === 'integration-test.pdf');
  assert.ok(pdfItem);
  assert.strictEqual(pdfItem.type, 'file');
  assert.strictEqual(pdfItem.url, '/uploads/test-media-folder/integration-test.pdf');

  // C. Download the PDF and verify content/status
  const downloadRes = await fetch(`${baseUrl}${pdfItem.url}`);
  assert.strictEqual(downloadRes.status, 200);
  const downloadText = await downloadRes.text();
  assert.strictEqual(downloadText, '%PDF-1.4 dummy pdf content');

  // D. Upload invalid file (txt) - should fail
  const txtFormData = new FormData();
  const txtBlob = new Blob(['dummy text content'], { type: 'text/plain' });
  txtFormData.append('path', 'test-media-folder');
  txtFormData.append('file', txtBlob, 'integration-test.txt');

  const txtUploadRes = await fetch(`${baseUrl}/api/admin/media/upload`, {
    method: 'POST',
    headers: { 'Cookie': authCookie },
    body: txtFormData
  });
  
  assert.strictEqual(txtUploadRes.status, 400);
  const txtUploadData = await txtUploadRes.json();
  assert.strictEqual(txtUploadData.error, 'Only PDF files are allowed!');
});

test('11. Media Sandbox Directory Traversal Security', async () => {
  // A. Traversal listing check - should fail
  const listTraversalRes = await fetch(`${baseUrl}/api/admin/media?path=../../src`, {
    headers: { 'Cookie': authCookie }
  });
  assert.strictEqual(listTraversalRes.status, 400);
  const listData = await listTraversalRes.json();
  assert.strictEqual(listData.error, 'Directory traversal attempt detected');

  // B. Traversal folder creation check - should fail
  const folderTraversalRes = await fetch(`${baseUrl}/api/admin/media/folder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': authCookie
    },
    body: JSON.stringify({
      path: '../..',
      name: 'traversal-attack'
    })
  });
  assert.strictEqual(folderTraversalRes.status, 400);
  const folderData = await folderTraversalRes.json();
  assert.strictEqual(folderData.error, 'Directory traversal attempt detected');

  // C. Cleanup: Delete folder "test-media-folder"
  const deleteRes = await fetch(`${baseUrl}/api/admin/media`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': authCookie
    },
    body: JSON.stringify({
      path: 'test-media-folder'
    })
  });
  assert.strictEqual(deleteRes.status, 200);

  // D. Verify folder is gone
  const rootMediaRes = await fetch(`${baseUrl}/api/admin/media`, {
    headers: { 'Cookie': authCookie }
  });
  const rootMedia = await rootMediaRes.json();
  const testFolderItem = rootMedia.items.find(item => item.name === 'test-media-folder');
  assert.ok(!testFolderItem);
});

test('12. Fetch Available Folder Widgets list', async () => {
  const res = await fetch(`${baseUrl}/api/admin/media/folders`, {
    headers: { 'Cookie': authCookie }
  });
  assert.strictEqual(res.status, 200);
  const folders = await res.json();
  assert.ok(Array.isArray(folders));
  // Should contain at least the root (represented by empty string)
  assert.ok(folders.includes(''));
});

test('13. Page PDF Folder Widget Rendering (SSR)', async () => {
  // A. Create a temporary folder
  await fetch(`${baseUrl}/api/admin/media/folder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': authCookie
    },
    body: JSON.stringify({ path: '', name: 'widget-test-folder' })
  });

  // B. Upload a test PDF to this folder
  const pdfFormData = new FormData();
  const pdfBlob = new Blob(['%PDF-1.4 dummy widget pdf content'], { type: 'application/pdf' });
  pdfFormData.append('path', 'widget-test-folder');
  pdfFormData.append('file', pdfBlob, 'widget-doc.pdf');

  await fetch(`${baseUrl}/api/admin/media/upload`, {
    method: 'POST',
    headers: { 'Cookie': authCookie },
    body: pdfFormData
  });

  // C. Create a page containing the folder widget html
  const createRes = await fetch(`${baseUrl}/api/admin/pages`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': authCookie
    },
    body: JSON.stringify({
      title: 'Widget SSR Page',
      slug: 'widget-ssr-page',
      content: '<p>Before widget</p><div class="pdf-folder-widget" data-folder="widget-test-folder"></div><p>After widget</p>',
      status: 'published'
    })
  });
  assert.strictEqual(createRes.status, 201);
  const newPage = await createRes.json();
  const pageId = newPage.id;

  // D. Render the page and check if PDF lists are generated
  const renderRes = await fetch(`${baseUrl}/widget-ssr-page`);
  assert.strictEqual(renderRes.status, 200);
  const html = await renderRes.text();

  assert.match(html, /class="pdf-public-widget"/);
  assert.match(html, /Documents: widget-test-folder/);
  assert.match(html, /widget-doc\.pdf/);
  assert.match(html, /href="\/uploads\/widget-test-folder\/widget-doc\.pdf"/);

  // E. Cleanup page and media
  await fetch(`${baseUrl}/api/admin/pages/${pageId}`, {
    method: 'DELETE',
    headers: { 'Cookie': authCookie }
  });

  await fetch(`${baseUrl}/api/admin/media`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': authCookie
    },
    body: JSON.stringify({ path: 'widget-test-folder' })
  });
});

