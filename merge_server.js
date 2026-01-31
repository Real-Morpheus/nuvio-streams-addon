const fs = require('fs');

// Read the restored server.js (Original V2 logic)
const originalServer = fs.readFileSync('server_restored.js', 'utf8');

// We need to inject:
// 1. TokenManager
// 2. Cookie/Session Parser
// 3. Auth Routes (Login, Logout, Dashboard)
// 4. Token Middleware for Addon Routes
// 5. Static File Restructuring (Public vs Templates)

let newServer = originalServer;

// --- 1. Imports ---
const importsToAdd = `
const TokenManager = require('./utils/tokenManager');
const tokenManager = new TokenManager();
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'nuvio2026';
`;
newServer = newServer.replace("const { spawn } = require('child_process');", "const { spawn } = require('child_process');" + importsToAdd);

// --- 2. Middleware & Static Files ---
// Replace the old static middleware
const staticBlock = `
// Serve public assets (bg.png, css, js) from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// JSON Body Parser for Login API
app.use(express.json());

// Auth Middleware
const requireAuth = (req, res, next) => {
    const authCookie = req.headers.cookie;
    if (authCookie && authCookie.includes('admin_session=true')) {
        next();
    } else {
        if (req.xhr || req.path.startsWith('/api/')) {
            res.status(401).json({ error: 'Unauthorized' });
        } else {
            res.redirect('/');
        }
    }
};

// Token Middleware
const checkToken = (req, res, next) => {
    const token = req.params.token;
    if (tokenManager.isValid(token)) {
        next();
    } else {
         if (req.path.endsWith('manifest.json')) {
            res.json({
                id: 'com.nuvio.error',
                version: '1.0.0',
                name: 'Access Denied',
                description: 'Invalid or expired token. Please contact the administrator.',
                resources: [], types: [], catalogs: []
            });
        } else {
            res.status(403).send('Invalid Access Token');
        }
    }
};
`;

newServer = newServer.replace("app.use(express.static(path.join(__dirname, 'views')));", staticBlock);
// Remove secondary static line if present or just keep it (it serves /static/...)
// The original had: app.use('/static', express.static(path.join(__dirname, 'static'))); -> Keep this.

// --- 3. Routes ---

// Replace the old *configure route
const routesBlock = `
// --- AUTH DATA ---
// Simple in-memory session check via cookie (Signature would be better but this is MVP)

// ROOT: Login Page (Public)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// DASHBOARD: Admin Panel (Protected)
app.get('/dashboard', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'admin.html'));
});

// API: Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER && password === ADMIN_PASS) {
        res.cookie('admin_session', 'true', { httpOnly: true, maxAge: 86400000 }); // 1 day
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false });
    }
});

// API: Logout
app.post('/api/logout', (req, res) => {
    res.clearCookie('admin_session');
    res.json({ success: true });
});

// API: Token Management
app.get('/api/token/list', requireAuth, (req, res) => {
    res.json(tokenManager.getAllTokens());
});
app.post('/api/token/create', requireAuth, (req, res) => {
    const { name } = req.body;
    res.json(tokenManager.createToken(name));
});
app.post('/api/token/delete', requireAuth, (req, res) => {
    const { token } = req.body;
    tokenManager.deleteToken(token) ? res.json({success:true}) : res.status(404).json({error:'Not found'});
});

// CONFIGURE: User Configuration Page (Protected by Token)
app.get('/:token/configure', checkToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'configure.html'));
});

// MANIFEST: Protected by Token
// We need to change the mount point of the generic manifest handler.
// The original server.js had 'app.get('*manifest.json', ...)' which catches EVERYTHING.
// We must restrict it.
`;

// Remove the old *configure route
newServer = newServer.replace(/app\.get\('\*configure'[\s\S]*?\}\);/, routesBlock);

// Fix Manifest Handler
// Change app.get('*manifest.json' to app.get('/:token/manifest.json', checkToken
newServer = newServer.replace("app.get('*manifest.json',", "app.get('/:token/manifest.json', checkToken,");

// Fix Addon Interface Mounting
// Original: app.use(createCustomRouter(addonInterface));
// New: app.use('/:token', checkToken, createCustomRouter(addonInterface));
newServer = newServer.replace("app.use(createCustomRouter(addonInterface));", "app.use('/:token', checkToken, createCustomRouter(addonInterface));");

// BLOCK PUBLIC MANIFEST
// Add a handler at the end (before export) to catch /manifest.json and 403 it?
// Or just let it 404 since we moved the logic to /:token/manifest.json.
// But we want to be explicit "Access Denied" manifest.
const blockPublicHandler = `
app.get('/manifest.json', (req, res) => {
    res.status(403).json({
        id: 'com.nuvio.error',
        version: '1.0.0',
        name: 'Access Denied',
        description: 'You must use a valid token link to access this addon.',
        resources: [], types: [], catalogs: []
    });
});
`;
// Insert before module.exports
newServer = newServer.replace("module.exports = app;", blockPublicHandler + "\nmodule.exports = app;");


fs.writeFileSync('server_final.js', newServer);
console.log('Merged server_final.js successfully');
