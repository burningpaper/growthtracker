const API_URL = '/api';
let leads = [];
let editingLeadId = null;

// Check for token on load
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

function setupEventListeners() {
    const modal = document.getElementById('lead-modal');
    const newLeadBtn = document.getElementById('new-lead-btn');
    const newLeadBtnDash = document.getElementById('new-lead-btn-dash');
    const closeBtn = document.querySelector('.close-modal');
    const form = document.getElementById('lead-form');
    const logoutBtn = document.getElementById('logout-btn');
    const clientFilter = document.getElementById('client-filter');

    const openModal = () => {
        modal.classList.remove('hidden');
        // Small timeout to allow display:flex to apply before opacity transition
        setTimeout(() => modal.classList.add('visible'), 10);
    };

    const closeModal = () => {
        modal.classList.remove('visible');
        setTimeout(() => modal.classList.add('hidden'), 300); // Wait for transition
    };

    if (newLeadBtn) newLeadBtn.onclick = openModal;
    if (newLeadBtnDash) newLeadBtnDash.onclick = openModal;

    if (closeBtn) {
        closeBtn.onclick = closeModal;
    }

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

    if (clientFilter) {
        clientFilter.addEventListener('input', (e) => {
            filterLeads(e.target.value);
        });
    }

    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();

            const leadData = {
                client: document.getElementById('client-name').value, // Fixed ID
                title: document.getElementById('opportunity-title').value, // Fixed ID
                date: document.getElementById('lead-date').value, // Fixed ID
                value: parseFloat(document.getElementById('lead-value').value), // Fixed ID
                likelihood: parseInt(document.getElementById('lead-likelihood').value), // Fixed ID
                status: document.getElementById('lead-status').value // Fixed ID
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
                    // Reset range output
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
        renderLeadsTable(leads);
        updateStats(leads);
    } catch (err) {
        console.error(err);
    }
}

function filterLeads(query) {
    const lowerQuery = query.toLowerCase();
    const filtered = leads.filter(lead =>
        lead.client.toLowerCase().includes(lowerQuery)
    );
    renderLeadsTable(filtered);
    updateFooterTotal(filtered);
}

function renderLeadsTable(leadsToRender) {
    const tbody = document.getElementById('leads-list');
    if (!tbody) return;

    tbody.innerHTML = '';

    leadsToRender.forEach(lead => {
        const tr = document.createElement('tr');

        if (editingLeadId === lead.id) {
            // Render Edit Mode
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
            // Render View Mode
            tr.innerHTML = `
                <td>${lead.client}</td>
                <td>${lead.title}</td>
                <td>$${parseFloat(lead.value).toLocaleString()}</td>
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
    footerVal.textContent = `$${totalValue.toLocaleString()}`;
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
    activeValueEl.textContent = `$${activeValue.toLocaleString()}`;
    winRateEl.textContent = `${winRate}%`;
}

// Inline Editing Functions
window.editLead = (id) => {
    editingLeadId = id;
    const filterVal = document.getElementById('client-filter').value;
    filterLeads(filterVal);
};

window.cancelEdit = () => {
    editingLeadId = null;
    const filterVal = document.getElementById('client-filter').value;
    filterLeads(filterVal);
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
