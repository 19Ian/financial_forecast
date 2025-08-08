let financialData = null;
let budgetData = [];
let forecastChart = null;
let editingBudgetId = null;

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
            
            showNotification('Loaded saved changes from browser storage', 'info');
        } else {
            // Load from JSON file
            const response = await fetch('financial_data.json');
            financialData = await response.json();
            
            // Initialize budget data from JSON or empty
            if (financialData.budget && Array.isArray(financialData.budget)) {
                budgetData = financialData.budget;
                console.log('Loaded budget data from JSON:', budgetData.length, 'items');
            } else {
                budgetData = [];
                console.log('No budget data in JSON, starting with empty budget');
            }
        }
        
        // Add unique IDs to budget items if they don't exist
        budgetData.forEach((budget, index) => {
            if (!budget.id) {
                budget.id = Date.now() + 1000 + index;
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
        
    } catch (error) {
        console.error('Error loading financial data:', error);
        alert('Error loading financial data. Make sure you have run the Python script first.');
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
    
    // Calculate current balance (from original data if available)
    const currentBalance = financialData?.metadata?.starting_balance || 0;
    
    document.getElementById('currentBalance').textContent = formatCurrency(currentBalance);
    document.getElementById('monthlyIncome').textContent = formatCurrency(monthlyIncome);
    document.getElementById('monthlyExpenses').textContent = formatCurrency(monthlyExpenses);
    document.getElementById('netMonthly').textContent = formatCurrency(netMonthly);
    
    // Update net monthly color
    const netMonthlyElement = document.getElementById('netMonthly');
    netMonthlyElement.className = 'stat-value ' + (netMonthly >= 0 ? 'positive' : 'negative');
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
    if (saved) {
        try {
            return JSON.parse(saved);
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

function updateBudgetList() {
    const budgetList = document.getElementById('budgetList');
    if (!budgetList) return;

    // Filter active budget items based on current date
    const today = new Date().toISOString().split('T')[0];
    const activeBudgetData = budgetData.filter(budget => {
        return !budget.endDate || budget.endDate >= today;
    });

    // Calculate budget summary using only active items
    const totalIncome = activeBudgetData.filter(b => b.type === 'income').reduce((sum, b) => sum + Math.abs(b.amount), 0);
    const totalExpenses = activeBudgetData.filter(b => b.type === 'expense').reduce((sum, b) => sum + Math.abs(b.amount), 0);
    const netBudget = totalIncome - totalExpenses;

    const summaryHTML = `
        <div class="budget-summary">
            <div class="budget-summary-item">
                <h4>Monthly Income</h4>
                <div class="value positive">${formatCurrency(totalIncome)}</div>
            </div>
            <div class="budget-summary-item">
                <h4>Monthly Expenses</h4>
                <div class="value negative">${formatCurrency(totalExpenses)}</div>
            </div>
            <div class="budget-summary-item">
                <h4>Net Monthly</h4>
                <div class="value ${netBudget >= 0 ? 'positive' : 'negative'}">${formatCurrency(netBudget)}</div>
            </div>
        </div>
    `;

    // Enhanced budget item display with end date and status
    const budgetItemsHTML = budgetData.map(budget => {
        const isActive = !budget.endDate || budget.endDate >= today;
        const statusClass = isActive ? '' : 'style="opacity: 0.6; background-color: #444;"';
        const statusText = isActive ? '' : ' (Ended)';
        
        let dateText = `Since ${formatDate(budget.startDate)}`;
        if (budget.endDate) {
            dateText += ` until ${formatDate(budget.endDate)}`;
        }
        
        return `
            <div class="budget-item" ${statusClass}>
                <div class="budget-details">
                    <strong>${budget.name}${statusText}</strong>
                    <br>
                    <small>${dateText} • ${budget.type}</small>
                </div>
                <div class="budget-actions">
                    <span class="${budget.type === 'income' ? 'positive' : 'negative'}">
                        ${formatCurrency(Math.abs(budget.amount))}/month
                    </span>
                    <div>
                        <button class="edit-btn" onclick="editBudgetItem(${budget.id})">
                            Edit
                        </button>
                        <button class="delete-btn" onclick="deleteBudgetItem(${budget.id})">
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    budgetList.innerHTML = summaryHTML + budgetItemsHTML;
    
    // Add insights after a short delay to ensure DOM is updated
    setTimeout(() => {
        displayBudgetInsights();
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

	    console.log('Budget form values:', { name, amount, type, startDate, endDate });

    // Fixed validation - check for empty string, NaN, and empty values
    if (!name || isNaN(amount) || amount <= 0 || !type || !startDate) {
        alert('Please fill in all fields with valid values. Amount must be greater than 0.');
        console.log('Validation failed:', { 
            nameValid: !!name, 
            amountValid: !isNaN(amount) && amount > 0, 
            typeValid: !!type, 
            dateValid: !!startDate 
        });
        return;
    }

    // Validate end date if provided
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
                endDate: endDate || null
            };
            showNotification(`Updated budget item "${name}"`, 'success');
        }
    } else {
        // Add new budget item
        const newBudget = {
            id: Date.now(),
            name,
            amount: budgetAmount,
            type,
            startDate,
            endDate: endDate || null
        };
        budgetData.push(newBudget);
        showNotification(`Added budget item "${name}"`, 'success');
    }

    // Save immediately after making changes
    saveBudgetData();
    updateBudgetList();
    updateStats();
    updateForecastChart();
    closeBudgetModal();
    
    console.log('Current budget data after save:', budgetData);
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

    forecastChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: forecastData.labels,
            datasets: [{
                label: 'Projected Balance',
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
            }]
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

function generateForecastData(months) {
    const currentBalance = financialData?.metadata?.starting_balance || 0;
    
    const labels = [];
    const balances = [];
    const monthlyChanges = [];
    
    let runningBalance = currentBalance;
    const today = new Date();
    
    for (let i = 0; i <= months; i++) {
        const forecastDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const monthLabel = forecastDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short' 
        });
        
        // Calculate monthly budget total considering end dates
        const forecastDateString = forecastDate.toISOString().split('T')[0];
        const activeBudgetItems = budgetData.filter(budget => {
            const startDate = budget.startDate;
            const endDate = budget.endDate;
            
            // Include if budget is active during this forecast month
            return startDate <= forecastDateString && 
                   (!endDate || endDate >= forecastDateString);
        });
        
        const monthlyBudgetTotal = activeBudgetItems.reduce((sum, budget) => sum + budget.amount, 0);
        
        labels.push(monthLabel);
        balances.push(runningBalance);
        monthlyChanges.push(monthlyBudgetTotal);
        
        if (i < months) {
            runningBalance += monthlyBudgetTotal;
        }
    }
    
    return { labels, balances, monthlyChanges };
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

// Update the main initialization function
function initializeDashboard() {
    console.log('initializeDashboard() called');
    console.log('Budget data loaded:', budgetData.length, 'items');
    updateStats();
    updateBudgetList();
    updateForecastChart();
    addUtilityButtons();
}

// Update the modal click handler to include budget modal
window.onclick = function(event) {
    const budgetModal = document.getElementById('budgetModal');
    
    if (event.target === budgetModal) {
        closeBudgetModal();
    }
}

// Update keyboard shortcuts to include budget modal
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + B to add new budget item
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        openBudgetModal();
    }
    
    // Escape to close modals
    if (e.key === 'Escape') {
        closeBudgetModal();
    }
});

// Enhanced export functionality to include budget data
function exportAllData() {
    const exportData = {
        budget: budgetData,
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
                
                if (importedData.budget && Array.isArray(importedData.budget)) {
                    if (confirm('This will replace your current budget data. Continue?')) {
                        budgetData = importedData.budget;
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
        location.reload();
    }
}

// Update utility buttons to include budget features
function addUtilityButtons() {
    const utilityHTML = `
        <div class="utility-buttons" style="margin-top: 20px; text-align: center;">
            <button class="btn btn-secondary" onclick="exportAllData()" style="margin: 0 10px;">
                Export Budget Data
            </button>
            <button class="btn btn-secondary" onclick="importBudgetData()" style="margin: 0 10px;">
                Import Budget Data
            </button>
            <button class="btn btn-secondary" onclick="debugStorage()" style="margin: 0 10px;">
                Debug Storage
            </button>
            <button class="btn btn-secondary" onclick="resetToOriginal()" style="margin: 0 10px;">
                Reset All Data
            </button>
        </div>
        <div style="margin-top: 10px; text-align: center; color: #888; font-size: 0.8em;">
            Keyboard shortcuts: Ctrl+B (New Budget Item), Esc (Close Modal)
        </div>
    `;
    
    // Add to the last chart container
    const lastContainer = document.querySelector('.chart-container:last-child');
    if (lastContainer && !lastContainer.querySelector('.utility-buttons')) {
        lastContainer.insertAdjacentHTML('beforeend', utilityHTML);
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


