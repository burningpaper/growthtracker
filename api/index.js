const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve static files from the public directory (for local development)
app.use(express.static(path.join(__dirname, '../public')));

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Serve index.html for root route (local dev fallback)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// ... initDb ...

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
            [name, email, hashedPassword]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error registering user' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (user && await bcrypt.compare(password, user.password_hash)) {
            const token = jwt.sign({ id: user.id, name: user.name }, JWT_SECRET);
            res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error logging in' });
    }
});

// Helper to format PEM keys
const formatKey = (key, type) => {
    if (!key) return null;

    // Detect header type
    const isRSA = key.includes('RSA PRIVATE KEY') || key.includes('RSA PUBLIC KEY');
    const algo = isRSA ? 'RSA ' : '';

    // Remove all whitespace and literal newlines first
    let clean = key.replace(/\\n/g, '').replace(/\s+/g, '');

    // Strip existing headers
    clean = clean.replace(/-----BEGIN[A-Z ]+-----/g, '').replace(/-----END[A-Z ]+-----/g, '');

    // Chunk body into 64 chars
    const chunked = clean.match(/.{1,64}/g).join('\n');

    // Re-wrap with correct header
    const header = type === 'PUBLIC'
        ? `-----BEGIN ${algo}PUBLIC KEY-----`
        : `-----BEGIN ${algo}PRIVATE KEY-----`;
    const footer = type === 'PUBLIC'
        ? `-----END ${algo}PUBLIC KEY-----`
        : `-----END ${algo}PRIVATE KEY-----`;

    return `${header}\n${chunked}\n${footer}`;
};

app.post('/api/auth/sso', async (req, res) => {
    const { token } = req.body;

    try {
        const rawKey = process.env.SSO_PUBLIC_KEY;
        if (!rawKey) throw new Error('SSO_PUBLIC_KEY not configured');

        const formattedKey = formatKey(rawKey, 'PUBLIC');
        // Validate key
        const publicKey = require('crypto').createPublicKey(formattedKey);

        // Verify the token using the Public Key Object
        const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
        const { email, name } = decoded;

        if (!email) {
            return res.status(400).json({ error: 'Invalid token: missing email' });
        }

        // Check if user exists
        let result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        let user = result.rows[0];

        if (!user) {
            // Provision new user
            const dummyHash = await bcrypt.hash(Math.random().toString(36), 10);
            const newUserResult = await pool.query(
                'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
                [name || email.split('@')[0], email, dummyHash]
            );
            user = newUserResult.rows[0];
            console.log(`[SSO] Provisioned new user: ${email}`);
        } else {
            console.log(`[SSO] Logged in user: ${email}`);
        }

        const sessionToken = jwt.sign({ id: user.id, name: user.name }, JWT_SECRET);
        res.json({ token: sessionToken, user: { id: user.id, name: user.name, email: user.email } });

    } catch (err) {
        console.error('[SSO Error]', err.message);
        res.status(401).json({ error: 'Invalid SSO token: ' + err.message });
    }
});

// Dev Endpoint to Generate SSO Token (For Testing)
app.post('/api/dev/sso-token', async (req, res) => {
    const { email, name } = req.body;

    try {
        const rawKey = process.env.SSO_PRIVATE_KEY;
        if (!rawKey) throw new Error('SSO_PRIVATE_KEY not configured');

        let formattedKey = formatKey(rawKey, 'PRIVATE');
        let privateKey;

        try {
            privateKey = require('crypto').createPrivateKey(formattedKey);
        } catch (e) {
            console.log('Failed to parse with default header, trying RSA header...');
            // Try forcing RSA header
            const clean = rawKey.replace(/\\n/g, '').replace(/\s+/g, '')
                .replace(/-----BEGIN[A-Z ]+-----/g, '').replace(/-----END[A-Z ]+-----/g, '');
            const chunked = clean.match(/.{1,64}/g).join('\n');
            formattedKey = `-----BEGIN RSA PRIVATE KEY-----\n${chunked}\n-----END RSA PRIVATE KEY-----`;
            try {
                privateKey = require('crypto').createPrivateKey(formattedKey);
            } catch (e2) {
                throw e; // Throw original error if both fail
            }
        }

        const token = jwt.sign({ email, name }, privateKey, { algorithm: 'RS256', expiresIn: '1h' });
        res.json({ token });
    } catch (err) {
        console.error('SSO Token Generation Error:', err.message);
        res.status(500).json({ error: 'Error generating token: ' + err.message });
    }
});

// Lead Routes (Protected)
app.get('/api/leads', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM leads WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/leads', authenticateToken, async (req, res) => {
    const { client, title, date, value, likelihood, status } = req.body;

    try {
        const result = await pool.query(
            'INSERT INTO leads (client, title, date, value, likelihood, status, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [client, title, date, value, likelihood, status, req.user.id]
        );

        const newLead = result.rows[0];
        console.log(`[New Lead] ${newLead.client} - ${newLead.title} (User: ${req.user.id})`);

        // Trigger Notifications
        sendTeamsNotification(newLead, 'New Opportunity Identified');
        sendEmailNotification(newLead, 'New Opportunity Identified');

        res.status(201).json(newLead);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.put('/api/leads/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { client, title, date, value, likelihood, status } = req.body;

    try {
        // Get old status first for notifications & verify ownership
        const oldLeadResult = await pool.query('SELECT status, user_id FROM leads WHERE id = $1', [id]);

        if (oldLeadResult.rows.length === 0) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        if (oldLeadResult.rows[0].user_id !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const oldStatus = oldLeadResult.rows[0].status;

        const result = await pool.query(
            'UPDATE leads SET client = $1, title = $2, date = $3, value = $4, likelihood = $5, status = $6 WHERE id = $7 RETURNING *',
            [client, title, date, value, likelihood, status, id]
        );

        const updatedLead = result.rows[0];
        console.log(`[Updated Lead] ${updatedLead.client} - Status: ${updatedLead.status}`);

        // Trigger Notifications on status change
        if (oldStatus !== updatedLead.status) {
            sendTeamsNotification(updatedLead, `Status Changed to ${updatedLead.status}`);
            sendEmailNotification(updatedLead, `Status Changed to ${updatedLead.status}`);
        }

        res.json(updatedLead);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Notification Stubs
function sendTeamsNotification(lead, action) {
    console.log(`[MS Teams] 🔔 Notification: ${action} for client ${lead.client}`);
    // In a real app, this would use axios to post to a Teams Webhook URL
}

function sendEmailNotification(lead, action) {
    console.log(`[Email] 📧 Sending email to team: ${action} for client ${lead.client}`);
    // In a real app, this would use nodemailer
}

// Start Server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
