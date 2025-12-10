const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// In-memory data store (for now, replacing LocalStorage eventually)
let leads = [];

// Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Growth Tracker API is running' });
});

app.get('/api/leads', (req, res) => {
    res.json(leads);
});

app.post('/api/leads', (req, res) => {
    const newLead = req.body;
    if (!newLead.id) {
        newLead.id = Date.now().toString();
    }
    newLead.createdAt = new Date().toISOString();
    leads.unshift(newLead);
    console.log(`[New Lead] ${newLead.client} - ${newLead.title}`);

    // Trigger Notifications
    sendTeamsNotification(newLead, 'New Opportunity Identified');
    sendEmailNotification(newLead, 'New Opportunity Identified');

    res.status(201).json(newLead);
});

app.put('/api/leads/:id', (req, res) => {
    const { id } = req.params;
    const updatedLead = req.body;
    const index = leads.findIndex(l => l.id === id);

    if (index !== -1) {
        const oldStatus = leads[index].status;
        leads[index] = { ...leads[index], ...updatedLead };
        console.log(`[Updated Lead] ${leads[index].client} - Status: ${leads[index].status}`);

        // Trigger Notifications on status change
        if (oldStatus !== leads[index].status) {
            sendTeamsNotification(leads[index], `Status Changed to ${leads[index].status}`);
            sendEmailNotification(leads[index], `Status Changed to ${leads[index].status}`);
        }

        res.json(leads[index]);
    } else {
        res.status(404).json({ error: 'Lead not found' });
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
