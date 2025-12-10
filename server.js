const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.')); // Serve static files from root

// Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Initialize Database Schema
async function initDb() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS leads (
                id SERIAL PRIMARY KEY,
                client VARCHAR(255) NOT NULL,
                title VARCHAR(255) NOT NULL,
                date DATE,
                value NUMERIC,
                likelihood INTEGER,
                status VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Database schema initialized');
    } catch (err) {
        console.error('❌ Error initializing database:', err);
    }
}

initDb();

// Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Growth Tracker API is running' });
});

app.get('/api/leads', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM leads ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/leads', async (req, res) => {
    const { client, title, date, value, likelihood, status } = req.body;

    try {
        const result = await pool.query(
            'INSERT INTO leads (client, title, date, value, likelihood, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [client, title, date, value, likelihood, status]
        );

        const newLead = result.rows[0];
        console.log(`[New Lead] ${newLead.client} - ${newLead.title}`);

        // Trigger Notifications
        sendTeamsNotification(newLead, 'New Opportunity Identified');
        sendEmailNotification(newLead, 'New Opportunity Identified');

        res.status(201).json(newLead);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.put('/api/leads/:id', async (req, res) => {
    const { id } = req.params;
    const { client, title, date, value, likelihood, status } = req.body;

    try {
        // Get old status first for notifications
        const oldLeadResult = await pool.query('SELECT status FROM leads WHERE id = $1', [id]);

        if (oldLeadResult.rows.length === 0) {
            return res.status(404).json({ error: 'Lead not found' });
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
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
