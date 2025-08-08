from datetime import datetime, timedelta
from calendar import monthrange
import matplotlib as plt
import json

class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    RESET = '\033[0m'

class Bank:
    def __init__(self, name, starting_amount, interest_rate, interest_type='compound'):
        self.name = name
        self.starting_amount = starting_amount
        self.interest_rate = interest_rate
        self.current_balance = starting_amount
        self.interest_type = interest_type
        self.id = hash(name) % 1000000  # Simple ID generation

def color_text(text, is_positive):
    """Color text green if positive, red if negative"""
    if is_positive:
        return f"{Colors.GREEN}{text}{Colors.RESET}"
    else:
        return f"{Colors.RED}{text}{Colors.RESET}"

def get_hardcoded_costs():
    """Return hardcoded costs - modify this function to change your costs"""
    
    # Define your banks with the new structure
    bank1 = Bank("BOK Savings", 5000, 0.001, 'compound')
    bank2 = Bank("Capital One 360", 3000, 0.036, 'compound')
    
    # Monthly costs: {name: (amount, day_of_month)}
    monthly_costs = {
        # 'gas': (-120, 1),
        # 'food':(-15, 1),
        # 'dates':(-50, 1),
        # 'insurance': (-90, 1),
        # 'social': (-15, 1),
        # 'work_for_dad':(90, 1) # 2 hrs a week
    }
    
    # Daily costs: {name: amount}
    daily_costs = {
    }
    
    # Special events: {name: (amount, datetime_object)}
    special_events = {
        # 'christmas_shopping': (-40, datetime(2025, 12, 15)),
        # 'gifts': (-40, datetime(2026, 1, 10)),
        # 'club_fees': (-100, datetime(2025, 9, 1)),
        # 'carnegie': (-3200, datetime(2026, 5, 1)),
        # 'world_cup': (-1500, datetime(2026, 6, 15)),
        # 'tuition': (-4000, datetime(2026, 1, 15)),
        # 'tithe': (-500, datetime(2025, 9, 1)),
        # 'paycheck': (1000, datetime(2025, 12, 26)),
        # 'paycheck2': (1000, datetime(2026, 1, 16))
    }

    banks = [bank1, bank2]
    bank_balance = sum(bank.starting_amount for bank in banks)
    
    return monthly_costs, daily_costs, special_events, banks, bank_balance

def calculate_monthly_interest(bank):
    """Calculate monthly interest for a bank account"""
    if bank.interest_type == 'compound':
        # Monthly compound interest
        return bank.current_balance * (pow(1 + bank.interest_rate, 1/12) - 1)
    else:
        # Simple interest (monthly)
        return bank.starting_amount * bank.interest_rate / 12

def load_existing_data():
    """Load existing budget and bank data from JSON if it exists"""
    try:
        with open('financial_data.json', 'r') as f:
            existing_data = json.load(f)
            budget_data = existing_data.get('budget', [])
            bank_data = existing_data.get('banks', [])
            return budget_data, bank_data
    except (FileNotFoundError, json.JSONDecodeError, KeyError):
        return [], []

