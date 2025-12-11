// App State Management
const state = {
    leads: [],
    view: 'dashboard',
    user: JSON.parse(localStorage.getItem('user')) || null
};

// Auth Check
const token = localStorage.getItem('token');
if (!token) {
    window.location.href = 'login.html';
}

const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';

// DOM Elements
const elements = {
    navBtns: document.querySelectorAll('.nav-btn'),
    views: document.querySelectorAll('.view'),
    newLeadBtn: document.getElementById('new-lead-btn'),
    leadModal: document.getElementById('lead-modal'),
    closeModalBtns: document.querySelectorAll('.close-modal'),
    leadForm: document.getElementById('lead-form'),
    leadsList: document.getElementById('leads-list'),
    totalLeads: document.getElementById('total-leads-count'),
    activeValue: document.getElementById('active-value-sum'),
    winRate: document.getElementById('win-rate-calc'),
    logoutBtn: document.getElementById('logout-btn')
};

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    loadLeads();
    setupEventListeners();
    updateUserUI();
});

function setupEventListeners() {
    // Navigation
    elements.navBtns.forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    // Modal
    elements.newLeadBtn.addEventListener('click', () => toggleModal(true));
    elements.closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => toggleModal(false));
    });

    // Form
    elements.leadForm.addEventListener('submit', handleNewLead);

    // Logout
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', logout);
    }
}

function updateUserUI() {
    if (state.user) {
        // Could update UI with user name here
        console.log('Logged in as:', state.user.name);
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

// Logic
async function loadLeads() {
    try {
        const response = await fetch(`${API_URL}/leads`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.status === 401 || response.status === 403) {
            logout();
            return;
        }

        const leads = await response.json();
        state.leads = leads;
        renderDashboard();
    } catch (error) {
        console.error('Failed to load leads:', error);
    }
}

function toggleModal(show) {
    if (show) {
        elements.leadModal.classList.remove('hidden');
        setTimeout(() => elements.leadModal.classList.add('visible'), 10);
    } else {
        elements.leadModal.classList.remove('visible');
        setTimeout(() => elements.leadModal.classList.add('hidden'), 300);
    }
}

async function handleNewLead(e) {
    e.preventDefault();

    const formData = {
        client: document.getElementById('client-name').value,
        title: document.getElementById('opportunity-title').value,
        date: document.getElementById('lead-date').value,
        value: parseFloat(document.getElementById('lead-value').value),
        likelihood: parseInt(document.getElementById('lead-likelihood').value),
        status: document.getElementById('lead-status').value
    };

    try {
        const response = await fetch(`${API_URL}/leads`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            const newLead = await response.json();
            state.leads.unshift(newLead);
            renderDashboard();

            elements.leadForm.reset();
            document.querySelector('output').textContent = '50%';
            toggleModal(false);
        }
    } catch (error) {
        console.error('Failed to create lead:', error);
        alert('Error saving lead. Please try again.');
    }
}

function switchView(viewName) {
    state.view = viewName;

    elements.navBtns.forEach(btn => {
        if (btn.dataset.view === viewName) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    elements.views.forEach(view => {
        if (view.id === `${viewName}-view`) view.classList.remove('hidden');
        else view.classList.add('hidden');
    });

    if (viewName === 'reports') {
        renderReports();
    }
}

function renderDashboard() {
    // Stats
    elements.totalLeads.textContent = state.leads.length;

    const activeLeads = state.leads.filter(l => l.status !== 'won' && l.status !== 'lost');
    const totalValue = activeLeads.reduce((sum, l) => sum + Number(l.value), 0);
    elements.activeValue.textContent = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalValue);

    const wonCount = state.leads.filter(l => l.status === 'won').length;
    const closedCount = state.leads.filter(l => l.status === 'won' || l.status === 'lost').length;
    const winRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;
    elements.winRate.textContent = `${winRate}%`;

    // List
    elements.leadsList.innerHTML = '';

    if (state.leads.length === 0) {
        elements.leadsList.innerHTML = `
            <div class="empty-state">
                <p>No leads found. Start by adding a new opportunity!</p>
            </div>
        `;
        return;
    }

    state.leads.forEach(lead => {
        const card = document.createElement('div');
        card.className = 'lead-card';
        card.innerHTML = `
                <span>${lead.likelihood}% Prob.</span>
            </div>
            <div style="font-size: 1.2rem; font-weight: 700; color: var(--text-main);">
                ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(lead.value)}
            </div>
        `;
        elements.leadsList.appendChild(card);
    });
}

function renderReports() {
    const container = document.querySelector('.charts-container');
    container.innerHTML = '';
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
    container.style.gap = '20px';

    // Helper to create chart card
    const createChartCard = (title, contentHtml) => {
        const card = document.createElement('div');
        card.style.background = 'var(--surface-dark)';
        card.style.padding = '20px';
        card.style.borderRadius = 'var(--radius-md)';
        card.style.border = '1px solid var(--surface-light)';
        card.innerHTML = `<h3 style="margin-bottom:15px; color:var(--text-muted); font-size:0.9rem; text-transform:uppercase;">${title}</h3>${contentHtml}`;
        return card;
    };

    // 1. Leads by Status
    const statusCounts = state.leads.reduce((acc, lead) => {
        acc[lead.status] = (acc[lead.status] || 0) + 1;
        return acc;
    }, {});

    let statusHtml = '<div style="display:flex; flex-direction:column; gap:10px;">';
    for (const [status, count] of Object.entries(statusCounts)) {
        const percentage = Math.round((count / state.leads.length) * 100);
        statusHtml += `
            <div>
                <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:0.9rem;">
                    <span style="text-transform:capitalize;">${status}</span>
                    <span>${count} (${percentage}%)</span>
                </div>
                <div style="height:8px; background:rgba(255,255,255,0.1); border-radius:4px; overflow:hidden;">
                    <div style="height:100%; width:${percentage}%; background:var(--primary-color);"></div>
                </div>
            </div>
        `;
    }
    statusHtml += '</div>';
    container.appendChild(createChartCard('Leads by Status', statusHtml));

    // 2. Value by Client (Top 5)
    const clientValues = state.leads.reduce((acc, lead) => {
        acc[lead.client] = (acc[lead.client] || 0) + lead.value;
        return acc;
    }, {});

    const sortedClients = Object.entries(clientValues)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

    let clientHtml = '<div style="display:flex; flex-direction:column; gap:10px;">';
    const maxValue = sortedClients.length > 0 ? sortedClients[0][1] : 0;

    for (const [client, value] of sortedClients) {
        const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
        clientHtml += `
            <div>
                <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:0.9rem;">
                    <span>${client}</span>
                    <span>${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)}</span>
                </div>
                <div style="height:8px; background:rgba(255,255,255,0.1); border-radius:4px; overflow:hidden;">
                    <div style="height:100%; width:${percentage}%; background:var(--secondary-color);"></div>
                </div>
            </div>
        `;
    }
    clientHtml += '</div>';
    container.appendChild(createChartCard('Top Clients by Value', clientHtml));
}


// Run
init();
