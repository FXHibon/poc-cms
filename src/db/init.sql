-- NovaCMS Database Schema

-- Drop tables if they exist (for clean re-initialization during tests)
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS pages;
DROP TABLE IF EXISTS users;

-- Create Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Pages table
CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft' or 'published'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Settings table
CREATE TABLE settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL
);

-- Seed default settings
INSERT INTO settings (key, value) VALUES
('site_name', 'NovaCMS'),
('site_description', 'A premium, modern proof-of-concept Content Management System.'),
('site_footer', '© 2026 NovaCMS. Built with Antigravity.'),
('accent_color', '#8b5cf6') -- Default violet accent
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Seed default home page
INSERT INTO pages (slug, title, content, status) VALUES
('home', 'Welcome to NovaCMS', '<h1>Welcome to NovaCMS</h1><p>This is your brand new, server-side rendered home page. You can customize this content, create new pages, and manage settings in the administrator dashboard.</p><p>To access the admin panel, head over to <a href="/admin">/admin</a>.</p>', 'published'),
('about', 'About Us', '<h1>About Us</h1><p>NovaCMS is a lightweight CMS built as a proof of concept. It features a modern dark mode theme with elegant glassmorphism and a responsive administration dashboard.</p>', 'published')
ON CONFLICT (slug) DO UPDATE SET 
    title = EXCLUDED.title,
    content = EXCLUDED.content,
    status = EXCLUDED.status;
