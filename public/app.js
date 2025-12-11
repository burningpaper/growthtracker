const API_URL = '/api';
let leads = [];
window.allLeads = []; // Global for reports filtering
let editingLeadId = null;
let statusChartInstance = null;
let clientChartInstance = null;

function displayUserInfo(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userInfoDiv = document.getElementById('user-info');
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');

        const name = payload.name || storedUser.name || 'User';
        const email = payload.email || storedUser.email || '';

        if (userInfoDiv) {
            userInfoDiv.innerHTML = `<strong>${name}</strong> <span style="opacity: 0.7;">(${email})</span>`;
        }
    } catch (e) {
        console.error('Error parsing user info', e);
    }
}

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('visible');
    });

    const targetView = document.getElementById(`${viewName}-view`);
    if (targetView) {
        targetView.classList.remove('hidden');
    }

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    if (viewName === 'reports') {
        fetchReportsData();
    }
}

function setupEventListeners() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => switchView(btn.dataset.view);
    });

    const modal = document.getElementById('lead-modal');
    const newLeadBtn = document.getElementById('new-lead-btn');
    const newLeadBtnDash = document.getElementById('new-lead-btn-dash');
    const closeBtn = document.querySelector('.close-modal');
    const form = document.getElementById('lead-form');
    const logoutBtn = document.getElementById('logout-btn');

    // Filter Event Listeners
    ['dash', 'report'].forEach(prefix => {
        const ids = [`${prefix}-filter-client`, `${prefix}-filter-month`, `${prefix}-filter-status`];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => filterLeads(prefix));
            }
        });
    });

    const openModal = () => {
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.add('visible'), 10);
    };

    const closeModal = () => {
        modal.classList.remove('visible');
        setTimeout(() => modal.classList.add('hidden'), 300);
    };

    if (newLeadBtn) newLeadBtn.onclick = openModal;
    if (newLeadBtnDash) newLeadBtnDash.onclick = openModal;

    if (closeBtn) closeBtn.onclick = closeModal;

    window.onclick = (event) => {
        if (event.target == modal) closeModal();
    };

    if (logoutBtn) {
        logoutBtn.onclick = () => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        };
    }

    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();

            const leadData = {
                client: document.getElementById('client-name').value,
                title: document.getElementById('opportunity-title').value,
                date: document.getElementById('lead-date').value,
                value: parseFloat(document.getElementById('lead-value').value),
                likelihood: parseInt(document.getElementById('lead-likelihood').value),
                status: document.getElementById('lead-status').value
            };

            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_URL}/leads`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(leadData)
                });

                if (res.ok) {
                    modal.style.display = 'none';
                    form.reset();
                    const range = document.getElementById('lead-likelihood');
                    if (range && range.nextElementSibling) range.nextElementSibling.value = '50%';

                    fetchLeads();
                } else {
                    alert('Error creating lead');
                }
            } catch (err) {
                console.error(err);
                alert('Error connecting to server');
            }
        };
    }
}

async function fetchReportsData() {
    try {
        const token = localStorage.getItem('token');
        console.log('Fetching reports data...');
        const res = await fetch(`${API_URL}/leads/all`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const allLeads = await res.json();
            window.allLeads = allLeads;
            console.log('Reports data received:', allLeads);

            if (allLeads.length === 0) console.warn('No leads found for reports');

            populateFilters(allLeads, 'report');
            renderCharts(allLeads);
            renderAllLeadsTable(allLeads);
        } else {
            console.error('Failed to fetch reports:', res.status, res.statusText);
        }
    } catch (err) {
        console.error('Error fetching reports:', err);
    }
}

function renderCharts(leads) {
    console.log('Rendering charts with', leads.length, 'leads');

    const statusCounts = {};
    leads.forEach(l => {
        statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
    });

    const statusCtx = document.getElementById('statusChart').getContext('2d');
    if (statusChartInstance) statusChartInstance.destroy();

    statusChartInstance = new Chart(statusCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { color: '#94a3b8' } } }
        }
    });

    const clientValues = {};
    leads.forEach(l => {
        clientValues[l.client] = (clientValues[l.client] || 0) + parseFloat(l.value);
    });

    const sortedClients = Object.entries(clientValues)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

    const clientCtx = document.getElementById('clientChart').getContext('2d');
    if (clientChartInstance) clientChartInstance.destroy();

    clientChartInstance = new Chart(clientCtx, {
        type: 'bar',
        data: {
            labels: sortedClients.map(([name]) => name),
            datasets: [{
                label: 'Total Value (R)',
                data: sortedClients.map(([, val]) => val),
                backgroundColor: '#6366f1',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function renderAllLeadsTable(leads) {
    const tbody = document.getElementById('all-leads-list');
    if (!tbody) return;

    tbody.innerHTML = '';

    leads.forEach(lead => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${lead.owner_name || 'Unknown'}</td>
            <td>${lead.client}</td>
            <td>${lead.title}</td>
            <td>R${parseFloat(lead.value).toLocaleString()}</td>
            <td><span class="status-badge status-${lead.status.toLowerCase().replace(' ', '-')}">${lead.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

async function fetchLeads() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/leads`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
            return;
        }

        leads = await res.json();
        populateFilters(leads, 'dash');
        renderLeadsTable(leads);
        updateStats(leads);
    } catch (err) {
        console.error(err);
    }
}

