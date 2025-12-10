// App State
const state = {
    leads: [],
    view: 'dashboard'
};

// DOM Elements
const elements = {
    newLeadBtn: document.getElementById('new-lead-btn'),
    leadModal: document.getElementById('lead-modal'),
    closeModalBtns: document.querySelectorAll('.close-modal'),
    leadForm: document.getElementById('lead-form'),
    leadsList: document.getElementById('leads-list'),
    totalLeadsCount: document.getElementById('total-leads-count'),
    activeValueSum: document.getElementById('active-value-sum'),
    winRateCalc: document.getElementById('win-rate-calc'),
    navBtns: document.querySelectorAll('.nav-btn'),
    views: document.querySelectorAll('.view')
};

// Initialization
function init() {
    loadLeads();
    setupEventListeners();
    renderDashboard();
    console.log('Growth Tracker Initialized 🚀');
}

// Event Listeners
function setupEventListeners() {
    // Modal controls
    elements.newLeadBtn.addEventListener('click', () => toggleModal(true));
    elements.closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => toggleModal(false));
    });

    // Form submission
    elements.leadForm.addEventListener('submit', handleNewLead);

    // Navigation
    elements.navBtns.forEach(btn => {
        btn.addEventListener('click', (e) => switchView(e.target.dataset.view));
    });
}

// Logic
async function loadLeads() {
    try {
        const response = await fetch('http://localhost:3000/api/leads');
        const leads = await response.json();
        state.leads = leads;
        renderDashboard();
    } catch (error) {
        console.error('Failed to load leads:', error);
        // Fallback or error UI
    }
}

function toggleModal(show) {
    if (show) {
        elements.leadModal.classList.remove('hidden');
        // Small delay to allow display:block to apply before opacity transition
        setTimeout(() => elements.leadModal.classList.add('visible'), 10);
    } else {
        elements.leadModal.classList.remove('visible');
        setTimeout(() => elements.leadModal.classList.add('hidden'), 300);
    }
}

function toggleModal(show) {
    if (show) {
        elements.leadModal.classList.remove('hidden');
        // Small delay to allow display:block to apply before opacity transition
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
        const response = await fetch('http://localhost:3000/api/leads', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
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

    // Update Nav
    elements.navBtns.forEach(btn => {
        if (btn.dataset.view === viewName) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    // Update View
    elements.views.forEach(view => {
        if (view.id === `${viewName}-view`) view.classList.remove('hidden');
        else view.classList.add('hidden');
    });

    if (viewName === 'reports') {
        renderReports();
    }
}

// Rendering
function renderDashboard() {
    // Update Summary
    elements.totalLeadsCount.textContent = state.leads.length;

    const totalValue = state.leads.reduce((sum, lead) => sum + (lead.value || 0), 0);
    elements.activeValueSum.textContent = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalValue);

    const wonLeads = state.leads.filter(l => l.status === 'won').length;
    const closedLeads = state.leads.filter(l => l.status === 'won' || l.status === 'lost').length;
    const winRate = closedLeads > 0 ? Math.round((wonLeads / closedLeads) * 100) : 0;
    elements.winRateCalc.textContent = `${winRate}%`;

    // Render List
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
        // Inline styles for card for now, move to CSS later
        card.style.background = 'var(--surface-light)';
        card.style.padding = '20px';
        card.style.borderRadius = 'var(--radius-md)';
        card.style.border = '1px solid rgba(255,255,255,0.05)';

        const dateStr = lead.date ? new Date(lead.date).toLocaleDateString() : 'No Date';

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <span style="color:var(--primary-color); font-weight:600; font-size:0.9rem;">${lead.client}</span>
                <span class="status-badge" style="background:rgba(255,255,255,0.1); padding:4px 8px; border-radius:4px; font-size:0.8rem; text-transform:capitalize;">${lead.status}</span>
            </div>
            <h3 style="margin-bottom:15px; font-size:1.1rem;">${lead.title}</h3>
            <div style="display:flex; justify-content:space-between; color:var(--text-muted); font-size:0.9rem; margin-bottom: 8px;">
                <span>Target: ${dateStr}</span>
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