def run_cost_simulation_for_web(monthly_costs, daily_costs, special_events, target_year, banks, starting_bank_balance):
    """Modified simulation that returns data for web visualization with bank integration"""
    current_date = datetime.now().date()
    end_date = datetime(target_year, 12, 31).date()
    total_money = starting_bank_balance
    
    # Lists to store data for web output
    balance_data = [{"date": current_date.isoformat(), "balance": total_money}]
    transactions = []
    bank_data = []
    
    print(f"=== COST SIMULATION FROM {current_date} TO {end_date} ===\n")
    
    while ((current_date <= end_date) and (current_date.month != 7)):
        day_costs = []

        if(current_date.day == 1):
            for bank in banks:
                interest = calculate_monthly_interest(bank)
                bank.current_balance += interest
                day_costs.append((bank.name + " Interest", interest))
                
                # Track individual bank balances
                bank_data.append({
                    "date": current_date.isoformat(),
                    "bank": bank.name,
                    "balance": bank.current_balance,
                    "interest_rate": bank.interest_rate,
                    "interest_type": bank.interest_type,
                    "monthly_interest": interest
                })
        
        # Check for monthly costs
        for name, (amount, day) in monthly_costs.items():
            if current_date.day == day:
                day_costs.append((name, amount))
        
        # Check for daily costs
        for name, amount in daily_costs.items():
            day_costs.append((name, amount))
        
        # Check for special events
        for name, (amount, event_date) in special_events.items():
            if current_date == event_date.date():
                day_costs.append((name, amount))
        
        # Process costs for this day if any exist
        if day_costs:
            for name, amount in day_costs:
                total_money += amount
                
                # Store transaction data
                transactions.append({
                    "date": current_date.isoformat(),
                    "name": name,
                    "amount": amount,
                    "balance": total_money,
                    "type": "income" if amount > 0 else "expense"
                })
                
                cost_text = f"{name}: ${amount:.2f}"
                colored_cost = color_text(cost_text, amount >= 0)
                
                total_text = f"${total_money:.2f}"
                colored_total = color_text(total_text, total_money >= 0)
                
                print(f"{current_date} - {colored_cost} - Total: {colored_total}")
            
            # Add balance data point
            balance_data.append({
                "date": current_date.isoformat(),
                "balance": total_money
            })
        
        current_date += timedelta(days=1)
    
    # Load existing budget and bank data to preserve user changes
    existing_budget, existing_banks = load_existing_data()
    
    # Convert banks to the format expected by the web interface
    web_banks = []
    for bank in banks:
        web_bank = {
            "id": bank.id,
            "name": bank.name,
            "balance": bank.starting_amount,
            "interestRate": bank.interest_rate,
            "interestType": bank.interest_type
        }
        web_banks.append(web_bank)
    
    # Use existing bank data if available, otherwise use generated data
    final_banks = existing_banks if existing_banks else web_banks
    
    # Generate budget items for bank interest if not already present
    budget_items = existing_budget.copy() if existing_budget else []
    
    # Add bank interest budget items if they don't exist
    for bank in banks:
        interest_item_name = f"{bank.name} Interest"
        existing_item = next((item for item in budget_items if item.get('name') == interest_item_name), None)
        
        if not existing_item:
            monthly_interest = calculate_monthly_interest(bank)
            interest_budget_item = {
                "id": int(datetime.now().timestamp() * 1000) + bank.id,
                "name": interest_item_name,
                "amount": monthly_interest,
                "type": "income",
                "startDate": datetime.now().date().isoformat(),
                "endDate": None,
                "isAutoGenerated": True,
                "linkedBankId": bank.id
            }
            budget_items.append(interest_budget_item)
    
    # Prepare data for export
    export_data = {
        "metadata": {
            "start_date": datetime.now().date().isoformat(),
            "end_date": end_date.isoformat(),
            "starting_balance": starting_bank_balance,
            "final_balance": total_money,
            "total_bank_balance": sum(bank.starting_amount for bank in banks),
            "bank_count": len(banks)
        },
        "balance_data": balance_data,
        "transactions": transactions,
        "bank_data": bank_data,
        "budget": budget_items,
        "banks": final_banks
    }
    
    # Export to JSON
    with open('financial_data.json', 'w') as f:
        json.dump(export_data, f, indent=2)
    
    print(f"\n=== DATA EXPORTED TO financial_data.json ===")
    print(f"=== BUDGET DATA: {len(budget_items)} items ===")
    print(f"=== BANK DATA: {len(final_banks)} accounts ===")
    print(f"=== SIMULATION COMPLETE ===")
    final_total_text = f"Final Total: ${total_money:.2f}"
    colored_final = color_text(final_total_text, total_money >= 0)
    print(colored_final)
    
    return export_data

def display_setup_costs(monthly_costs, daily_costs, special_events, starting_bank_balance, banks):
    """Display the hardcoded costs for verification"""
    print("=== CURRENT COST SETUP ===\n")

    print("Starting Balance: " + str(starting_bank_balance) + "\n")
    
    print("Bank Accounts:")
    for bank in banks:
        color = Colors.GREEN if bank.starting_amount >= 0 else Colors.RED
        interest_type_text = f"({bank.interest_type} interest)"
        print(f"  {bank.name}: {color}${bank.starting_amount:.2f}{Colors.RESET} at {bank.interest_rate*100:.3f}% APY {interest_type_text}")
    
    print("\nMonthly Costs:")
    for name, (amount, day) in monthly_costs.items():
        color = Colors.GREEN if amount >= 0 else Colors.RED
        print(f"  {name}: {color}${amount:.2f}{Colors.RESET} on day {day}")
    
    print("\nDaily Costs:")
    for name, amount in daily_costs.items():
        color = Colors.GREEN if amount >= 0 else Colors.RED
        print(f"  {name}: {color}${amount:.2f}{Colors.RESET}")
    
    print("\nSpecial Events:")
    for name, (amount, date) in special_events.items():
        color = Colors.GREEN if amount >= 0 else Colors.RED
        print(f"  {name}: {color}${amount:.2f}{Colors.RESET} on {date.strftime('%m/%d/%Y')}")
    
    print("\n" + "="*50 + "\n")

def get_target_year():
    while True:
        try:
            year = int(input("Enter the year to run until: "))
            if year >= datetime.now().year:
                return year
            else:
                print("Please enter a year that is current year or later.")
        except ValueError:
            print("Please enter a valid year.")

def main():
    monthly_costs, daily_costs, special_events, banks, starting_bank_balance = get_hardcoded_costs()
    
    display_setup_costs(monthly_costs, daily_costs, special_events, starting_bank_balance, banks)
    
    target_year = get_target_year()
    
    data = run_cost_simulation_for_web(monthly_costs, daily_costs, special_events, target_year, banks, starting_bank_balance)

if __name__ == "__main__":
    main()
