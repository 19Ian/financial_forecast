let financialData = null;
let mainChart = null;

// Enhanced initialization to load from localStorage if available
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Try to load from localStorage first
        const localData = loadDataLocally();
        
        if (localData) {
            financialData = localData;
            showNotification('Loaded saved changes from browser storage', 'info');
        } else {
            // Load from JSON file
            const response = await fetch('financial_data.json');
            financialData = await response.json();
        }
        
        // Add unique IDs to transactions if they don't exist
        financialData.transactions.forEach((transaction, index) => {
            if (!transaction.id) {
                transaction.id = Date.now() + index;
            }
        });
        
        initializeDashboard();
        
        // Add form event listener AFTER data is loaded
        const form = document.getElementById('addTransactionForm');
        if (form) {
            form.addEventListener('submit', function(e) {
                console.log('Form submitted');
                e.preventDefault();
                addTransaction();
            });
        } else {
            console.error('Add transaction form not found!');
        }
        
    } catch (error) {
        console.error('Error loading financial data:', error);
        alert('Error loading financial data. Make sure you have run the Python script first.');
    }
});

function updateStats() {
    const metadata = financialData.metadata;
    const transactions = financialData.transactions;
    
    document.getElementById('startingBalance').textContent = formatCurrency(metadata.starting_balance);
    
    // Calculate current balance from transactions
    const currentBalance = calculateCurrentBalance();
    document.getElementById('currentBalance').textContent = formatCurrency(currentBalance);
    
    const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpenses = Math.abs(transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0));
    
    document.getElementById('totalIncome').textContent = formatCurrency(totalIncome);
    document.getElementById('totalExpenses').textContent = formatCurrency(totalExpenses);
    
    // Update balance color
    const currentBalanceElement = document.getElementById('currentBalance');
    currentBalanceElement.className = 'stat-value ' + (currentBalance >= 0 ? 'positive' : 'negative');
}

function calculateCurrentBalance() {
    const startingBalance = financialData.metadata.starting_balance;
    const totalChange = financialData.transactions.reduce((sum, t) => sum + t.amount, 0);
    return startingBalance + totalChange;
}

function updateDateRange() {
    const metadata = financialData.metadata;
    document.getElementById('dateRange').textContent = 
        `${formatDate(metadata.start_date)} - ${formatDate(metadata.end_date)}`;
}

function updateCharts() {
    const chartType = document.getElementById('chartType').value;
    const timeRange = document.getElementById('timeRange').value;
    
    const filteredData = filterDataByTimeRange(timeRange);
    
    if (mainChart) {
        mainChart.destroy();
    }
    
    const ctx = document.getElementById('mainChart').getContext('2d');
    
    switch(chartType) {
        case 'balance':
            createBalanceChart(ctx, filteredData);
            break;
        case 'transactions':
            createTransactionChart(ctx, filteredData);
            break;
        case 'monthly':
            createMonthlyChart(ctx, filteredData);
            break;
        case 'categories':
            createCategoryChart(ctx, filteredData);
            break;
    }
}

function getDarkChartOptions(baseOptions = {}) {
    return {
        ...baseOptions,
        plugins: {
            ...baseOptions.plugins,
            legend: {
                labels: {
                    color: '#e0e0e0'
                }
            }
        },
        scales: {
            ...baseOptions.scales,
            x: {
                ...baseOptions.scales?.x,
                ticks: {
                    ...baseOptions.scales?.x?.ticks,
                    color: '#b0b0b0'
                },
                grid: {
                    color: '#444'
                }
            },
            y: {
                ...baseOptions.scales?.y,
                ticks: {
                    ...baseOptions.scales?.y?.ticks,
                    color: '#b0b0b0',
                    callback: function(value) {
                        return formatCurrency(value);
                    }
                },
                grid: {
                    color: '#444'
                }
            }
        }
    };
}

