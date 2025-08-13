let financialData = null;
let budgetData = [];
let bankData = []; // Add this line
let forecastChart = null;
let editingBudgetId = null;
let editingBankId = null;

// Enhanced initialization to load from localStorage if available
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Try to load from localStorage first
        const localData = loadDataLocally();
        
        if (localData) {
            financialData = localData;
            
            // Load budget data from the financial data or localStorage
            if (localData.budget && Array.isArray(localData.budget)) {
                budgetData = localData.budget;
                console.log('Loaded budget data from financial data:', budgetData.length, 'items');
            } else {
                // Fallback to separate budget storage
                const savedBudget = localStorage.getItem('budgetData');
                if (savedBudget) {
                    try {
                        budgetData = JSON.parse(savedBudget);
                        console.log('Loaded budget data from separate localStorage:', budgetData.length, 'items');
                    } catch (error) {
                        console.error('Error parsing budget data:', error);
                        budgetData = [];
                    }
                } else {
                    budgetData = [];
                }
            }
            
            // Load bank data
            if (localData.banks && Array.isArray(localData.banks)) {
                bankData = localData.banks;
                console.log('Loaded bank data:', bankData.length, 'accounts from local storage');
            } else {
                bankData = [];
            }
            
            showNotification('Loaded saved changes from browser storage', 'info');
        } else {
            // Load from JSON file
            console.log("before file fetch");
            const response = await fetch('new_financial_data.json');
            financialData = await response.json();
            console.log("banks from json: ", financialData.banks);
            console.log("budget info from json:", financialData.budget);
            
            // Initialize budget data from JSON or empty
            if (financialData.budget && Array.isArray(financialData.budget)) {
                budgetData = financialData.budget;
                console.log('Loaded budget data from JSON:', budgetData.length, 'items');
            } else {
                budgetData = [];
                console.log('No budget data in JSON, starting with empty budget');
            }
            
            // Initialize bank data from JSON or empty
            if (financialData.banks && Array.isArray(financialData.banks)) {
                bankData = financialData.banks;
                console.log('Loaded bank data from JSON:', bankData.length, 'accounts');
            } else {
                bankData = [];
                console.log('No bank data in JSON, starting with empty bank data');
            }
        }
        
        // Add unique IDs to budget items if they don't exist
        budgetData.forEach((budget, index) => {
            if (!budget.id) {
                budget.id = Date.now() + 1000 + index;
            }
        });
        
        // Add unique IDs to bank accounts if they don't exist
        bankData.forEach((bank, index) => {
            if (!bank.id) {
                bank.id = Date.now() + 2000 + index;
            }
        });
        
        initializeDashboard();
        
        // Add form event listeners AFTER data is loaded
        const budgetForm = document.getElementById('budgetForm');
        if (budgetForm) {
            budgetForm.addEventListener('submit', function(e) {
                console.log('Budget form submitted');
                e.preventDefault();
                saveBudgetItem();
            });
        }
        
        // Add bank form event listener
        const bankForm = document.getElementById('bankForm');
        if (bankForm) {
            bankForm.addEventListener('submit', function(e) {
                e.preventDefault();
                saveBankAccount();
            });
        }

		const budgetTypeSelect = document.getElementById('budgetType');
		if (budgetTypeSelect) {
			budgetTypeSelect.addEventListener('change', toggleBankSelection);
		}
        
    } catch (error) {
        console.error('Error loading financial data:', error);
        alert('Error loading financial data. Either import new data or start the server.');
    }
});


function updateStats() {
    // Calculate budget-based stats
    const today = new Date().toISOString().split('T')[0];
    const activeBudgetData = budgetData.filter(budget => {
        return !budget.endDate || budget.endDate >= today;
    });

    const monthlyIncome = activeBudgetData
        .filter(b => b.type === 'income')
        .reduce((sum, b) => sum + Math.abs(b.amount), 0);
    
    const monthlyExpenses = activeBudgetData
        .filter(b => b.type === 'expense')
        .reduce((sum, b) => sum + Math.abs(b.amount), 0);
    
    const netMonthly = monthlyIncome - monthlyExpenses;
    
    // Calculate current balance as sum of all bank account balances
    const totalBankBalance = bankData.reduce((sum, bank) => sum + (bank.balance || 0), 0);
    
    // Fallback to original data if no bank accounts exist
    const currentBalance = totalBankBalance > 0 ? totalBankBalance : (financialData?.metadata?.starting_balance || 0);
    
    document.getElementById('currentBalance').textContent = formatCurrency(currentBalance);
    document.getElementById('monthlyIncome').textContent = formatCurrency(monthlyIncome);
    document.getElementById('monthlyExpenses').textContent = formatCurrency(monthlyExpenses);
    document.getElementById('netMonthly').textContent = formatCurrency(netMonthly);
    
    // Update net monthly color
    const netMonthlyElement = document.getElementById('netMonthly');
    netMonthlyElement.className = 'stat-value ' + (netMonthly >= 0 ? 'positive' : 'negative');
    
    // Update current balance color based on amount
    const currentBalanceElement = document.getElementById('currentBalance');
    currentBalanceElement.className = 'stat-value ' + (currentBalance >= 0 ? 'positive' : 'negative');
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

function updateWithAnimation() {
    console.log('updateWithAnimation() called');
    
    // Update stats first
    updateStats();
    
    // Update budget list and forecast
    updateBudgetList();
    updateForecastChart();
    
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
`;
document.head.appendChild(style);

// Save data to localStorage for persistence
function saveDataLocally() {
    try {
        // Ensure budget data is included in financial data
        if (financialData && budgetData) {
            financialData.budget = budgetData;
        }
        
        localStorage.setItem('financialData', JSON.stringify(financialData));
        console.log('Financial data (including budget) saved to localStorage');
        console.log('Budget items saved:', budgetData.length);
    } catch (error) {
        console.error('Error saving financial data:', error);
        showNotification('Error saving data', 'error');
    }
}

function loadDataLocally() {
    const saved = localStorage.getItem('financialData');
    const localBudgetData = localStorage.getItem('budgetData');
    const localBankData = localStorage.getItem('bankData');
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (error) {
            console.error('Error parsing saved data:', error);
            return null;
        }
    }
    else if (localBudgetData && localBankData) {
        try {
            console.log("{\n\"budget\":\n" + localBudgetData + ",\n\"banks\":\n" + localBankData + "\n}");
            return JSON.parse("{\n\"budget\":\n" + localBudgetData + ",\n\"banks\":\n" + localBankData + "\n}");
        } catch (error) {
            console.error('Error parsing saved data:', error);
            return null;
        }
    }
    return null;
}

function saveBudgetData() {
    try {
        localStorage.setItem('budgetData', JSON.stringify(budgetData));
        console.log('Budget data saved to localStorage:', budgetData.length, 'items');
        
        // Also save to the main financial data structure
        if (financialData) {
            financialData.budget = budgetData;
            saveDataLocally();
        }
    } catch (error) {
        console.error('Error saving budget data:', error);
        showNotification('Error saving budget data', 'error');
    }
}

// Enhanced budget list update to highlight bank-generated items
function updateBudgetList() {
    const budgetList = document.getElementById('budgetList');
    if (!budgetList) return;

    const today = new Date().toISOString().split('T')[0];
    const activeBudgetData = budgetData.filter(budget => {
        return !budget.endDate || budget.endDate >= today;
    });

    // Calculate enhanced summary
    const totalIncome = activeBudgetData.filter(b => b.type === 'income').reduce((sum, b) => sum + Math.abs(b.amount), 0);
    const totalExpenses = activeBudgetData.filter(b => b.type === 'expense').reduce((sum, b) => sum + Math.abs(b.amount), 0);
    const netBudget = totalIncome - totalExpenses;
    
    const bankIncome = activeBudgetData.filter(b => b.type === 'income' && b.isAutoGenerated).reduce((sum, b) => sum + Math.abs(b.amount), 0);
    const linkedBankIncome = activeBudgetData.filter(b => b.type === 'income' && b.linkedBankId && !b.isAutoGenerated).reduce((sum, b) => sum + Math.abs(b.amount), 0);
    const linkedBankExpenses = activeBudgetData.filter(b => b.type === 'expense' && b.linkedBankId).reduce((sum, b) => sum + Math.abs(b.amount), 0);
    const otherIncome = totalIncome - bankIncome - linkedBankIncome;
    const otherExpenses = totalExpenses - linkedBankExpenses;

    const summaryHTML = `
        <div class="budget-summary">
            <div class="budget-summary-item">
                <h4>Monthly Income</h4>
                <div class="value positive">${formatCurrency(totalIncome)}</div>
            </div>
            <div class="budget-summary-item">
                <h4>Bank Interest</h4>
                <div class="value positive">${formatCurrency(bankIncome)}</div>
            </div>
            <div class="budget-summary-item">
                <h4>Bank-Linked Income</h4>
                <div class="value positive">${formatCurrency(linkedBankIncome)}</div>
            </div>
            <div class="budget-summary-item">
                <h4>Other Income</h4>
                <div class="value positive">${formatCurrency(otherIncome)}</div>
            </div>
            <div class="budget-summary-item">
                <h4>Bank-Linked Expenses</h4>
                <div class="value negative">${formatCurrency(linkedBankExpenses)}</div>
            </div>
            <div class="budget-summary-item">
                <h4>Other Expenses</h4>
                <div class="value negative">${formatCurrency(otherExpenses)}</div>
            </div>
            <div class="budget-summary-item">
                <h4>Net Monthly</h4>
                <div class="value ${netBudget >= 0 ? 'positive' : 'negative'}">${formatCurrency(netBudget)}</div>
            </div>
        </div>
    `;

    const budgetItemsHTML = budgetData.map(budget => {
        const isActive = !budget.endDate || budget.endDate >= today;
        const statusClass = isActive ? '' : 'style="opacity: 0.6; background-color: #444;"';
        const statusText = isActive ? '' : ' (Ended)';
        const isBankInterest = budget.isAutoGenerated && budget.name.includes('Interest');
        const isLinkedToBank = budget.linkedBankId && !budget.isAutoGenerated;
        
        let dateText = `Since ${formatDate(budget.startDate)}`;
        if (budget.endDate) {
            dateText += ` until ${formatDate(budget.endDate)}`;
        }
        
        // Get linked bank name and show appropriate action
        let bankInfo = '';
        if (isLinkedToBank) {
            const linkedBank = bankData.find(bank => bank.id == budget.linkedBankId);
            if (linkedBank) {
                const action = budget.type === 'income' ? 'Added to' : 'Deducted from';
                bankInfo = ` • ${action} ${linkedBank.name}`;
                
                // Add warning for expenses that might overdraw the account
                if (budget.type === 'expense' && linkedBank.balance < Math.abs(budget.amount) * 3) {
                    bankInfo += ' ⚠️';
                }
            }
        }
        
        return `
            <div class="budget-item" ${statusClass} 
                 ${isBankInterest ? 'data-bank-interest="true"' : ''} 
                 ${isLinkedToBank ? `data-bank-linked="true" data-bank-type="${budget.type}"` : ''}>
                <div class="budget-details">
                    <strong>${budget.name}${statusText}</strong>
                    <br>
                    <small>${dateText} • ${budget.type}${isBankInterest ? ' • Auto-generated' : ''}${bankInfo}</small>
                </div>
                <div class="budget-actions">
                    <span class="${budget.type === 'income' ? 'positive' : 'negative'}">
                        ${formatCurrency(Math.abs(budget.amount))}/month
                    </span>
                    <div>
                        ${!isBankInterest ? `
                            <button class="edit-btn" onclick="editBudgetItem(${budget.id})">
                                Edit
                            </button>
                            <button class="delete-btn" onclick="deleteBudgetItem(${budget.id})">
                                Delete
                            </button>
                        ` : `
                            <small style="color: #888;">Managed by bank</small>
                        `}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    budgetList.innerHTML = summaryHTML + budgetItemsHTML;
    
    setTimeout(() => {
        displayBudgetInsights();
        displayBankCashFlowInsights();
    }, 100);
}

// Budget modal functions
function openBudgetModal() {
    editingBudgetId = null;
    document.getElementById('budgetModalTitle').textContent = 'Add Budget Item';
    document.getElementById('budgetSubmitBtn').textContent = 'Add Budget Item';
    document.getElementById('budgetModal').style.display = 'block';
    document.getElementById('budgetStartDate').value = new Date().toISOString().split('T')[0];
}

function closeBudgetModal() {
    document.getElementById('budgetModal').style.display = 'none';
    document.getElementById('budgetForm').reset();
    document.getElementById('budgetEndDate').value = '';
    editingBudgetId = null;
}

function editBudgetItem(budgetId) {
    const budget = budgetData.find(b => b.id === budgetId);
    if (!budget) return;

    editingBudgetId = budgetId;
    document.getElementById('budgetModalTitle').textContent = 'Edit Budget Item';
    document.getElementById('budgetSubmitBtn').textContent = 'Update Budget Item';
    
    document.getElementById('budgetName').value = budget.name;
    document.getElementById('budgetAmount').value = Math.abs(budget.amount);
    document.getElementById('budgetType').value = budget.type;
    document.getElementById('budgetStartDate').value = budget.startDate;
    document.getElementById('budgetEndDate').value = budget.endDate || '';
    
    // Handle bank selection
    toggleBankSelection();
    if (budget.linkedBankId) {
        document.getElementById('budgetLinkedBank').value = budget.linkedBankId;
    }
    
    document.getElementById('budgetModal').style.display = 'block';
}

function deleteBudgetItem(budgetId) {
    const budget = budgetData.find(b => b.id === budgetId);
    if (!budget) return;

    if (confirm(`Are you sure you want to delete the budget item "${budget.name}"?`)) {
        budgetData = budgetData.filter(b => b.id !== budgetId);
        saveBudgetData();
        updateBudgetList();
        updateForecastChart();
        showNotification(`Deleted budget item "${budget.name}"`, 'success');
    }
}

function saveBudgetItem() {
    console.log('saveBudgetItem() called');
    
    const name = document.getElementById('budgetName').value.trim();
    const amount = parseFloat(document.getElementById('budgetAmount').value);
    const type = document.getElementById('budgetType').value;
    const startDate = document.getElementById('budgetStartDate').value;
    const endDate = document.getElementById('budgetEndDate').value;
    const linkedBankId = parseInt(document.getElementById('budgetLinkedBank').value, 10);

    console.log('Budget form values:', { name, amount, type, startDate, endDate, linkedBankId });

    // Validation
    if (!name || isNaN(amount) || amount <= 0 || !type || !startDate) {
        alert('Please fill in all fields with valid values. Amount must be greater than 0.');
        return;
    }

    if (endDate && endDate <= startDate) {
        alert('End date must be after start date.');
        return;
    }

    const budgetAmount = type === 'expense' ? -Math.abs(amount) : Math.abs(amount);

    if (editingBudgetId) {
        // Update existing budget item
        const budgetIndex = budgetData.findIndex(b => b.id === editingBudgetId);
        if (budgetIndex !== -1) {
            budgetData[budgetIndex] = {
                ...budgetData[budgetIndex],
                name,
                amount: budgetAmount,
                type,
                startDate,
                endDate: endDate || null,
                linkedBankId: linkedBankId || null
            };
            showNotification(`Updated budget item "${name}"`, 'success');
            console.log("Budget Item linked to: " + linkedBankId);
        }
    } else {
        // Add new budget item
        const newBudget = {
            id: Date.now(),
            name,
            amount: budgetAmount,
            type,
            startDate,
            endDate: endDate || null,
            linkedBankId: linkedBankId || null
        };
        budgetData.push(newBudget);
        showNotification(`Added budget item "${name}"`, 'success');
    }

    saveBudgetData();
    updateBudgetList();
    updateStats();
    updateForecastChart();
    closeBudgetModal();
}

// Forecast chart functions with multiple chart types
function updateForecastChart() {
    const ctx = document.getElementById('forecastChart');
    if (!ctx) return;

    const chartType = document.getElementById('forecastChartType')?.value || 'forecast';
    const months = parseInt(document.getElementById('forecastMonths')?.value || 12);

    if (forecastChart) {
        forecastChart.destroy();
    }

    switch(chartType) {
        case 'forecast':
            createForecastChart(ctx, months);
            break;
        case 'categories':
            createBudgetCategoryChart(ctx);
            break;
        case 'monthly':
            createMonthlyComparisonChart(ctx, months);
            break;
        case 'breakdown':
            createIncomeExpenseBreakdownChart(ctx);
            break;
    }
}

// Enhanced chart creation with bank interest visualization
function createForecastChart(ctx, months) {
    const forecastData = generateForecastData(months);

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
                        return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                    }
                }
            },
            legend: {
                labels: {
                    color: '#e0e0e0'
                }
            }
        }
    });

    // Create datasets for individual bank balances
    const datasets = [{
        label: 'Total Projected Balance',
        data: forecastData.balances,
        borderColor: '#4caf50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        fill: true,
        tension: 0.1
    }, {
        label: 'Monthly Budget Impact',
        data: forecastData.monthlyChanges,
        borderColor: '#2196f3',
        backgroundColor: 'rgba(33, 150, 243, 0.1)',
        fill: false,
        tension: 0.1,
        yAxisID: 'y1'
    }, {
        label: 'Bank Interest Earnings',
        data: forecastData.interestEarnings,
        borderColor: '#ff9800',
        backgroundColor: 'rgba(255, 152, 0, 0.1)',
        fill: false,
        tension: 0.1,
        yAxisID: 'y1'
    }];

    // Add individual bank balance lines if there are multiple banks
    if (bankData.length > 1 && forecastData.bankBalanceHistory) {
        const colors = ['#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#00bcd4', '#009688'];
        let colorIndex = 0;
        
        bankData.forEach(bank => {
            if (forecastData.bankBalanceHistory[bank.id]) {
                datasets.push({
                    label: `${bank.name} Balance`,
                    data: forecastData.bankBalanceHistory[bank.id],
                    borderColor: colors[colorIndex % colors.length],
                    backgroundColor: 'transparent',
                    fill: false,
                    tension: 0.1,
                    borderWidth: 2,
                    pointRadius: 2
                });
                colorIndex++;
            }
        });
    }

    forecastChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: forecastData.labels,
            datasets: datasets
        },
        options: {
            ...options,
            scales: {
                ...options.scales,
                y1: {
                    type: 'linear',
                    display: false,
                    position: 'right',
                    ticks: {
                        color: '#b0b0b0',
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    },
                    grid: {
                        drawOnChartArea: false,
                        color: '#444'
                    }
                }
            }
        }
    });
}