function populateFilters(data, prefix) {
    const clientSelect = document.getElementById(`${prefix}-filter-client`);
    const monthSelect = document.getElementById(`${prefix}-filter-month`);

    if (!clientSelect || !monthSelect) return;

    const clients = [...new Set(data.map(l => l.client))].sort();
    const months = [...new Set(data.map(l => {
        const d = new Date(l.date);
        return `${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    }))].sort().reverse();

    const currentClient = clientSelect.value;
    const currentMonth = monthSelect.value;

    clientSelect.innerHTML = '<option value="">All Clients</option>';
    clients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        clientSelect.appendChild(opt);
    });

    monthSelect.innerHTML = '<option value="">All Months</option>';
    months.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        monthSelect.appendChild(opt);
    });

    if (clients.includes(currentClient)) clientSelect.value = currentClient;
    if (months.includes(currentMonth)) monthSelect.value = currentMonth;
}

function applyFilters(data, prefix) {
    const clientVal = document.getElementById(`${prefix}-filter-client`).value;
    const monthVal = document.getElementById(`${prefix}-filter-month`).value;
    const statusVal = document.getElementById(`${prefix}-filter-status`).value;

    console.log(`Filtering ${prefix}:`, { clientVal, monthVal, statusVal, totalData: data.length });

    return data.filter(lead => {
        const leadDate = new Date(lead.date);
        const leadMonth = `${String(leadDate.getMonth() + 1).padStart(2, '0')}-${leadDate.getFullYear()}`;

        const matchClient = !clientVal || lead.client === clientVal;
        const matchMonth = !monthVal || leadMonth === monthVal;
        const matchStatus = !statusVal || lead.status === statusVal;

        return matchClient && matchMonth && matchStatus;
    });
}

function filterLeads(prefix) {
    let dataToFilter = [];
    let renderFunc = null;

    if (prefix === 'dash') {
        dataToFilter = leads;
        renderFunc = renderLeadsTable;
    } else if (prefix === 'report') {
        dataToFilter = window.allLeads || [];
        renderFunc = renderAllLeadsTable;
    }

    console.log(`filterLeads called for ${prefix}. Data size: ${dataToFilter.length}`);

    const filtered = applyFilters(dataToFilter, prefix);
    console.log(`Filtered result: ${filtered.length} leads`);

    renderFunc(filtered);

    if (prefix === 'dash') {
        updateFooterTotal(filtered);
    }
}

function renderLeadsTable(leadsToRender) {
    const tbody = document.getElementById('leads-list');
    if (!tbody) return;

    tbody.innerHTML = '';

    leadsToRender.forEach(lead => {
        const tr = document.createElement('tr');
        if (editingLeadId === lead.id) {
            tr.innerHTML = `
                <td><input type="text" class="edit-input" id="edit-client-${lead.id}" value="${lead.client}"></td>
                <td><input type="text" class="edit-input" id="edit-title-${lead.id}" value="${lead.title}"></td>
                <td><input type="number" class="edit-input" id="edit-value-${lead.id}" value="${lead.value}"></td>
                <td>
                    <select class="edit-input" id="edit-status-${lead.id}">
                        <option value="Identified" ${lead.status === 'Identified' ? 'selected' : ''}>Identified</option>
                        <option value="Contacted" ${lead.status === 'Contacted' ? 'selected' : ''}>Contacted</option>
                        <option value="Proposal Sent" ${lead.status === 'Proposal Sent' ? 'selected' : ''}>Proposal Sent</option>
                        <option value="Won" ${lead.status === 'Won' ? 'selected' : ''}>Won</option>
                        <option value="Lost" ${lead.status === 'Lost' ? 'selected' : ''}>Lost</option>
                    </select>
                </td>
                <td><input type="number" class="edit-input" id="edit-likelihood-${lead.id}" value="${lead.likelihood}"></td>
                <td>
                    <button class="btn-sm btn-save" onclick="saveLead(${lead.id})">Save</button>
                    <button class="btn-sm btn-cancel" onclick="cancelEdit()">Cancel</button>
                </td>
            `;
        } else {
            tr.innerHTML = `
                <td>${lead.client}</td>
                <td>${lead.title}</td>
                <td>R${parseFloat(lead.value).toLocaleString()}</td>
                <td><span class="status-badge status-${lead.status.toLowerCase().replace(' ', '-')}">${lead.status}</span></td>
                <td>${lead.likelihood}%</td>
                <td>
                    <button class="btn-sm btn-edit" onclick="editLead(${lead.id})">Edit</button>
                </td>
            `;
        }
        tbody.appendChild(tr);
    });

    updateFooterTotal(leadsToRender);
}

function updateFooterTotal(currentLeads) {
    const footerVal = document.getElementById('total-value-footer');
    if (!footerVal) return;

    const totalValue = currentLeads.reduce((sum, lead) => sum + parseFloat(lead.value || 0), 0);
    footerVal.textContent = `R${totalValue.toLocaleString()}`;
}

function updateStats(currentLeads) {
    const totalLeadsEl = document.getElementById('total-leads');
    const activeValueEl = document.getElementById('active-value');
    const winRateEl = document.getElementById('win-rate');

    if (!totalLeadsEl || !activeValueEl || !winRateEl) return;

    const totalLeads = currentLeads.length;
    const activeLeads = currentLeads.filter(l => l.status !== 'Won' && l.status !== 'Lost');
    const activeValue = activeLeads.reduce((sum, l) => sum + parseFloat(l.value || 0), 0);
    const wonLeads = currentLeads.filter(l => l.status === 'Won').length;
    const lostLeads = currentLeads.filter(l => l.status === 'Lost').length;
    const closedLeads = wonLeads + lostLeads;
    const winRate = closedLeads > 0 ? Math.round((wonLeads / closedLeads) * 100) : 0;

    totalLeadsEl.textContent = totalLeads;
    activeValueEl.textContent = `R${activeValue.toLocaleString()}`;
    winRateEl.textContent = `${winRate}%`;
}

// Inline Editing Functions
window.editLead = (id) => {
    editingLeadId = id;
    filterLeads('dash');
};

window.cancelEdit = () => {
    editingLeadId = null;
    filterLeads('dash');
};

window.saveLead = async (id) => {
    const updatedLead = {
        client: document.getElementById(`edit-client-${id}`).value,
        title: document.getElementById(`edit-title-${id}`).value,
        value: parseFloat(document.getElementById(`edit-value-${id}`).value),
        status: document.getElementById(`edit-status-${id}`).value,
        likelihood: parseInt(document.getElementById(`edit-likelihood-${id}`).value),
        date: new Date().toISOString()
    };

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/leads/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updatedLead)
        });

        if (res.ok) {
            editingLeadId = null;
            fetchLeads();
        } else {
            alert('Error updating lead');
        }
    } catch (err) {
        console.error(err);
        alert('Error connecting to server');
    }
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    displayUserInfo(token);
    fetchLeads();
    setupEventListeners();
});