function createBalanceChart(ctx, data) {
    // Recalculate balance data based on current transactions
    const balanceData = recalculateBalanceData();
    
    const options = getDarkChartOptions({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            tooltip: {
                backgroundColor: '#2a2a2a',
                titleColor: '#ffffff',
                bodyColor: '#e0e0e0',
                borderColor: '#444',
                borderWidth: 1,
                callbacks: {
                    label: function(context) {
                        return 'Balance: ' + formatCurrency(context.parsed.y);
                    }
                }
            }
        }
    });
    
    mainChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: balanceData.map(d => formatDate(d.date)),
            datasets: [{
                label: 'Account Balance',
                data: balanceData.map(d => d.balance),
                borderColor: '#4caf50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                fill: true,
                tension: 0.1
            }]
        },
        options: options
    });
}

function createTransactionChart(ctx, data) {
    const transactions = data.transactions.slice(-20);
    
    const options = getDarkChartOptions({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            tooltip: {
                backgroundColor: '#2a2a2a',
                titleColor: '#ffffff',
                bodyColor: '#e0e0e0',
                borderColor: '#444',
                borderWidth: 1
            }
        }
    });
    
    mainChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: transactions.map(t => t.name),
            datasets: [{
                label: 'Transaction Amount',
                data: transactions.map(t => t.amount),
                backgroundColor: transactions.map(t => 
                    t.type === 'income' ? 'rgba(76, 175, 80, 0.8)' : 'rgba(244, 67, 54, 0.8)'
                ),
                borderColor: transactions.map(t => 
                    t.type === 'income' ? '#4caf50' : '#f44336'
                ),
                borderWidth: 1
            }]
        },
        options: options
    });
}

function createMonthlyChart(ctx, data) {
    const monthlyData = aggregateByMonth(data.transactions);
    
    const options = getDarkChartOptions({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            tooltip: {
                backgroundColor: '#2a2a2a',
                titleColor: '#ffffff',
                bodyColor: '#e0e0e0',
                borderColor: '#444',
                borderWidth: 1,
                callbacks: {
                    label: function(context) {
                        return context.dataset.label + ': ' + formatCurrency(Math.abs(context.parsed.y));
                    }
                }
            }
        }
    });
    
    mainChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(monthlyData),
            datasets: [{
                label: 'Income',
                data: Object.values(monthlyData).map(m => m.income),
                backgroundColor: 'rgba(76, 175, 80, 0.8)',
                borderColor: '#4caf50',
                borderWidth: 1
            }, {
                label: 'Expenses',
                data: Object.values(monthlyData).map(m => -m.expenses),
                backgroundColor: 'rgba(244, 67, 54, 0.8)',
                borderColor: '#f44336',
                borderWidth: 1
            }]
        },
        options: options
    });
}

function createCategoryChart(ctx, data) {
    const categoryData = aggregateByCategory(data.transactions);
    
    mainChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categoryData),
            datasets: [{
                data: Object.values(categoryData).map(c => Math.abs(c)),
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                    '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#e0e0e0'
                    }
                },
                tooltip: {
                    backgroundColor: '#2a2a2a',
                    titleColor: '#ffffff',
                    bodyColor: '#e0e0e0',
                    borderColor: '#444',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + formatCurrency(context.parsed);
                        }
                    }
                }
            }
        }
    });
}

function updateTransactionList() {
    console.log('updateTransactionList() called');
    console.log('Total transactions:', financialData.transactions.length);
    
    const transactions = financialData.transactions.slice(-100).reverse();
    console.log('Transactions to display:', transactions.length);
    
    const listContainer = document.getElementById('transactionList');
    
    if (!listContainer) {
        console.error('Transaction list container not found!');
        return;
    }
    
    listContainer.innerHTML = transactions.map(transaction => `
        <div class="transaction-item ${transaction.isNew ? 'new-transaction' : ''}">
            <div class="transaction-details">
                <strong>${transaction.name}</strong>
                <br>
                <small>${formatDate(transaction.date)}</small>
            </div>
            <div class="transaction-actions">
                <span class="${transaction.type === 'income' ? 'positive' : 'negative'}">
                    ${formatCurrency(transaction.amount)}
                </span>
                <button class="delete-btn" onclick="deleteTransaction(${transaction.id})">
                    Delete
                </button>
            </div>
        </div>
    `).join('');
    
    console.log('Transaction list HTML updated');
}