function createBudgetCategoryChart(ctx) {
    const today = new Date().toISOString().split('T')[0];
    const activeBudgetData = budgetData.filter(budget => {
        return !budget.endDate || budget.endDate >= today;
    });

    const categoryData = {};
    activeBudgetData.forEach(budget => {
        const category = budget.name;
        if (!categoryData[category]) {
            categoryData[category] = 0;
        }
        categoryData[category] += Math.abs(budget.amount);
    });

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
                        return context.label + ': ' + formatCurrency(context.parsed);
                    }
                }
            },
            legend: {
                labels: {
                    color: '#e0e0e0'
                }
            }
        }
    });

    forecastChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categoryData),
            datasets: [{
                data: Object.values(categoryData),
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                    '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
                ]
            }]
        },
        options: options
    });
}

function createMonthlyComparisonChart(ctx, months) {
    const forecastData = generateForecastData(months);
    
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

    // Calculate monthly income and expenses for each forecasted month
    const monthlyIncomeData = [];
    const monthlyExpenseData = [];
    
    const today = new Date();
    for (let i = 0; i < months; i++) {
        const forecastDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const forecastDateString = forecastDate.toISOString().split('T')[0];
        
        const activeBudgetItems = budgetData.filter(budget => {
            const startDate = budget.startDate;
            const endDate = budget.endDate;
            return startDate <= forecastDateString && 
                   (!endDate || endDate >= forecastDateString);
        });
        
        const monthlyIncome = activeBudgetItems
            .filter(b => b.type === 'income')
            .reduce((sum, b) => sum + Math.abs(b.amount), 0);
        
        const monthlyExpenses = activeBudgetItems
            .filter(b => b.type === 'expense')
            .reduce((sum, b) => sum + Math.abs(b.amount), 0);
        
        monthlyIncomeData.push(monthlyIncome);
        monthlyExpenseData.push(-monthlyExpenses);
    }

    forecastChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: forecastData.labels.slice(1), // Remove first label as it's current month
            datasets: [{
                label: 'Monthly Income',
                data: monthlyIncomeData,
                backgroundColor: 'rgba(76, 175, 80, 0.8)',
                borderColor: '#4caf50',
                borderWidth: 1
            }, {
                label: 'Monthly Expenses',
                data: monthlyExpenseData,
                backgroundColor: 'rgba(244, 67, 54, 0.8)',
                borderColor: '#f44336',
                borderWidth: 1
            }]
        },
        options: options
    });
}

function createIncomeExpenseBreakdownChart(ctx) {
    const today = new Date().toISOString().split('T')[0];
    const activeBudgetData = budgetData.filter(budget => {
        return !budget.endDate || budget.endDate >= today;
    });

    const incomeItems = activeBudgetData.filter(b => b.type === 'income');
    const expenseItems = activeBudgetData.filter(b => b.type === 'expense');

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

    forecastChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Income Sources', 'Expense Categories'],
            datasets: [{
                label: 'Income',
                data: [incomeItems.reduce((sum, item) => sum + Math.abs(item.amount), 0), 0],
                backgroundColor: 'rgba(76, 175, 80, 0.8)',
                borderColor: '#4caf50',
                borderWidth: 1
            }, {
                label: 'Expenses',
                data: [0, -expenseItems.reduce((sum, item) => sum + Math.abs(item.amount), 0)],
                backgroundColor: 'rgba(244, 67, 54, 0.8)',
                borderColor: '#f44336',
                borderWidth: 1
            }]
        },
        options: options
    });
}

// Enhanced forecast generation with compound interest projections
function generateForecastData(months) {
    const totalBankBalance = bankData.reduce((sum, bank) => sum + (bank.balance || 0), 0);
    const currentBalance = totalBankBalance > 0 ? totalBankBalance : (financialData?.metadata?.starting_balance || 0);
    
    const labels = [];
    const balances = [];
    const monthlyChanges = [];
    const interestEarnings = [];
    const bankBalanceHistory = {}; // Track individual bank balances over time
    
    let runningBalance = currentBalance;
    const today = new Date();
    
    // Initialize bank balances tracking
    let bankBalances = {};
    bankData.forEach(bank => {
        bankBalances[bank.id] = bank.balance || 0;
        bankBalanceHistory[bank.id] = [bank.balance || 0];
    });
    
    for (let i = 0; i <= months; i++) {
        const forecastDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const monthLabel = forecastDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short' 
        });
        
        const forecastDateString = forecastDate.toISOString().split('T')[0];
        
        // Get active budget items for this month
        const activeBudgetItems = budgetData.filter(budget => {
            const startDate = budget.startDate;
            const endDate = budget.endDate;
            return startDate <= forecastDateString && 
                   (!endDate || endDate >= forecastDateString);
        });
        
        // Process budget items that are linked to banks
        activeBudgetItems
            .filter(budget => budget.linkedBankId && !budget.isAutoGenerated)
            .forEach(budget => {
                const bankId = parseInt(budget.linkedBankId);
                if (bankBalances[bankId] !== undefined) {
                    if (budget.type === 'income') {
                        bankBalances[bankId] += Math.abs(budget.amount);
                    } else if (budget.type === 'expense') {
                        bankBalances[bankId] -= Math.abs(budget.amount);
                        // Prevent negative balances (could add overdraft fees later)
                        if (bankBalances[bankId] < 0) {
                            console.warn(`Bank ${bankId} went negative: ${bankBalances[bankId]}`);
                        }
                    }
                }
            });
        
        // Calculate interest for this month with updated balances
        let totalInterest = 0;
        bankData.forEach(bank => {
            if (bankBalances[bank.id] !== undefined && bankBalances[bank.id] > 0) {
                let monthlyInterest;
                if (bank.interestType === 'compound') {
                    monthlyInterest = bankBalances[bank.id] * (Math.pow(1 + bank.interestRate, 1/12) - 1);
                    bankBalances[bank.id] += monthlyInterest;
                } else {
                    // For simple interest, calculate based on current balance
                    monthlyInterest = bankBalances[bank.id] * bank.interestRate / 12;
                    bankBalances[bank.id] += monthlyInterest;
                }
                totalInterest += monthlyInterest;
            }
            
            // Store balance history for analysis
            if (bankBalanceHistory[bank.id]) {
                bankBalanceHistory[bank.id].push(bankBalances[bank.id] || 0);
            }
        });
        
        // Calculate total monthly budget impact (excluding auto-generated interest)
        const nonInterestBudgetTotal = activeBudgetItems
            .filter(budget => !budget.isAutoGenerated)
            .reduce((sum, budget) => sum + budget.amount, 0);
        
        const monthlyBudgetTotal = nonInterestBudgetTotal + totalInterest;
        
        labels.push(monthLabel);
        balances.push(runningBalance);
        monthlyChanges.push(monthlyBudgetTotal);
        interestEarnings.push(totalInterest);
        
        if (i < months) {
            runningBalance += monthlyBudgetTotal;
        }
    }
    
    return { 
        labels, 
        balances, 
        monthlyChanges, 
        interestEarnings, 
        bankBalanceHistory 
    };
}