// Modal functions
function openAddTransactionModal() {
    document.getElementById('addTransactionModal').style.display = 'block';
    // Set default date to today
    document.getElementById('transactionDate').value = new Date().toISOString().split('T')[0];
}

function closeAddTransactionModal() {
    document.getElementById('addTransactionModal').style.display = 'none';
    document.getElementById('addTransactionForm').reset();
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('addTransactionModal');
    if (event.target === modal) {
        closeAddTransactionModal();
    }
}

function addTransaction() {
    console.log('addTransaction() called');
    
    const name = document.getElementById('transactionName').value;
    const amount = parseFloat(document.getElementById('transactionAmount').value);
    const type = document.getElementById('transactionType').value;
    const date = document.getElementById('transactionDate').value;
    
    console.log('Form values:', { name, amount, type, date });
    
    if (!name || !amount || !type || !date) {
        alert('Please fill in all fields');
        return;
    }
    
    const newTransaction = {
        id: Date.now(),
        date: date,
        name: name,
        amount: type === 'expense' ? -Math.abs(amount) : Math.abs(amount),
        type: type,
        isNew: true
    };
    
    console.log('New transaction:', newTransaction);
    console.log('Transactions before adding:', financialData.transactions.length);
    
    // Add to transactions array
    financialData.transactions.push(newTransaction);
    
    console.log('Transactions after adding:', financialData.transactions.length);
    
    // Sort transactions by date
    financialData.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Save to localStorage
    saveDataLocally();
    
    console.log('About to call updateWithAnimation()');
    
    // Update everything with visual feedback
    updateWithAnimation();
    
    closeAddTransactionModal();
    showNotification(`Added "${name}" transaction for ${formatCurrency(newTransaction.amount)}`, 'success');
    
    // Remove "new" flag after 5 seconds
    setTimeout(() => {
        newTransaction.isNew = false;
        updateTransactionList();
    }, 5000);
}

function deleteTransaction(transactionId) {
    const transaction = financialData.transactions.find(t => t.id === transactionId);
    if (!transaction) return;
    
    if (confirm(`Are you sure you want to delete "${transaction.name}" (${formatCurrency(transaction.amount)})?`)) {
        const index = financialData.transactions.findIndex(t => t.id === transactionId);
        if (index !== -1) {
            financialData.transactions.splice(index, 1);
            saveDataLocally();
            updateWithAnimation();
            showNotification(`Deleted "${transaction.name}" transaction`, 'success');
        }
    }
}

function updateWithAnimation() {
    console.log('updateWithAnimation() called');
    
    // Update stats first
    updateStats();
    
    // Update charts
    updateCharts();
    
    // Update transaction list with animation
    updateTransactionList();
    
    // Flash the stats to show they've changed
    document.querySelectorAll('.stat-card').forEach((card, index) => {
        setTimeout(() => {
            card.style.transform = 'scale(1.05)';
            setTimeout(() => {
                card.style.transform = 'scale(1)';
            }, 200);
        }, index * 100);
    });
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 6px;
        color: white;
        font-weight: bold;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        background-color: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Add CSS for notification animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    .new-transaction {
        background-color: rgba(76, 175, 80, 0.2) !important;
        border-left: 3px solid #4caf50;
        animation: newTransactionGlow 2s ease-in-out;
    }
    @keyframes newTransactionGlow {
        0% { box-shadow: 0 0 5px rgba(76, 175, 80, 0.8); }
        50% { box-shadow: 0 0 15px rgba(76, 175, 80, 0.6); }
        100% { box-shadow: 0 0 5px rgba(76, 175, 80, 0.3); }
    }
`;
document.head.appendChild(style);

function recalculateBalanceData() {
    // Sort transactions by date
    const sortedTransactions = [...financialData.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const balanceData = [];
    let runningBalance = financialData.metadata.starting_balance;
    
    // Add starting balance
    balanceData.push({
        date: financialData.metadata.start_date,
        balance: runningBalance
    });
    
    // Calculate balance for each transaction
    sortedTransactions.forEach(transaction => {
        runningBalance += transaction.amount;
        balanceData.push({
            date: transaction.date,
            balance: runningBalance
        });
    });
    
    return balanceData;
}

function filterDataByTimeRange(timeRange) {
    if (timeRange === 'all') {
        return financialData;
    }
    
    const now = new Date();
    let cutoffDate;
    
    switch(timeRange) {
        case '1month':
            cutoffDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            break;
        case '3months':
            cutoffDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
            break;
        case '6months':
            cutoffDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
            break;
        default:
            return financialData;
    }
    
    const cutoffString = cutoffDate.toISOString().split('T')[0];
    
    return {
        ...financialData,
        balance_data: financialData.balance_data.filter(d => d.date >= cutoffString),
        transactions: financialData.transactions.filter(t => t.date >= cutoffString)
    };
}

function aggregateByMonth(transactions) {
    const monthly = {};
    
    transactions.forEach(transaction => {
        const date = new Date(transaction.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthly[monthKey]) {
            monthly[monthKey] = { income: 0, expenses: 0 };
        }
        
        if (transaction.type === 'income') {
            monthly[monthKey].income += transaction.amount;
        } else {
            monthly[monthKey].expenses += Math.abs(transaction.amount);
        }
    });
    
    return monthly;
}

function aggregateByCategory(transactions) {
    const categories = {};
    
    transactions.forEach(transaction => {
        const category = transaction.name.toLowerCase();
        
        if (!categories[category]) {
            categories[category] = 0;
        }
        
        categories[category] += Math.abs(transaction.amount);
    });
    
    // Sort by amount and take top 10
    const sorted = Object.entries(categories)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);
    
    return Object.fromEntries(sorted);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Save data to localStorage for persistence
function saveDataLocally() {
    localStorage.setItem('financialData', JSON.stringify(financialData));
}

function loadDataLocally() {
    const saved = localStorage.getItem('financialData');
    if (saved) {
        return JSON.parse(saved);
    }
    return null;
}

// Add keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + N to add new transaction
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        openAddTransactionModal();
    }
    
    // Escape to close modal
    if (e.key === 'Escape') {
        closeAddTransactionModal();
    }
});

// Add export functionality
function exportTransactions() {
    const dataStr = JSON.stringify(financialData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `financial_data_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showNotification('Financial data exported successfully!', 'success');
}

// Add reset functionality
function resetToOriginal() {
    if (confirm('Are you sure you want to reset all changes and reload the original data? This cannot be undone.')) {
        localStorage.removeItem('financialData');
        location.reload();
    }
}

// Add utility buttons
function addUtilityButtons() {
    const utilityHTML = `
        <div class="utility-buttons" style="margin-top: 20px; text-align: center;">
            <button class="btn btn-secondary" onclick="exportTransactions()" style="margin: 0 10px;">
                Export Data
            </button>
            <button class="btn btn-secondary" onclick="resetToOriginal()" style="margin: 0 10px;">
                Reset to Original
            </button>
        </div>
    `;
    
    // Add to the last chart container
    const lastContainer = document.querySelector('.chart-container:last-child');
    if (lastContainer) {
        lastContainer.insertAdjacentHTML('beforeend', utilityHTML);
    }
}

// Initialize dashboard
function initializeDashboard() {
    console.log('initializeDashboard() called');
    updateStats();
    updateCharts();
    updateTransactionList();
    updateDateRange();
    addUtilityButtons();
}