function displayBudgetInsights() {
    const analysis = getBudgetAnalysis();
    const currentBalance = financialData?.metadata?.starting_balance || 0;
    
    let insights = [];
    
    if (analysis.netMonthly < 0) {
        insights.push(`⚠️ Your budget shows a monthly deficit of ${formatCurrency(Math.abs(analysis.netMonthly))}`);
        if (analysis.monthsToZero && analysis.monthsToZero < 12) {
            insights.push(`💡 At current spending rate, funds may be depleted in ${Math.round(analysis.monthsToZero)} months`);
        }
    } else if (analysis.netMonthly > 0) {
        insights.push(`✅ Your budget shows a monthly surplus of ${formatCurrency(analysis.netMonthly)}`);
        insights.push(`📈 Annual savings potential: ${formatCurrency(analysis.netMonthly * 12)}`);
    }
    
    if (analysis.savingsRate < 10 && analysis.netMonthly > 0) {
        insights.push(`💡 Consider increasing your savings rate (currently ${analysis.savingsRate.toFixed(1)}%)`);
    }
    
    // Bank-specific insights
    const linkedBudgetItems = budgetData.filter(budget => budget.linkedBankId && !budget.isAutoGenerated);
    if (linkedBudgetItems.length > 0) {
        const banksWithLinkedItems = [...new Set(linkedBudgetItems.map(item => item.linkedBankId))];
        insights.push(`🏦 You have budget items linked to ${banksWithLinkedItems.length} bank account(s) for accurate tracking`);
    }
    
    // Check for potential overdrafts
    bankData.forEach(bank => {
        const linkedExpenses = budgetData.filter(budget => 
            budget.linkedBankId == bank.id && 
            budget.type === 'expense' && 
            (!budget.endDate || budget.endDate >= new Date().toISOString().split('T')[0])
        );
        
        const monthlyExpenses = linkedExpenses.reduce((sum, budget) => sum + Math.abs(budget.amount), 0);
        
        if (monthlyExpenses > bank.balance * 0.8) {
            insights.push(`⚠️ ${bank.name} may have cash flow issues - monthly expenses (${formatCurrency(monthlyExpenses)}) are high relative to balance`);
        }
    });
    
    if (insights.length > 0) {
        const insightHTML = `
            <div class="budget-insights" style="margin-top: 15px; padding: 15px; background: #2a2a2a; border-radius: 8px; border-left: 3px solid #2196f3;">
                <h4 style="margin: 0 0 10px 0; color: #2196f3;">💡 Budget Insights</h4>
                ${insights.map(insight => `<p style="margin: 5px 0; color: #e0e0e0; font-size: 0.9em;">${insight}</p>`).join('')}
            </div>
        `;
        
        const budgetList = document.getElementById('budgetList');
        if (budgetList && !budgetList.querySelector('.budget-insights')) {
            budgetList.insertAdjacentHTML('beforeend', insightHTML);
        }
    }
}

function getBudgetAnalysis() {
    // Only consider active budget items
    const today = new Date().toISOString().split('T')[0];
    const activeBudgetData = budgetData.filter(budget => {
        return !budget.endDate || budget.endDate >= today;
    });
    
    const totalIncome = activeBudgetData.filter(b => b.type === 'income').reduce((sum, b) => sum + Math.abs(b.amount), 0);
    const totalExpenses = activeBudgetData.filter(b => b.type === 'expense').reduce((sum, b) => sum + Math.abs(b.amount), 0);
    const netMonthly = totalIncome - totalExpenses;
    
    const currentBalance = financialData?.metadata?.starting_balance || 0;
    
    return {
        totalIncome,
        totalExpenses,
                netMonthly,
        savingsRate: totalIncome > 0 ? (netMonthly / totalIncome) * 100 : 0,
        monthsToZero: netMonthly < 0 ? Math.abs(currentBalance / netMonthly) : null
    };
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

window.onclick = function(event) {
    const budgetModal = document.getElementById('budgetModal');
    const bankModal = document.getElementById('bankModal');
    
    if (event.target === budgetModal) {
        closeBudgetModal();
    }
    if (event.target === bankModal) {
        closeBankModal();
    }
}


document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + B to add new budget item
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        openBudgetModal();
    }
    
    // Ctrl/Cmd + Shift + B to add new bank account
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'B') {
        e.preventDefault();
        openBankModal();
    }
    
    // Ctrl/Cmd + T to toggle bank section
    if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        toggleBankSection();
    }
    
    // Escape to close modals
    if (e.key === 'Escape') {
        closeBudgetModal();
        closeBankModal();
    }
});


// Enhanced export functionality to include budget data
function exportAllData() {
    const exportData = {
        budget: budgetData,
        banks: bankData,
        exportDate: new Date().toISOString(),
        version: '1.0'
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `budget_dashboard_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showNotification('Budget data exported successfully!', 'success');
}

// Import functionality for budget data
function importBudgetData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                
                if (importedData.budget && Array.isArray(importedData.budget) && importedData.banks && Array.isArray(importedData.banks)) {
                    if (confirm('This will replace your current budget data. Continue?')) {
                        budgetData = importedData.budget;
                        bankData = importedData.banks;
                        saveBankData();
                        updateBankList();
                        saveBudgetData();
                        updateBudgetList();
                        updateStats();
                        updateForecastChart();
                        showNotification('Budget data imported successfully!', 'success');
                    }
                } else {
                    alert('Invalid budget data format');
                }
            } catch (error) {
                alert('Error reading file: ' + error.message);
            }
        };
        reader.readAsText(file);
    };
    
    input.click();
}

// Add reset functionality
function resetToOriginal() {
    if (confirm('Are you sure you want to reset all budget data? This cannot be undone.')) {
        localStorage.removeItem('financialData');
        localStorage.removeItem('budgetData');
        localStorage.removeItem('bankData');
        location.reload();
    }
}


function debugStorage() {
    console.log('=== STORAGE DEBUG ===');
    console.log('Budget data in memory:', budgetData);
    console.log('Budget data in localStorage (separate):', localStorage.getItem('budgetData'));
    
    const financialDataFromStorage = localStorage.getItem('financialData');
    if (financialDataFromStorage) {
        const parsed = JSON.parse(financialDataFromStorage);
        console.log('Budget data in financial data localStorage:', parsed.budget);
    }
    
    console.log('Financial data object budget:', financialData?.budget);
    console.log('====================');
    
    showNotification('Check console for debug info', 'info');
}

// Enhanced bank list update with visual improvements (continued)
function updateBankList() {
    const bankList = document.getElementById('bankList');
    if (!bankList) return;

    // Calculate bank summary
    const totalBalance = bankData.reduce((sum, bank) => sum + bank.balance, 0);
    const totalMonthlyInterest = bankData.reduce((sum, bank) => {
        if (bank.interestType === 'compound') {
            return sum + bank.balance * (Math.pow(1 + bank.interestRate, 1/12) - 1);
        } else {
            return sum + bank.balance * bank.interestRate / 12;
        }
    }, 0);
    const averageInterestRate = bankData.length > 0 ? 
        (bankData.reduce((sum, bank) => sum + bank.interestRate, 0) / bankData.length) * 100 : 0;
    const annualInterest = totalMonthlyInterest * 12;

    const summaryHTML = `
        <div class="bank-summary">
            <div class="bank-summary-item">
                <h4>Total Balance</h4>
                <div class="value positive">${formatCurrency(totalBalance)}</div>
            </div>
            <div class="bank-summary-item">
                <h4>Monthly Interest</h4>
                <div class="value positive">${formatCurrency(totalMonthlyInterest)}</div>
            </div>
            <div class="bank-summary-item">
                <h4>Annual Interest</h4>
                <div class="value positive">${formatCurrency(annualInterest)}</div>
            </div>
            <div class="bank-summary-item">
                <h4>Average Rate</h4>
                <div class="value">${averageInterestRate.toFixed(3)}%</div>
            </div>
            <div class="bank-summary-item">
                <h4>Accounts</h4>
                <div class="value">${bankData.length}</div>
            </div>
        </div>
    `;

    const bankItemsHTML = bankData.map(bank => {
        let monthlyInterest;
        if (bank.interestType === 'compound') {
            monthlyInterest = bank.balance * (Math.pow(1 + bank.interestRate, 1/12) - 1);
        } else {
            monthlyInterest = bank.balance * bank.interestRate / 12;
        }

        const annualProjection = monthlyInterest * 12;
        const interestRatePercent = (bank.interestRate * 100).toFixed(3);
        
        // Calculate interest rate bar width (relative to 5% max for visualization)
        const maxRate = 5.0;
        const barWidth = Math.min((bank.interestRate * 100) / maxRate * 100, 100);

        return `
            <div class="bank-item">
                <div class="bank-details">
                    <strong>${bank.name}</strong>
                    <br>
                    <small>
                        Balance: ${formatCurrency(bank.balance)} • 
                        ${interestRatePercent}% APY • 
                        ${bank.interestType} interest
                    </small>
                    <div class="interest-rate-bar">
                        <div class="interest-rate-fill" style="width: ${barWidth}%"></div>
                    </div>
                    <small class="interest-display">
                        Monthly: ${formatCurrency(monthlyInterest)} • 
                        Annual: ${formatCurrency(annualProjection)}
                    </small>
                </div>
                <div class="bank-actions">
                    <span class="positive" style="font-size: 1.1em; font-weight: bold;">
                        ${formatCurrency(bank.balance)}
                    </span>
                    <div>
                        <button class="edit-btn" onclick="editBankAccount(${bank.id})" title="Edit bank account">
                            Edit
                        </button>
                        <button class="delete-btn" onclick="deleteBankAccount(${bank.id})" title="Delete bank account">
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    bankList.innerHTML = summaryHTML + bankItemsHTML;
    
    // Add bank insights
    setTimeout(() => {
        displayBankInsights();
    }, 100);
}

// Bank insights function
function displayBankInsights() {
    if (bankData.length === 0) return;
    
    const totalBalance = bankData.reduce((sum, bank) => sum + bank.balance, 0);
    const totalMonthlyInterest = bankData.reduce((sum, bank) => {
        if (bank.interestType === 'compound') {
            return sum + bank.balance * (Math.pow(1 + bank.interestRate, 1/12) - 1);
        } else {
            return sum + bank.balance * bank.interestRate / 12;
        }
    }, 0);
    
    const averageRate = bankData.reduce((sum, bank) => sum + bank.interestRate, 0) / bankData.length;
    const highestRate = Math.max(...bankData.map(bank => bank.interestRate));
    const lowestRate = Math.min(...bankData.map(bank => bank.interestRate));
    
    let insights = [];
    
    // Interest rate insights
    if (highestRate - lowestRate > 0.01) { // More than 1% difference
        const highestBank = bankData.find(bank => bank.interestRate === highestRate);
        const lowestBank = bankData.find(bank => bank.interestRate === lowestRate);
        insights.push(`💡 Consider moving funds from ${lowestBank.name} (${(lowestRate*100).toFixed(2)}%) to ${highestBank.name} (${(highestRate*100).toFixed(2)}%) for better returns`);
    }
    
    // Interest earnings insights
    const annualInterest = totalMonthlyInterest * 12;
    insights.push(`📈 Your banks will generate approximately ${formatCurrency(annualInterest)} in interest this year`);
    
    // Compound vs Simple interest
    const compoundBanks = bankData.filter(bank => bank.interestType === 'compound').length;
    const simpleBanks = bankData.filter(bank => bank.interestType === 'simple').length;
    
    if (simpleBanks > 0 && compoundBanks > 0) {
        insights.push(`⚡ You have ${compoundBanks} compound interest accounts and ${simpleBanks} simple interest accounts`);
    }
    
    // Balance distribution insights
    if (bankData.length > 1) {
        const balanceDistribution = bankData.map(bank => bank.balance);
        const maxBalance = Math.max(...balanceDistribution);
        const minBalance = Math.min(...balanceDistribution);
        
        if (maxBalance / minBalance > 10) {
            insights.push(`⚖️ Consider rebalancing your accounts for better diversification`);
        }
    }
    
    if (insights.length > 0) {
        const insightHTML = `
            <div class="bank-insights" style="margin-top: 15px; padding: 15px; background: #2a2a2a; border-radius: 8px; border-left: 3px solid #4caf50;">
                <h4 style="margin: 0 0 10px 0; color: #4caf50;">🏦 Bank Insights</h4>
                ${insights.map(insight => `<p style="margin: 5px 0; color: #e0e0e0; font-size: 0.9em;">${insight}</p>`).join('')}
            </div>
        `;
        
        const bankList = document.getElementById('bankList');
        if (bankList && !bankList.querySelector('.bank-insights')) {
            bankList.insertAdjacentHTML('beforeend', insightHTML);
        }
    }
}

// Enhanced interest calculation with better precision
function calculateMonthlyInterest(balance, annualRate, interestType) {
    if (interestType === 'compound') {
        // Monthly compound interest: (1 + r)^(1/12) - 1
        return balance * (Math.pow(1 + annualRate, 1/12) - 1);
    } else {
        // Simple interest: principal * rate / 12
        return balance * annualRate / 12;
    }
}

// Bank account validation
function validateBankAccount(name, balance, interestRate) {
    const errors = [];
    
    if (!name || name.trim().length < 2) {
        errors.push('Bank name must be at least 2 characters long');
    }
    
    if (isNaN(balance) || balance < 0) {
        errors.push('Balance must be a positive number');
    }
    
    if (isNaN(interestRate) || interestRate < 0 || interestRate > 100) {
        errors.push('Interest rate must be between 0 and 100%');
    }
    
    // Check for duplicate bank names
    const existingBank = bankData.find(bank => 
        bank.name.toLowerCase() === name.toLowerCase() && 
        (!editingBankId || bank.id !== editingBankId)
    );
    
    if (existingBank) {
        errors.push('A bank account with this name already exists');
    }
    
    // Warning for low balance with linked expenses
    if (editingBankId) {
        const linkedExpenses = budgetData.filter(budget => 
            budget.linkedBankId == editingBankId && 
            budget.type === 'expense' && 
            !budget.endDate
        );
        
        const monthlyExpenses = linkedExpenses.reduce((sum, budget) => sum + Math.abs(budget.amount), 0);
        
        if (monthlyExpenses > 0 && balance < monthlyExpenses * 2) {
            errors.push(`Warning: Balance is low compared to linked monthly expenses (${formatCurrency(monthlyExpenses)})`);
        }
    }
    
    return errors;
}

// Enhanced save bank account with validation
function saveBankAccount() {
    const name = document.getElementById('bankName').value.trim();
    const balance = parseFloat(document.getElementById('bankBalance').value);
    const interestRate = parseFloat(document.getElementById('bankInterestRate').value);
    const interestType = document.getElementById('bankInterestType').value;

    // Validate inputs
    const validationErrors = validateBankAccount(name, balance, interestRate);
    if (validationErrors.length > 0) {
        alert('Please fix the following errors:\n\n' + validationErrors.join('\n'));
        return;
    }

    // Convert percentage to decimal
    const interestRateDecimal = interestRate / 100;

    if (editingBankId) {
        // Update existing bank account
        const bankIndex = bankData.findIndex(b => b.id === editingBankId);
        if (bankIndex !== -1) {
            const oldName = bankData[bankIndex].name;
            const oldBalance = bankData[bankIndex].balance;
            
            bankData[bankIndex] = {
                ...bankData[bankIndex],
                name,
                balance,
                interestRate: interestRateDecimal,
                interestType
            };
            
            // Update associated budget item
            updateBankInterestBudgetItem(oldName, name, balance, interestRateDecimal, interestType);
            
            // Show detailed update notification
            const balanceChange = balance - oldBalance;
            let changeText = '';
            if (balanceChange !== 0) {
                changeText = ` (${balanceChange > 0 ? '+' : ''}${formatCurrency(balanceChange)})`;
            }
            
            showNotification(`Updated "${name}"${changeText}`, 'success');
        }
    } else {
        // Add new bank account
        const newBank = {
            id: Date.now(),
            name,
            balance,
            interestRate: interestRateDecimal,
			interestType
        };
        bankData.push(newBank);
        
        // Add corresponding budget item for interest
        addBankInterestBudgetItem(name, balance, interestRateDecimal, interestType);
        showNotification(`Added "${name}" with ${formatCurrency(balance)}`, 'success');
    }

    saveBankData();
    saveBudgetData();
    updateBankList();
    updateBudgetList();
    updateStats();
    updateForecastChart();
    closeBankModal();
}

// Enhanced bank interest budget item management
function addBankInterestBudgetItem(bankName, balance, interestRate, interestType) {
    // Calculate monthly interest with proper precision
    const monthlyInterest = calculateMonthlyInterest(balance, interestRate, interestType);

    const interestBudgetItem = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        name: `${bankName} Interest`,
        amount: monthlyInterest,
        type: 'income',
        startDate: new Date().toISOString().split('T')[0],
        endDate: null,
        isAutoGenerated: true,
        linkedBankId: bankData.find(b => b.name === bankName)?.id,
        interestType: interestType,
        metadata: {
            createdBy: 'bank_system',
            createdAt: new Date().toISOString(),
            principalAmount: balance,
            annualRate: interestRate
        }
    };

    budgetData.push(interestBudgetItem);
}

function updateBankInterestBudgetItem(oldBankName, newBankName, balance, interestRate, interestType) {
    // Find and update the existing interest budget item
    const budgetIndex = budgetData.findIndex(budget => 
        budget.name === `${oldBankName} Interest` && budget.isAutoGenerated
    );
    
    if (budgetIndex !== -1) {
        // Calculate new monthly interest
        const monthlyInterest = calculateMonthlyInterest(balance, interestRate, interestType);

        budgetData[budgetIndex] = {
            ...budgetData[budgetIndex],
            name: `${newBankName} Interest`,
            amount: monthlyInterest,
            interestType: interestType,
            metadata: {
                ...budgetData[budgetIndex].metadata,
                updatedAt: new Date().toISOString(),
                principalAmount: balance,
                annualRate: interestRate
            }
        };
    } else {
        // If budget item doesn't exist, create it
        addBankInterestBudgetItem(newBankName, balance, interestRate, interestType);
    }
}

// Enhanced delete function with cascading cleanup
function deleteBankAccount(bankId) {
    const bank = bankData.find(b => b.id === bankId);
    if (!bank) return;

    // Find all linked budget items
    const linkedBudgetItems = budgetData.filter(budget => 
        budget.linkedBankId == bankId || budget.name === `${bank.name} Interest`
    );
    
    const linkedUserItems = linkedBudgetItems.filter(budget => !budget.isAutoGenerated);
    const autoGeneratedItems = linkedBudgetItems.filter(budget => budget.isAutoGenerated);

    let confirmMessage = `Delete "${bank.name}"?\n\n`;
    confirmMessage += `Current balance: ${formatCurrency(bank.balance)}\n`;
    confirmMessage += `Monthly interest: ${formatCurrency(calculateMonthlyInterest(bank.balance, bank.interestRate, bank.interestType))}\n\n`;
    
    if (autoGeneratedItems.length > 0) {
        confirmMessage += `This will remove ${autoGeneratedItems.length} auto-generated interest item(s).\n`;
    }
    
    if (linkedUserItems.length > 0) {
        confirmMessage += `\n⚠️ This bank has ${linkedUserItems.length} linked budget item(s):\n`;
        linkedUserItems.forEach(item => {
            confirmMessage += `• ${item.name} (${formatCurrency(Math.abs(item.amount))})\n`;
        });
        confirmMessage += `\nThese items will be unlinked but not deleted.`;
    }

    if (confirm(confirmMessage)) {
        // Remove bank account
        bankData = bankData.filter(b => b.id !== bankId);
        
        // Remove auto-generated budget items
        budgetData = budgetData.filter(budget => 
            !(budget.linkedBankId == bankId && budget.isAutoGenerated) && 
            budget.name !== `${bank.name} Interest`
        );
        
        // Unlink user budget items (don't delete them)
        budgetData.forEach(budget => {
            if (budget.linkedBankId == bankId && !budget.isAutoGenerated) {
                budget.linkedBankId = null;
            }
        });
        
        saveBankData();
        saveBudgetData();
        updateBankList();
        updateBudgetList();
        updateStats();
        updateForecastChart();
        
        showNotification(
            `Deleted "${bank.name}" and unlinked ${linkedUserItems.length} budget item(s)`, 
            'success'
        );
    }
}

// Bank data import/export enhancements
function exportBankData() {
    if (bankData.length === 0) {
        showNotification('No bank data to export', 'info');
        return;
    }

    const exportData = {
        banks: bankData,
        summary: {
            totalAccounts: bankData.length,
            totalBalance: bankData.reduce((sum, bank) => sum + bank.balance, 0),
            averageInterestRate: (bankData.reduce((sum, bank) => sum + bank.interestRate, 0) / bankData.length) * 100,
            compoundAccounts: bankData.filter(bank => bank.interestType === 'compound').length,
            simpleAccounts: bankData.filter(bank => bank.interestType === 'simple').length
        },
        exportDate: new Date().toISOString(),
        version: '1.2'
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `bank_accounts_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showNotification(`Exported ${bankData.length} bank accounts`, 'success');
}

// Bank account quick actions
function quickAddSavingsAccount() {
    document.getElementById('bankName').value = 'High-Yield Savings';
    document.getElementById('bankBalance').value = '1000';
    document.getElementById('bankInterestRate').value = '4.5';
    document.getElementById('bankInterestType').value = 'compound';
    openBankModal();
}

function quickAddCheckingAccount() {
    document.getElementById('bankName').value = 'Checking Account';
    document.getElementById('bankBalance').value = '500';
    document.getElementById('bankInterestRate').value = '0.1';
    document.getElementById('bankInterestType').value = 'compound';
    openBankModal();
}

// Bank performance analytics
function analyzeBankPerformance() {
    if (bankData.length === 0) {
        showNotification('No bank accounts to analyze', 'info');
        return;
    }

    const analysis = {
        totalBalance: bankData.reduce((sum, bank) => sum + bank.balance, 0),
        monthlyInterest: bankData.reduce((sum, bank) => {
            return sum + calculateMonthlyInterest(bank.balance, bank.interestRate, bank.interestType);
        }, 0),
        bestPerformer: null,
        worstPerformer: null,
        recommendations: []
    };

    // Find best and worst performing accounts
    let bestRate = -1;
    let worstRate = Infinity;
    
    bankData.forEach(bank => {
        if (bank.interestRate > bestRate) {
            bestRate = bank.interestRate;
            analysis.bestPerformer = bank;
        }
        if (bank.interestRate < worstRate) {
            worstRate = bank.interestRate;
            analysis.worstPerformer = bank;
        }
    });

    // Generate recommendations
    if (bestRate - worstRate > 0.01) { // More than 1% difference
        analysis.recommendations.push(
            `Consider moving funds from ${analysis.worstPerformer.name} (${(worstRate*100).toFixed(2)}%) to ${analysis.bestPerformer.name} (${(bestRate*100).toFixed(2)}%)`
        );
    }

    if (analysis.monthlyInterest < analysis.totalBalance * 0.003) { // Less than 3.6% APY average
        analysis.recommendations.push('Your average interest rate is below market rates. Consider shopping for higher-yield accounts.');
    }

    // Display analysis
    console.log('Bank Performance Analysis:', analysis);
    
    const analysisHTML = `
        <div class="bank-analysis" style="margin-top: 15px; padding: 15px; background: #2a2a2a; border-radius: 8px; border-left: 3px solid #ff9800;">
            <h4 style="margin: 0 0 10px 0; color: #ff9800;">📊 Performance Analysis</h4>
            <p style="margin: 5px 0; color: #e0e0e0; font-size: 0.9em;">
                <strong>Total Balance:</strong> ${formatCurrency(analysis.totalBalance)}
            </p>
            <p style="margin: 5px 0; color: #e0e0e0; font-size: 0.9em;">
                <strong>Monthly Interest:</strong> ${formatCurrency(analysis.monthlyInterest)}
            </p>
            <p style="margin: 5px 0; color: #e0e0e0; font-size: 0.9em;">
                <strong>Annual Projection:</strong> ${formatCurrency(analysis.monthlyInterest * 12)}
            </p>
            ${analysis.recommendations.length > 0 ? `
                <div style="margin-top: 10px;">
                    <strong style="color: #ff9800;">Recommendations:</strong>
                    ${analysis.recommendations.map(rec => `<p style="margin: 5px 0; color: #e0e0e0; font-size: 0.85em;">• ${rec}</p>`).join('')}
                </div>
            ` : ''}
        </div>
    `;
    
    const bankList = document.getElementById('bankList');
    if (bankList) {
        // Remove existing analysis
        const existingAnalysis = bankList.querySelector('.bank-analysis');
        if (existingAnalysis) {
            existingAnalysis.remove();
        }
        bankList.insertAdjacentHTML('beforeend', analysisHTML);
    }
    
    showNotification('Bank performance analysis complete', 'success');
}


// Enhanced utility functions
function analyzeOptimalBankAllocation() {
    if (bankData.length === 0) {
        showNotification('No bank accounts to analyze', 'info');
        return;
    }

    const today = new Date().toISOString().split('T')[0];
    const linkedBudgetItems = budgetData.filter(budget => 
        budget.linkedBankId && 
        !budget.isAutoGenerated && 
        (!budget.endDate || budget.endDate >= today)
    );

    let analysis = {
        recommendations: [],
        currentAllocation: {},
        optimalAllocation: {}
    };

    // Analyze current allocation
    bankData.forEach(bank => {
        const bankIncome = linkedBudgetItems
            .filter(item => item.linkedBankId == bank.id && item.type === 'income')
            .reduce((sum, item) => sum + Math.abs(item.amount), 0);
        
        const bankExpenses = linkedBudgetItems
            .filter(item => item.linkedBankId == bank.id && item.type === 'expense')
            .reduce((sum, item) => sum + Math.abs(item.amount), 0);

        analysis.currentAllocation[bank.id] = {
            name: bank.name,
            balance: bank.balance,
            interestRate: bank.interestRate,
            monthlyIncome: bankIncome,
            monthlyExpenses: bankExpenses,
            netFlow: bankIncome - bankExpenses,
            monthlyInterest: calculateMonthlyInterest(bank.balance, bank.interestRate, bank.interestType)
        };
    });

    // Generate recommendations
    const sortedByRate = [...bankData].sort((a, b) => b.interestRate - a.interestRate);
    const highestRateBank = sortedByRate[0];
    const lowestRateBank = sortedByRate[sortedByRate.length - 1];

    if (highestRateBank.interestRate > lowestRateBank.interestRate * 1.5) {
        analysis.recommendations.push(
            `💡 Consider moving excess funds from ${lowestRateBank.name} (${(lowestRateBank.interestRate * 100).toFixed(2)}%) to ${highestRateBank.name} (${(highestRateBank.interestRate * 100).toFixed(2)}%)`
        );
    }

    // Check for banks with negative cash flow
    Object.values(analysis.currentAllocation).forEach(bank => {
        if (bank.netFlow < 0 && bank.balance < Math.abs(bank.netFlow) * 6) {
            analysis.recommendations.push(
                `⚠️ ${bank.name} has negative cash flow and low reserves. Consider redirecting income or reducing expenses.`
            );
        }
    });

    // Display analysis
    console.log('Bank Allocation Analysis:', analysis);
    
    const analysisHTML = `
        <div class="allocation-analysis" style="margin-top: 15px; padding: 15px; background: #2a2a2a; border-radius: 8px; border-left: 3px solid #9c27b0;">
            <h4 style="margin: 0 0 10px 0; color: #9c27b0;">🎯 Bank Allocation Analysis</h4>
            ${Object.values(analysis.currentAllocation).map(bank => `
                <div style="margin: 10px 0; padding: 10px; background: #333; border-radius: 4px;">
                    <strong style="color: #fff;">${bank.name}</strong><br>
                    <small style="color: #e0e0e0;">
                        Balance: ${formatCurrency(bank.balance)} | 
                        Net Flow: <span class="${bank.netFlow >= 0 ? 'positive' : 'negative'}">${formatCurrency(bank.netFlow)}/month</span> | 
                        Interest: ${formatCurrency(bank.monthlyInterest)}/month
                    </small>
                </div>
            `).join('')}
            ${analysis.recommendations.length > 0 ? `
                <div style="margin-top: 15px;">
                    <strong style="color: #9c27b0;">Recommendations:</strong>
                    ${analysis.recommendations.map(rec => `<p style="margin: 5px 0; color: #e0e0e0; font-size: 0.9em;">${rec}</p>`).join('')}
                </div>
            ` : '<p style="color: #4caf50; margin-top: 10px;">✅ Your bank allocation looks optimal!</p>'}
        </div>
    `;
    
    const budgetList = document.getElementById('budgetList');
    if (budgetList) {
        const existingAnalysis = budgetList.querySelector('.allocation-analysis');
        if (existingAnalysis) {
            existingAnalysis.remove();
        }
        budgetList.insertAdjacentHTML('beforeend', analysisHTML);
    }
    
    showNotification('Bank allocation analysis complete', 'success');
}

// Update utility buttons to include bank-specific actions
// function addUtilityButtons() {
//     const utilityHTML = `
//         <div class="utility-buttons" style="margin-top: 20px; text-align: center; display: flex; justify-content: center; align-items: center; gap: 10px; flex-wrap: wrap;">
//             <!-- Export Dropdown -->
//             <div class="export-dropdown">
//                 <button class="export-button" onclick="toggleExportPanel()" id="exportButton">
//                     📤 Export & Import
//                 </button>
//                 <div class="export-panel" id="exportPanel">
//                     <h4>Data Management</h4>
//                     <div class="export-section">
//                         <div class="export-section-title">Export Options</div>
//                         <div class="export-item" onclick="exportAllData(); closeExportPanel();">
//                             <span class="icon">💾</span>
//                             <div class="details">
//                                 <div class="name">Export Data</div>
//                                 <div class="description">Complete budget and bank data</div>
//                             </div>
//                         </div>
//                         <div class="export-item" onclick="exportForecasts(); closeExportPanel();">
//                             <span class="icon">📈</span>
//                             <div class="details">
//                                 <div class="name">Export Forecasts</div>
//                                 <div class="description">Financial projections (CSV)</div>
//                             </div>
//                         </div>
//                     </div>
//                     <div class="export-section">
//                         <div class="export-section-title">Import Options</div>
//                         <div class="export-item" onclick="importBudgetData(); closeExportPanel();">
//                             <span class="icon">📥</span>
//                             <div class="details">
//                                 <div class="name">Import Data</div>
//                                 <div class="description">Load saved budget/bank data</div>
//                             </div>
//                         </div>
//                     </div>
//                 </div>
//             </div>
            
//             <!-- Analysis Dropdown -->
//             <div class="analysis-dropdown">
//                 <button class="analysis-button" onclick="toggleAnalysisPanel()" id="analysisButton">
//                     📊 Analysis Tools
//                 </button>
//                 <div class="analysis-panel" id="analysisPanel">
//                     <h4 style="margin: 0 0 10px 0; padding: 15px 15px 0 15px; color: #ffffff; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #333; padding-bottom: 10px;">Analysis Options</h4>
//                     <div class="analysis-item" onclick="analyzeBankPerformance(); closeAnalysisPanel();">
//                         <span class="icon">🏦</span>
//                         <div class="details">
//                             <div class="name">Bank Performance</div>
//                             <div class="description">Interest rates and earnings analysis</div>
//                         </div>
//                     </div>
//                     <div class="analysis-item" onclick="analyzeOptimalBankAllocation(); closeAnalysisPanel();">
//                         <span class="icon">⚖️</span>
//                         <div class="details">
//                             <div class="name">Optimize Allocation</div>
//                             <div class="description">Suggest better fund distribution</div>
//                         </div>
//                     </div>
//                     <div class="analysis-item" onclick="analyzeCashFlow(); closeAnalysisPanel();">
//                         <span class="icon">💰</span>
//                         <div class="details">
//                             <div class="name">Cash Flow Analysis</div>
//                             <div class="description">Income vs expenses breakdown</div>
//                         </div>
//                     </div>
//                     <div class="analysis-item" onclick="analyzeSpendingTrends(); closeAnalysisPanel();">
//                         <span class="icon">📈</span>
//                         <div class="details">
//                             <div class="name">Spending Trends</div>
//                             <div class="description">Category spending patterns</div>
//                         </div>
//                     </div>
//                     <div class="analysis-item" onclick="generateFinancialReport(); closeAnalysisPanel();">
//                         <span class="icon">📋</span>
//                         <div class="details">
//                             <div class="name">Financial Report</div>
//                             <div class="description">Comprehensive overview</div>
//                         </div>
//                     </div>
//                 </div>
//             </div>
            
//             <!-- Individual Action Buttons -->
//             <button class="btn btn-secondary" onclick="debugStorage()" style="margin: 0 5px; font-size: 13px; padding: 8px 16px;">
//                 🐛 Debug
//             </button>
//             <button class="btn btn-secondary" onclick="resetToOriginal()" style="margin: 0 5px; font-size: 13px; padding: 8px 16px;">
//                 🔄 Reset All
//             </button>
//         </div>
//         <div style="margin-top: 10px; text-align: center; color: #888; font-size: 0.8em;">
//             Keyboard shortcuts: Ctrl+B (New Budget), Ctrl+Shift+B (New Bank), Ctrl+T (Toggle Banks), Esc (Close Modal)
//         </div>
//     `;
//     const lastContainer = document.querySelector('.chart-container:last-child');
//     if (lastContainer && !lastContainer.querySelector('.utility-buttons')) {
//         lastContainer.insertAdjacentHTML('beforeend', utilityHTML);
//     }
// }


// Enhanced error handling and user feedback
function handleBankError(error, context = 'bank operation') {
    console.error(`Error in ${context}:`, error);
    
    let userMessage = 'An error occurred. Please try again.';
    
    if (error.message.includes('localStorage')) {
        userMessage = 'Unable to save data. Your browser storage may be full.';
    } else if (error.message.includes('JSON')) {
        userMessage = 'Data format error. Please check your import file.';
    } else if (error.message.includes('validation')) {
        userMessage = error.message;
    }
    
    showNotification(userMessage, 'error');
}

// Bank data synchronization with budget items
function synchronizeBankData() {
    let syncCount = 0;
    
    bankData.forEach(bank => {
        const expectedInterestItemName = `${bank.name} Interest`;
        const existingBudgetItem = budgetData.find(budget => 
            budget.name === expectedInterestItemName && budget.isAutoGenerated
        );
        
        const expectedMonthlyInterest = calculateMonthlyInterest(
            bank.balance, 
            bank.interestRate, 
            bank.interestType
        );
        
        if (!existingBudgetItem) {
            // Create missing budget item
            addBankInterestBudgetItem(bank.name, bank.balance, bank.interestRate, bank.interestType);
            syncCount++;
        } else if (Math.abs(existingBudgetItem.amount - expectedMonthlyInterest) > 0.01) {
            // Update mismatched budget item
            updateBankInterestBudgetItem(bank.name, bank.name, bank.balance, bank.interestRate, bank.interestType);
            syncCount++;
        }
    });
    
    // Remove orphaned bank interest budget items
    const orphanedItems = budgetData.filter(budget => {
        if (!budget.isAutoGenerated || !budget.name.includes('Interest')) return false;
        
        const bankName = budget.name.replace(' Interest', '');
        return !bankData.find(bank => bank.name === bankName);
    });
    
    orphanedItems.forEach(item => {
        budgetData = budgetData.filter(budget => budget.id !== item.id);
        syncCount++;
    });
    
    if (syncCount > 0) {
        saveBudgetData();
        updateBudgetList();
        showNotification(`Synchronized ${syncCount} bank-related items`, 'info');
    }
    
    return syncCount;
}

// Auto-sync on page load and periodically
document.addEventListener('DOMContentLoaded', function() {
    // Auto-sync after initial load
    setTimeout(() => {
        if (bankData.length > 0) {
            synchronizeBankData();
        }
    }, 1000);
});

// Periodic sync every 5 minutes
setInterval(() => {
    if (bankData.length > 0) {
        synchronizeBankData();
    }
}, 5 * 60 * 1000);

// Bank account search and filtering
function addBankSearchFunctionality() {
    const bankList = document.getElementById('bankList');
    if (!bankList || bankData.length === 0) return;
    
    const searchHTML = `
        <div class="bank-search" style="margin-bottom: 15px; padding: 10px; background: #333; border-radius: 6px;">
            <input type="text" id="bankSearchInput" placeholder="Search bank accounts..." 
                   style="width: 100%; padding: 8px; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; color: #e0e0e0;"
                   oninput="filterBankAccounts(this.value)">
            <div style="margin-top: 8px; display: flex; gap: 10px; flex-wrap: wrap;">
                <button class="btn btn-secondary" style="font-size: 0.8em; padding: 4px 8px;" onclick="filterBanksByType('compound')">
                    Compound Interest
                </button>
                <button class="btn btn-secondary" style="font-size: 0.8em; padding: 4px 8px;" onclick="filterBanksByType('simple')">
                    Simple Interest
                </button>
                <button class="btn btn-secondary" style="font-size: 0.8em; padding: 4px 8px;" onclick="filterBanksByRate('high')">
                    High Yield (>3%)
                </button>
                <button class="btn btn-secondary" style="font-size: 0.8em; padding: 4px 8px;" onclick="clearBankFilters()">
                    Show All
                </button>
            </div>
        </div>
    `;
    
    // Insert search before the first bank item
    const firstBankItem = bankList.querySelector('.bank-item');
    if (firstBankItem && !bankList.querySelector('.bank-search')) {
        firstBankItem.insertAdjacentHTML('beforebegin', searchHTML);
    }
}

function filterBankAccounts(searchTerm) {
    const bankItems = document.querySelectorAll('.bank-item');
    const term = searchTerm.toLowerCase();
    
    bankItems.forEach(item => {
        const bankName = item.querySelector('.bank-details strong').textContent.toLowerCase();
        const bankDetails = item.querySelector('.bank-details small').textContent.toLowerCase();
        
        if (bankName.includes(term) || bankDetails.includes(term)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function filterBanksByType(type) {
    const bankItems = document.querySelectorAll('.bank-item');
    
    bankItems.forEach(item => {
        const bankDetails = item.querySelector('.bank-details small').textContent.toLowerCase();
        
        if (bankDetails.includes(type)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function filterBanksByRate(rateType) {
    const bankItems = document.querySelectorAll('.bank-item');
    
    bankItems.forEach((item, index) => {
        const bank = bankData[index];
        if (!bank) return;
        
        const ratePercent = bank.interestRate * 100;
        let shouldShow = false;
        
        switch(rateType) {
            case 'high':
                shouldShow = ratePercent > 3;
                break;
            case 'medium':
                shouldShow = ratePercent >= 1 && ratePercent <= 3;
                break;
            case 'low':
                shouldShow = ratePercent < 1;
                break;
        }
        
        item.style.display = shouldShow ? 'flex' : 'none';
    });
}

function clearBankFilters() {
    const bankItems = document.querySelectorAll('.bank-item');
    bankItems.forEach(item => {
        item.style.display = 'flex';
    });
    
    const searchInput = document.getElementById('bankSearchInput');
    if (searchInput) {
        searchInput.value = '';
    }
}

// Enhanced updateBankList to include search functionality
const originalUpdateBankList = updateBankList;
updateBankList = function() {
    originalUpdateBankList.call(this);
    
    // Add search functionality after updating the list
    setTimeout(() => {
        addBankSearchFunctionality();
    }, 100);
};

// Bank account backup and restore
function createBankBackup() {
    const backup = {
        banks: JSON.parse(JSON.stringify(bankData)),
        budgetItems: budgetData.filter(item => item.isAutoGenerated),
        timestamp: new Date().toISOString(),
        version: '1.2'
    };
    
    localStorage.setItem('bankBackup', JSON.stringify(backup));
    showNotification('Bank data backup created', 'success');
    
    return backup;
}

function restoreBankBackup() {
    const backup = localStorage.getItem('bankBackup');
    if (!backup) {
        showNotification('No backup found', 'info');
        return;
    }
    
    try {
        const backupData = JSON.parse(backup);
        const backupDate = new Date(backupData.timestamp).toLocaleDateString();
        
        if (confirm(`Restore bank data from backup created on ${backupDate}?\n\nThis will replace your current bank accounts.`)) {
            bankData = backupData.banks;
            
            // Remove existing auto-generated budget items
            budgetData = budgetData.filter(item => !item.isAutoGenerated);
            
            // Add back the backed up budget items
            budgetData.push(...backupData.budgetItems);
            
            saveBankData();
            saveBudgetData();
            updateBankList();
            updateBudgetList();
            updateStats();
            updateForecastChart();
            
            showNotification(`Restored ${backupData.banks.length} bank accounts from backup`, 'success');
        }
    } catch (error) {
        handleBankError(error, 'backup restoration');
    }
}

// Initialize bank section as collapsed by default
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        const bankSection = document.getElementById('bankSection');
        if (bankSection && bankData.length === 0) {
            // Start collapsed if no bank data
            toggleBankSection();
        }
    }, 500);
});


// Bank section toggle functionality
function toggleBankSection() {
    const bankSection = document.getElementById('bankSection');
    const toggleIcon = document.getElementById('bankToggleIcon');
    
    if (bankSection.classList.contains('collapsed')) {
        bankSection.classList.remove('collapsed');
        bankSection.style.maxHeight = bankSection.scrollHeight + 'px';
        toggleIcon.textContent = '▼';
        toggleIcon.style.transform = 'rotate(0deg)';
    } else {
        bankSection.classList.add('collapsed');
        bankSection.style.maxHeight = '0px';
        toggleIcon.textContent = '▶';
        toggleIcon.style.transform = 'rotate(-90deg)';
    }
}

// Bank modal functions
function openBankModal() {
    editingBankId = null;
    document.getElementById('bankModalTitle').textContent = 'Add Bank Account';
    document.getElementById('bankSubmitBtn').textContent = 'Add Bank Account';
    document.getElementById('bankModal').style.display = 'block';
    document.getElementById('bankForm').reset();
}

function closeBankModal() {
    document.getElementById('bankModal').style.display = 'none';
    document.getElementById('bankForm').reset();
    editingBankId = null;
}

function editBankAccount(bankId) {
    const bank = bankData.find(b => b.id === bankId);
    if (!bank) return;

    editingBankId = bankId;
    document.getElementById('bankModalTitle').textContent = 'Edit Bank Account';
    document.getElementById('bankSubmitBtn').textContent = 'Update Bank Account';
    
    document.getElementById('bankName').value = bank.name;
    document.getElementById('bankBalance').value = bank.balance;
    document.getElementById('bankInterestRate').value = (bank.interestRate * 100).toFixed(3);
    document.getElementById('bankInterestType').value = bank.interestType || 'compound';
    
    document.getElementById('bankModal').style.display = 'block';
}

function saveBankData() {
    try {
        // Save to main financial data structure
        if (financialData) {
            financialData.banks = bankData;
            saveDataLocally();
        }
        
        // Also save separately for backup
        localStorage.setItem('bankData', JSON.stringify(bankData));
        console.log('Bank data saved:', bankData.length, 'accounts');
        console.log('Current bank data: ', bankData);
    } catch (error) {
        console.error('Error saving bank data:', error);
        showNotification('Error saving bank data', 'error');
    }
}

// Show/hide bank selection based on budget type
function toggleBankSelection() {
    const budgetType = document.getElementById('budgetType').value;
    const bankSelectionGroup = document.getElementById('bankSelectionGroup');
    const bankSelectionLabel = document.getElementById('bankSelectionLabel');
    const bankSelectionHelp = document.getElementById('bankSelectionHelp');
    
    if (budgetType === 'income' || budgetType === 'expense') {
        bankSelectionGroup.style.display = 'block';
        populateBankOptions();
        
        // Update labels based on type
        if (budgetType === 'income') {
            bankSelectionLabel.textContent = 'Add to Bank Account (Optional):';
            bankSelectionHelp.textContent = 'Income will be added to the selected bank account for interest calculations';
        } else {
            bankSelectionLabel.textContent = 'Deduct from Bank Account (Optional):';
            bankSelectionHelp.textContent = 'Expenses will be deducted from the selected bank account';
        }
    } else {
        bankSelectionGroup.style.display = 'none';
        document.getElementById('budgetLinkedBank').value = '';
    }
}

// Populate bank options in the dropdown
function populateBankOptions() {
    const bankSelect = document.getElementById('budgetLinkedBank');
    const budgetType = document.getElementById('budgetType').value;
    
    // Clear existing options except the first one
    while (bankSelect.children.length > 1) {
        bankSelect.removeChild(bankSelect.lastChild);
    }
    
    // Sort banks by balance (highest first for expenses, any order for income)
    const sortedBanks = [...bankData].sort((a, b) => {
        if (budgetType === 'expense') {
            return b.balance - a.balance; // Highest balance first for expenses
        }
        return a.name.localeCompare(b.name); // Alphabetical for income
    });
    
    // Add bank options
    sortedBanks.forEach(bank => {
        const option = document.createElement('option');
        option.value = bank.id;
        
        let displayText = `${bank.name} (${formatCurrency(bank.balance)})`;
        
        // Add warning for low balance accounts when selecting for expenses
        if (budgetType === 'expense' && bank.balance < 1000) {
            displayText += ' ⚠️ Low Balance';
        }
        
        option.textContent = displayText;
        bankSelect.appendChild(option);
    });
}

function displayBankCashFlowInsights() {
    const today = new Date().toISOString().split('T')[0];
    const activeBudgetData = budgetData.filter(budget => {
        return (!budget.endDate || budget.endDate >= today) && budget.linkedBankId && !budget.isAutoGenerated;
    });

    if (activeBudgetData.length === 0) return;

    // Analyze cash flow by bank
    const bankCashFlow = {};
    bankData.forEach(bank => {
        bankCashFlow[bank.id] = {
            name: bank.name,
            balance: bank.balance,
            monthlyIncome: 0,
            monthlyExpenses: 0,
            netFlow: 0,
            items: []
        };
    });

    activeBudgetData.forEach(budget => {
        const bankId = parseInt(budget.linkedBankId);
        if (bankCashFlow[bankId]) {
            if (budget.type === 'income') {
                bankCashFlow[bankId].monthlyIncome += Math.abs(budget.amount);
            } else {
                bankCashFlow[bankId].monthlyExpenses += Math.abs(budget.amount);
            }
            bankCashFlow[bankId].items.push(budget);
        }
    });

    // Calculate net flow and generate insights
    let insights = [];
    Object.values(bankCashFlow).forEach(bank => {
        bank.netFlow = bank.monthlyIncome - bank.monthlyExpenses;
        
        if (bank.items.length > 0) {
            if (bank.netFlow < 0 && bank.balance < Math.abs(bank.netFlow) * 6) {
                 insights.push(`⚠️ ${bank.name} has negative cash flow (${formatCurrency(bank.netFlow)}/month) and may run low in ${Math.floor(bank.balance / Math.abs(bank.netFlow))} months`);
            } else if (bank.netFlow > 0) {
                insights.push(`✅ ${bank.name} has positive cash flow: ${formatCurrency(bank.netFlow)}/month`);
            }
            
            // Check for potential overdrafts
            const largestExpense = Math.max(...bank.items.filter(item => item.type === 'expense').map(item => Math.abs(item.amount)));
            if (largestExpense > bank.balance * 0.5) {
                const expenseItem = bank.items.find(item => item.type === 'expense' && Math.abs(item.amount) === largestExpense);
                insights.push(`💡 ${bank.name}: "${expenseItem.name}" (${formatCurrency(largestExpense)}) is a large portion of the current balance`);
            }
        }
    });

    if (insights.length > 0) {
        const insightHTML = `
            <div class="bank-cashflow-insights" style="margin-top: 15px; padding: 15px; background: #2a2a2a; border-radius: 8px; border-left: 3px solid #ff9800;">
                <h4 style="margin: 0 0 10px 0; color: #ff9800;">💰 Bank Cash Flow Analysis</h4>
                ${insights.map(insight => `<p style="margin: 5px 0; color: #e0e0e0; font-size: 0.9em;">${insight}</p>`).join('')}
                <button class="btn btn-secondary" onclick="showDetailedBankCashFlow()" style="margin-top: 10px; font-size: 0.8em; padding: 5px 10px;">
                    View Detailed Analysis
                </button>
            </div>
        `;
        
        const budgetList = document.getElementById('budgetList');
        if (budgetList && !budgetList.querySelector('.bank-cashflow-insights')) {
            budgetList.insertAdjacentHTML('beforeend', insightHTML);
        }
    }
}

// Function to show detailed bank cash flow analysis
function showDetailedBankCashFlow() {
    const today = new Date().toISOString().split('T')[0];
    const activeBudgetData = budgetData.filter(budget => {
        return (!budget.endDate || budget.endDate >= today) && budget.linkedBankId && !budget.isAutoGenerated;
    });

    // Build detailed analysis
    const bankDetails = {};
    bankData.forEach(bank => {
        bankDetails[bank.id] = {
            name: bank.name,
            balance: bank.balance,
            interestRate: bank.interestRate,
            income: [],
            expenses: [],
            monthlyInterest: calculateMonthlyInterest(bank.balance, bank.interestRate, bank.interestType)
        };
    });

    activeBudgetData.forEach(budget => {
        const bankId = parseInt(budget.linkedBankId);
        if (bankDetails[bankId]) {
            if (budget.type === 'income') {
                bankDetails[bankId].income.push(budget);
            } else {
                bankDetails[bankId].expenses.push(budget);
            }
        }
    });

    // Create detailed view
    let detailHTML = '<div style="max-height: 400px; overflow-y: auto;">';
    
    Object.values(bankDetails).forEach(bank => {
        const totalIncome = bank.income.reduce((sum, item) => sum + Math.abs(item.amount), 0) + bank.monthlyInterest;
        const totalExpenses = bank.expenses.reduce((sum, item) => sum + Math.abs(item.amount), 0);
        const netFlow = totalIncome - totalExpenses;
        
        detailHTML += `
            <div style="margin-bottom: 20px; padding: 15px; background: #333; border-radius: 8px;">
                <h4 style="color: #fff; margin: 0 0 10px 0;">${bank.name}</h4>
                <p style="margin: 5px 0; color: #e0e0e0;">
                    <strong>Current Balance:</strong> ${formatCurrency(bank.balance)} | 
                    <strong>Net Monthly Flow:</strong> <span class="${netFlow >= 0 ? 'positive' : 'negative'}">${formatCurrency(netFlow)}</span>
                </p>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px;">
                    <div>
                        <h5 style="color: #4caf50; margin: 0 0 5px 0;">Income (${formatCurrency(totalIncome)}/month)</h5>
                        <ul style="margin: 0; padding-left: 15px; color: #e0e0e0; font-size: 0.85em;">
                            <li>Interest: ${formatCurrency(bank.monthlyInterest)}</li>
                            ${bank.income.map(item => `<li>${item.name}: ${formatCurrency(Math.abs(item.amount))}</li>`).join('')}
                        </ul>
                    </div>
                    <div>
                        <h5 style="color: #f44336; margin: 0 0 5px 0;">Expenses (${formatCurrency(totalExpenses)}/month)</h5>
                        <ul style="margin: 0; padding-left: 15px; color: #e0e0e0; font-size: 0.85em;">
                            ${bank.expenses.length > 0 ? 
                                bank.expenses.map(item => `<li>${item.name}: ${formatCurrency(Math.abs(item.amount))}</li>`).join('') :
                                '<li style="color: #888;">No linked expenses</li>'
                            }
                        </ul>
                    </div>
                </div>
                
                ${netFlow < 0 ? `
                    <div style="margin-top: 10px; padding: 8px; background: rgba(244, 67, 54, 0.1); border-left: 3px solid #f44336; border-radius: 4px;">
                        <small style="color: #f44336;">
                            ⚠️ Projected to deplete in ${Math.floor(bank.balance / Math.abs(netFlow))} months if no changes are made
                        </small>
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    detailHTML += '</div>';

    // Show in a modal-like overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
    `;
    
    overlay.innerHTML = `
        <div style="background: #1e1e1e; border-radius: 10px; padding: 30px; max-width: 800px; width: 100%; max-height: 80vh; overflow-y: auto; border: 1px solid #444;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="color: #fff; margin: 0;">Detailed Bank Cash Flow Analysis</h3>
                <button onclick="this.closest('.overlay').remove()" style="background: #666; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; font-size: 18px;">&times;</button>
            </div>
            ${detailHTML}
        </div>
    `;
    
    overlay.className = 'overlay';
    document.body.appendChild(overlay);
    
    // Close on background click
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            overlay.remove();
        }
    });
}

function quickAddSalaryToBestBank() {
    if (bankData.length === 0) {
        showNotification('Add a bank account first', 'info');
        return;
    }
    
    const bestBank = bankData.reduce((best, bank) =>
        bank.interestRate > best.interestRate ? bank : best
    );
    
    document.getElementById('budgetName').value = 'Salary';
    document.getElementById('budgetAmount').value = '3000';
    document.getElementById('budgetType').value = 'income';
    document.getElementById('budgetStartDate').value = new Date().toISOString().split('T')[0];
    openBudgetModal();
    
    setTimeout(() => {
        toggleBankSelection();
        document.getElementById('budgetLinkedBank').value = bestBank.id;
    }, 100);
}

function quickAddRentFromLargestBank() {
    if (bankData.length === 0) {
        showNotification('Add a bank account first', 'info');
        return;
    }
    
    const largestBank = bankData.reduce((largest, bank) =>
        bank.balance > largest.balance ? bank : largest
    );
    
    document.getElementById('budgetName').value = 'Rent';
    document.getElementById('budgetAmount').value = '1200';
    document.getElementById('budgetType').value = 'expense';
    document.getElementById('budgetStartDate').value = new Date().toISOString().split('T')[0];
    openBudgetModal();
    
    setTimeout(() => {
        toggleBankSelection();
        document.getElementById('budgetLinkedBank').value = largestBank.id;
    }, 100);
}

// Quick Add Panel functionality
function toggleQuickAddPanel() {
    const panel = document.getElementById('quickAddPanel');
    const button = document.getElementById('quickAddButton');
    
    if (panel.classList.contains('show')) {
        closeQuickAddPanel();
    } else {
        openQuickAddPanel();
    }
}

function openQuickAddPanel() {
    const panel = document.getElementById('quickAddPanel');
    const button = document.getElementById('quickAddButton');
    
    panel.classList.add('show');
    button.classList.add('open');
    
    // Close panel when clicking outside
    setTimeout(() => {
        document.addEventListener('click', closeQuickAddOnOutsideClick);
    }, 0);
}

function closeQuickAddPanel() {
    const panel = document.getElementById('quickAddPanel');
    const button = document.getElementById('quickAddButton');
    
    panel.classList.remove('show');
    button.classList.remove('open');
    
    document.removeEventListener('click', closeQuickAddOnOutsideClick);
}

function closeQuickAddOnOutsideClick(event) {
    const dropdown = document.querySelector('.quick-add-dropdown');
    if (!dropdown.contains(event.target)) {
        closeQuickAddPanel();
    }
}

// Enhanced Quick Add functions
function quickAddUtilities() {
    document.getElementById('budgetName').value = 'Utilities';
    document.getElementById('budgetAmount').value = '150';
    document.getElementById('budgetType').value = 'expense';
    document.getElementById('budgetStartDate').value = new Date().toISOString().split('T')[0];
    openBudgetModal();
    
    setTimeout(() => {
        toggleBankSelection();
        if (bankData.length > 0) {
            const largestBank = bankData.reduce((largest, bank) =>
                bank.balance > largest.balance ? bank : largest
            );
            document.getElementById('budgetLinkedBank').value = largestBank.id;
        }
    }, 100);
}

function quickAddGroceries() {
    document.getElementById('budgetName').value = 'Groceries';
    document.getElementById('budgetAmount').value = '400';
    document.getElementById('budgetType').value = 'expense';
    document.getElementById('budgetStartDate').value = new Date().toISOString().split('T')[0];
    openBudgetModal();
    
    setTimeout(() => {
        toggleBankSelection();
        if (bankData.length > 0) {
            const largestBank = bankData.reduce((largest, bank) =>
                bank.balance > largest.balance ? bank : largest
            );
            document.getElementById('budgetLinkedBank').value = largestBank.id;
        }
    }, 100);
}

function quickAddSubscriptions() {
    document.getElementById('budgetName').value = 'Subscriptions';
    document.getElementById('budgetAmount').value = '45';
    document.getElementById('budgetType').value = 'expense';
    document.getElementById('budgetStartDate').value = new Date().toISOString().split('T')[0];
    openBudgetModal();
    
    setTimeout(() => {
        toggleBankSelection();
        if (bankData.length > 0) {
            const largestBank = bankData.reduce((largest, bank) =>
                bank.balance > largest.balance ? bank : largest
            );
            document.getElementById('budgetLinkedBank').value = largestBank.id;
        }
    }, 100);
}

function quickAddSavingsGoal() {
    document.getElementById('budgetName').value = 'Emergency Fund';
    document.getElementById('budgetAmount').value = '500';
    document.getElementById('budgetType').value = 'expense';
    document.getElementById('budgetStartDate').value = new Date().toISOString().split('T')[0];
    
    // Set end date to 1 year from now for savings goals
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);
    document.getElementById('budgetEndDate').value = endDate.toISOString().split('T')[0];
    
    openBudgetModal();
    
    setTimeout(() => {
        toggleBankSelection();
        if (bankData.length > 0) {
            const highestRateBank = bankData.reduce((best, bank) =>
                bank.interestRate > best.interestRate ? bank : best
            );
            document.getElementById('budgetLinkedBank').value = highestRateBank.id;
        }
    }, 100);
}


function toggleExportPanel() {
    const panel = document.getElementById('exportPanel');
    const button = document.getElementById('exportButton');
    
    // Close analysis panel if open
    closeAnalysisPanel();
    
    if (panel.classList.contains('show')) {
        closeExportPanel();
    } else {
        openExportPanel();
    }
}

function openExportPanel() {
    const panel = document.getElementById('exportPanel');
    const button = document.getElementById('exportButton');
    panel.classList.add('show');
    button.classList.add('open');
    
    // Close panel when clicking outside
    setTimeout(() => {
        document.addEventListener('click', closeExportOnOutsideClick);
    }, 0);
}

function closeExportPanel() {
    const panel = document.getElementById('exportPanel');
    const button = document.getElementById('exportButton');
    panel.classList.remove('show');
    button.classList.remove('open');
    document.removeEventListener('click', closeExportOnOutsideClick);
}

function closeExportOnOutsideClick(event) {
    const dropdown = document.querySelector('.export-dropdown');
    if (!dropdown.contains(event.target)) {
        closeExportPanel();
    }
}

function toggleAnalysisPanel() {
    const panel = document.getElementById('analysisPanel');
    const button = document.getElementById('analysisButton');
    
    // Close export panel if open
    closeExportPanel();
    
    if (panel.classList.contains('show')) {
        closeAnalysisPanel();
    } else {
        openAnalysisPanel();
    }
}

function openAnalysisPanel() {
    const panel = document.getElementById('analysisPanel');
    const button = document.getElementById('analysisButton');
    panel.classList.add('show');
    button.classList.add('open');
    
    // Close panel when clicking outside
    setTimeout(() => {
        document.addEventListener('click', closeAnalysisOnOutsideClick);
    }, 0);
}

function closeAnalysisPanel() {
    const panel = document.getElementById('analysisPanel');
    const button = document.getElementById('analysisButton');
    if (panel) panel.classList.remove('show');
    if (button) button.classList.remove('open');
    document.removeEventListener('click', closeAnalysisOnOutsideClick);
}

function closeAnalysisOnOutsideClick(event) {
    const dropdown = document.querySelector('.analysis-dropdown');
    if (!dropdown.contains(event.target)) {
        closeAnalysisPanel();
    }
}

// Add missing export functions that are referenced in the dropdown
function exportBudgetOnly() {
    const exportData = {
        budget: budgetData,
        metadata: {
            exportType: 'budget_only',
            exportDate: new Date().toISOString(),
            itemCount: budgetData.length
        },
        version: '1.0'
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `budget_only_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    showNotification('Budget data exported successfully!', 'success');
}

function exportForecasts() {
    if (budgetData.length === 0) {
        showNotification('No budget data to generate forecasts', 'info');
        return;
    }
    
    const months = 12;
    const forecastData = generateForecastData(months);
    
    // Create CSV content
    let csvContent = 'Month,Projected Balance,Monthly Change,Interest Earnings\n';
    
    for (let i = 0; i < forecastData.labels.length; i++) {
        csvContent += `${forecastData.labels[i]},${forecastData.balances[i]},${forecastData.monthlyChanges[i]},${forecastData.interestEarnings[i]}\n`;
    }
    
    // Add bank balance history if available
    if (forecastData.bankBalanceHistory && Object.keys(forecastData.bankBalanceHistory).length > 0) {
        csvContent += '\n\nBank Balance History\n';
        csvContent += 'Month,' + bankData.map(bank => bank.name).join(',') + '\n';
        
        for (let i = 0; i < forecastData.labels.length; i++) {
            let row = forecastData.labels[i];
            bankData.forEach(bank => {
                const balance = forecastData.bankBalanceHistory[bank.id] ? forecastData.bankBalanceHistory[bank.id][i] || 0 : 0;
                row += ',' + balance;
            });
            csvContent += row + '\n';
        }
    }
    
    const csvBlob = new Blob([csvContent], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(csvBlob);
    link.download = `financial_forecast_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    showNotification('Forecast data exported to CSV!', 'success');
}

// Add missing analysis functions
function analyzeCashFlow() {
    if (budgetData.length === 0) {
        showNotification('No budget data to analyze', 'info');
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    const activeBudgetData = budgetData.filter(budget => {
        return !budget.endDate || budget.endDate >= today;
    });
    
    const analysis = {
        totalIncome: activeBudgetData.filter(b => b.type === 'income').reduce((sum, b) => sum + Math.abs(b.amount), 0),
        totalExpenses: activeBudgetData.filter(b => b.type === 'expense').reduce((sum, b) => sum + Math.abs(b.amount), 0),
        incomeCategories: {},
        expenseCategories: {},
        bankLinkedIncome: 0,
        bankLinkedExpenses: 0,
        autoGeneratedIncome: 0
    };
    
    // Categorize income and expenses
    activeBudgetData.forEach(budget => {
        if (budget.type === 'income') {
            if (budget.isAutoGenerated) {
                analysis.autoGeneratedIncome += Math.abs(budget.amount);
            } else if (budget.linkedBankId) {
                analysis.bankLinkedIncome += Math.abs(budget.amount);
            }
            analysis.incomeCategories[budget.name] = Math.abs(budget.amount);
        } else {
            if (budget.linkedBankId) {
                analysis.bankLinkedExpenses += Math.abs(budget.amount);
            }
            analysis.expenseCategories[budget.name] = Math.abs(budget.amount);
        }
    });
    
    analysis.netCashFlow = analysis.totalIncome - analysis.totalExpenses;
    analysis.savingsRate = analysis.totalIncome > 0 ? (analysis.netCashFlow / analysis.totalIncome) * 100 : 0;
    
    // Display analysis
    const analysisHTML = `
        <div class="cashflow-analysis" style="margin-top: 15px; padding: 15px; background: #2a2a2a; border-radius: 8px; border-left: 3px solid #2196f3;">
            <h4 style="margin: 0 0 15px 0; color: #2196f3;">💰 Cash Flow Analysis</h4>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 15px;">
                <div style="text-align: center; padding: 10px; background: #333; border-radius: 4px;">
                    <h5 style="margin: 0; color: #4caf50;">Total Income</h5>
                    <div style="font-size: 1.2em; color: #4caf50; font-weight: bold;">${formatCurrency(analysis.totalIncome)}</div>
                </div>
                <div style="text-align: center; padding: 10px; background: #333; border-radius: 4px;">
                    <h5 style="margin: 0; color: #f44336;">Total Expenses</h5>
                    <div style="font-size: 1.2em; color: #f44336; font-weight: bold;">${formatCurrency(analysis.totalExpenses)}</div>
                </div>
                <div style="text-align: center; padding: 10px; background: #333; border-radius: 4px;">
                    <h5 style="margin: 0; color: ${analysis.netCashFlow >= 0 ? '#4caf50' : '#f44336'};">Net Cash Flow</h5>
                    <div style="font-size: 1.2em; color: ${analysis.netCashFlow >= 0 ? '#4caf50' : '#f44336'}; font-weight: bold;">${formatCurrency(analysis.netCashFlow)}</div>
                </div>
                <div style="text-align: center; padding: 10px; background: #333; border-radius: 4px;">
                    <h5 style="margin: 0; color: #ff9800;">Savings Rate</h5>
                    <div style="font-size: 1.2em; color: #ff9800; font-weight: bold;">${analysis.savingsRate.toFixed(1)}%</div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div>
                    <h5 style="color: #4caf50; margin: 0 0 10px 0;">Income Sources</h5>
                    <ul style="margin: 0; padding-left: 15px; color: #e0e0e0; font-size: 0.9em;">
                        <li>Bank Interest: ${formatCurrency(analysis.autoGeneratedIncome)}</li>
                        <li>Bank-Linked: ${formatCurrency(analysis.bankLinkedIncome)}</li>
                        ${Object.entries(analysis.incomeCategories).filter(([name]) => !name.includes('Interest')).map(([name, amount]) => 
                            `<li>${name}: ${formatCurrency(amount)}</li>`
                        ).join('')}
                    </ul>
                </div>
                <div>
                    <h5 style="color: #f44336; margin: 0 0 10px 0;">Expense Categories</h5>
                    <ul style="margin: 0; padding-left: 15px; color: #e0e0e0; font-size: 0.9em;">
                        <li>Bank-Linked: ${formatCurrency(analysis.bankLinkedExpenses)}</li>
                        ${Object.entries(analysis.expenseCategories).map(([name, amount]) => 
                            `<li>${name}: ${formatCurrency(amount)}</li>`
                        ).join('')}
                    </ul>
                </div>
            </div>
            
            ${analysis.savingsRate < 10 ? `
                <div style="margin-top: 15px; padding: 10px; background: rgba(255, 152, 0, 0.1); border-left: 3px solid #ff9800; border-radius: 4px;">
                    <strong style="color: #ff9800;">💡 Recommendation:</strong>
                    <span style="color: #e0e0e0;"> Consider increasing your savings rate. Financial experts recommend saving at least 10-20% of income.</span>
                </div>
            ` : ''}
        </div>
    `;
    
    const budgetList = document.getElementById('budgetList');
    if (budgetList) {
        const existingAnalysis = budgetList.querySelector('.cashflow-analysis');
        if (existingAnalysis) {
            existingAnalysis.remove();
        }
        budgetList.insertAdjacentHTML('beforeend', analysisHTML);
    }
    
    showNotification('Cash flow analysis complete', 'success');
}

function analyzeSpendingTrends() {
    if (budgetData.length === 0) {
        showNotification('No budget data to analyze', 'info');
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    const activeBudgetData = budgetData.filter(budget => {
        return (!budget.endDate || budget.endDate >= today) && budget.type === 'expense';
    });
    
    if (activeBudgetData.length === 0) {
        showNotification('No expense data to analyze', 'info');
        return;
    }
    
    const totalExpenses = activeBudgetData.reduce((sum, budget) => sum + Math.abs(budget.amount), 0);
    const categoryAnalysis = activeBudgetData.map(budget => ({
        name: budget.name,
        amount: Math.abs(budget.amount),
        percentage: (Math.abs(budget.amount) / totalExpenses) * 100,
        isLinkedToBank: !!budget.linkedBankId
    })).sort((a, b) => b.amount - a.amount);
    
    const analysisHTML = `
        <div class="spending-trends" style="margin-top: 15px; padding: 15px; background: #2a2a2a; border-radius: 8px; border-left: 3px solid #9c27b0;">
            <h4 style="margin: 0 0 15px 0; color: #9c27b0;">📈 Spending Trends Analysis</h4>
            
            <div style="margin-bottom: 15px;">
                <strong style="color: #fff;">Total Monthly Expenses: ${formatCurrency(totalExpenses)}</strong>
            </div>
            
            <div style="max-height: 300px; overflow-y: auto;">
                ${categoryAnalysis.map((category, index) => `
                    <div style="margin-bottom: 10px; padding: 10px; background: #333; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1;">
                            <div style="color: #fff; font-weight: bold;">${category.name}</div>
                            <div style="color: #888; font-size: 0.8em;">
                                ${category.percentage.toFixed(1)}% of total expenses
                                ${category.isLinkedToBank ? ' • Bank-linked' : ''}
                            </div>
                        </div>
                        <div style="color: #f44336; font-weight: bold; font-size: 1.1em;">
                            ${formatCurrency(category.amount)}
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div style="margin-top: 15px; padding: 10px; background: #333; border-radius: 4px;">
                <strong style="color: #9c27b0;">Key Insights:</strong>
                <ul style="margin: 5px 0; padding-left: 20px; color: #e0e0e0; font-size: 0.9em;">
                    <li>Largest expense: ${categoryAnalysis[0].name} (${categoryAnalysis[0].percentage.toFixed(1)}%)</li>
                    <li>Bank-linked expenses: ${categoryAnalysis.filter(c => c.isLinkedToBank).length} of ${categoryAnalysis.length}</li>
                    ${categoryAnalysis[0].percentage > 50 ? `<li style="color: #ff9800;">⚠️ One category dominates your spending</li>` : ''}
                    ${categoryAnalysis.filter(c => c.percentage > 20).length > 3 ? `<li style="color: #ff9800;">💡 Consider consolidating similar expense categories</li>` : ''}
                </ul>
            </div>
        </div>
    `;
    
    const budgetList = document.getElementById('budgetList');
    if (budgetList) {
        const existingAnalysis = budgetList.querySelector('.spending-trends');
        if (existingAnalysis) {
            existingAnalysis.remove();
        }
        budgetList.insertAdjacentHTML('beforeend', analysisHTML);
    }
    
    showNotification('Spending trends analysis complete', 'success');
}

function generateFinancialReport() {
    if (budgetData.length === 0 && bankData.length === 0) {
        showNotification('No financial data to generate report', 'info');
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    const activeBudgetData = budgetData.filter(budget => {
        return !budget.endDate || budget.endDate >= today;
    });
    
    // Calculate summary statistics
    const totalIncome = activeBudgetData.filter(b => b.type === 'income').reduce((sum, b) => sum + Math.abs(b.amount), 0);
    const totalExpenses = activeBudgetData.filter(b => b.type === 'expense').reduce((sum, b) => sum + Math.abs(b.amount), 0);
    const netMonthly = totalIncome - totalExpenses;
    const totalBankBalance = bankData.reduce((sum, bank) => sum + bank.balance, 0);
    const totalMonthlyInterest = bankData.reduce((sum, bank) => {
        return sum + calculateMonthlyInterest(bank.balance, bank.interestRate, bank.interestType);
    }, 0);
    
    // Generate 12-month projection
    const forecastData = generateForecastData(12);
    const yearEndBalance = forecastData.balances[forecastData.balances.length - 1];
    const totalInterestEarned = forecastData.interestEarnings.reduce((sum, interest) => sum + interest, 0);
    
    const reportData = {
        generatedDate: new Date().toISOString(),
        summary: {
            totalBankBalance,
            monthlyIncome: totalIncome,
			monthlyExpenses: totalExpenses,
            netMonthly,
            savingsRate: totalIncome > 0 ? (netMonthly / totalIncome) * 100 : 0,
            totalMonthlyInterest,
            annualInterestProjection: totalMonthlyInterest * 12
        },
        bankAccounts: bankData.length,
        budgetItems: activeBudgetData.length,
        projections: {
            yearEndBalance,
            totalInterestEarned,
            netGrowth: yearEndBalance - totalBankBalance
        }
    };
    
    // Create comprehensive report
    const reportHTML = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px;">
            <div style="background: #1e1e1e; border-radius: 10px; padding: 30px; max-width: 800px; width: 100%; max-height: 80vh; overflow-y: auto; border: 1px solid #444;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="color: #fff; margin: 0;">📋 Financial Report</h2>
                    <button onclick="this.closest('div').remove()" style="background: #666; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; font-size: 18px;">&times;</button>
                </div>
                
                <div style="margin-bottom: 20px; padding: 15px; background: #333; border-radius: 8px;">
                    <h3 style="color: #4caf50; margin: 0 0 10px 0;">💰 Current Financial Position</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                        <div style="text-align: center;">
                            <div style="color: #b0b0b0; font-size: 0.9em;">Total Bank Balance</div>
                            <div style="color: #4caf50; font-size: 1.3em; font-weight: bold;">${formatCurrency(reportData.summary.totalBankBalance)}</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="color: #b0b0b0; font-size: 0.9em;">Monthly Income</div>
                            <div style="color: #4caf50; font-size: 1.3em; font-weight: bold;">${formatCurrency(reportData.summary.monthlyIncome)}</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="color: #b0b0b0; font-size: 0.9em;">Monthly Expenses</div>
                            <div style="color: #f44336; font-size: 1.3em; font-weight: bold;">${formatCurrency(reportData.summary.monthlyExpenses)}</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="color: #b0b0b0; font-size: 0.9em;">Net Monthly</div>
                            <div style="color: ${reportData.summary.netMonthly >= 0 ? '#4caf50' : '#f44336'}; font-size: 1.3em; font-weight: bold;">${formatCurrency(reportData.summary.netMonthly)}</div>
                        </div>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px; padding: 15px; background: #333; border-radius: 8px;">
                    <h3 style="color: #2196f3; margin: 0 0 10px 0;">📊 Key Metrics</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px;">
                        <div style="text-align: center;">
                            <div style="color: #b0b0b0; font-size: 0.9em;">Savings Rate</div>
                            <div style="color: ${reportData.summary.savingsRate >= 10 ? '#4caf50' : '#ff9800'}; font-size: 1.2em; font-weight: bold;">${reportData.summary.savingsRate.toFixed(1)}%</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="color: #b0b0b0; font-size: 0.9em;">Bank Accounts</div>
                            <div style="color: #2196f3; font-size: 1.2em; font-weight: bold;">${reportData.bankAccounts}</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="color: #b0b0b0; font-size: 0.9em;">Budget Items</div>
                            <div style="color: #2196f3; font-size: 1.2em; font-weight: bold;">${reportData.budgetItems}</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="color: #b0b0b0; font-size: 0.9em;">Monthly Interest</div>
                            <div style="color: #ff9800; font-size: 1.2em; font-weight: bold;">${formatCurrency(reportData.summary.totalMonthlyInterest)}</div>
                        </div>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px; padding: 15px; background: #333; border-radius: 8px;">
                    <h3 style="color: #ff9800; margin: 0 0 10px 0;">🔮 12-Month Projections</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                        <div style="text-align: center;">
                            <div style="color: #b0b0b0; font-size: 0.9em;">Projected Year-End Balance</div>
                            <div style="color: ${reportData.projections.yearEndBalance >= reportData.summary.totalBankBalance ? '#4caf50' : '#f44336'}; font-size: 1.3em; font-weight: bold;">${formatCurrency(reportData.projections.yearEndBalance)}</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="color: #b0b0b0; font-size: 0.9em;">Total Interest Earned</div>
                            <div style="color: #ff9800; font-size: 1.3em; font-weight: bold;">${formatCurrency(reportData.projections.totalInterestEarned)}</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="color: #b0b0b0; font-size: 0.9em;">Net Growth</div>
                            <div style="color: ${reportData.projections.netGrowth >= 0 ? '#4caf50' : '#f44336'}; font-size: 1.3em; font-weight: bold;">${formatCurrency(reportData.projections.netGrowth)}</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="color: #b0b0b0; font-size: 0.9em;">Growth Rate</div>
                            <div style="color: ${reportData.projections.netGrowth >= 0 ? '#4caf50' : '#f44336'}; font-size: 1.3em; font-weight: bold;">${((reportData.projections.netGrowth / reportData.summary.totalBankBalance) * 100).toFixed(1)}%</div>
                        </div>
                    </div>
                </div>
                
                ${bankData.length > 0 ? `
                <div style="margin-bottom: 20px; padding: 15px; background: #333; border-radius: 8px;">
                    <h3 style="color: #9c27b0; margin: 0 0 10px 0;">🏦 Bank Account Summary</h3>
                    <div style="max-height: 200px; overflow-y: auto;">
                        ${bankData.map(bank => {
                            const monthlyInterest = calculateMonthlyInterest(bank.balance, bank.interestRate, bank.interestType);
                            const annualInterest = monthlyInterest * 12;
                            return `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #444;">
                                    <div>
                                        <div style="color: #fff; font-weight: bold;">${bank.name}</div>
                                        <div style="color: #888; font-size: 0.8em;">${(bank.interestRate * 100).toFixed(3)}% APY • ${bank.interestType}</div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="color: #4caf50; font-weight: bold;">${formatCurrency(bank.balance)}</div>
                                        <div style="color: #ff9800; font-size: 0.8em;">+${formatCurrency(annualInterest)}/year</div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                ` : ''}
                
                <div style="margin-bottom: 20px; padding: 15px; background: #333; border-radius: 8px;">
                    <h3 style="color: #f44336; margin: 0 0 10px 0;">⚠️ Recommendations</h3>
                    <ul style="margin: 0; padding-left: 20px; color: #e0e0e0;">
                        ${reportData.summary.savingsRate < 10 ? '<li style="color: #ff9800;">Consider increasing your savings rate to at least 10-20%</li>' : ''}
                        ${reportData.summary.netMonthly < 0 ? '<li style="color: #f44336;">Address negative cash flow by reducing expenses or increasing income</li>' : ''}
                        ${bankData.length === 1 ? '<li style="color: #2196f3;">Consider diversifying across multiple bank accounts for better rates</li>' : ''}
                        ${bankData.length > 1 && Math.max(...bankData.map(b => b.interestRate)) - Math.min(...bankData.map(b => b.interestRate)) > 0.02 ? '<li style="color: #ff9800;">Move funds from low-interest to high-interest accounts</li>' : ''}
                        ${reportData.projections.netGrowth > 0 ? '<li style="color: #4caf50;">Great job! Your finances are on a positive trajectory</li>' : ''}
                    </ul>
                </div>
                
                <div style="text-align: center; margin-top: 20px;">
                    <button onclick="downloadFinancialReport()" style="background: #4caf50; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; margin-right: 10px;">
                        📥 Download Report
                    </button>
                    <button onclick="this.closest('div').remove()" style="background: #666; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                        Close
                    </button>
                </div>
                
                <div style="margin-top: 15px; text-align: center; color: #888; font-size: 0.8em;">
                    Report generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
                </div>
            </div>
        </div>
    `;
    
    // Store report data for download
    window.currentReportData = reportData;
    
    // Display the report
    document.body.insertAdjacentHTML('beforeend', reportHTML);
    
    showNotification('Financial report generated successfully', 'success');
}

function downloadFinancialReport() {
    if (!window.currentReportData) {
        showNotification('No report data available', 'error');
        return;
    }
    
    const reportData = window.currentReportData;
    
    // Create detailed JSON report
    const detailedReport = {
        ...reportData,
        budgetData: budgetData,
        bankData: bankData,
        recommendations: []
    };
    
    // Add recommendations based on analysis
    if (reportData.summary.savingsRate < 10) {
        detailedReport.recommendations.push('Increase savings rate to at least 10-20%');
    }
    if (reportData.summary.netMonthly < 0) {
        detailedReport.recommendations.push('Address negative cash flow');
    }
    if (bankData.length === 1) {
        detailedReport.recommendations.push('Consider diversifying bank accounts');
    }
    
    const dataStr = JSON.stringify(detailedReport, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `financial_report_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showNotification('Financial report downloaded successfully!', 'success');
}

// Update the keyboard shortcuts to close dropdowns on Escape
document.addEventListener('keydown', function(e) {
    // Existing shortcuts...
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        openBudgetModal();
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'B') {
        e.preventDefault();
        openBankModal();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        toggleBankSection();
    }
    
    // Close modals and dropdowns on Escape
    if (e.key === 'Escape') {
        closeBudgetModal();
        closeBankModal();
        closeQuickAddPanel();
        closeExportPanel();
        closeAnalysisPanel();
        
        // Close any open report overlays
        const overlays = document.querySelectorAll('[style*="position: fixed"][style*="z-index: 10000"]');
        overlays.forEach(overlay => overlay.remove());
    }
});


function initializeDashboard() {
    console.log('initializeDashboard() called');
    console.log('Budget data loaded:', budgetData.length, 'items');
    console.log('Bank data loaded:', bankData.length, 'accounts');
    updateStats();
    updateBudgetList();
    updateBankList();
    updateForecastChart();
    // addUtilityButtons();
}
