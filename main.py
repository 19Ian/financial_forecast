from datetime import datetime, timedelta
from calendar import monthrange
import matplotlib as plt
import json

class Colors:
	RED = '\033[91m'
	GREEN = '\033[92m'
	RESET = '\033[0m'

class Bank:
	def __init__(self, name, starting_amount, interest_rate):
		self.name = name
		self.starting_amount = starting_amount
		self.interest_rate = interest_rate
		self.current_balance = starting_amount

def color_text(text, is_positive):
	"""Color text green if positive, red if negative"""
	if is_positive:
		return f"{Colors.GREEN}{text}{Colors.RESET}"
	else:
		return f"{Colors.RED}{text}{Colors.RESET}"

def get_hardcoded_costs():
	"""Return hardcoded costs - modify this function to change your costs"""
	
	# bank1 = {
	# 	3000.0, # starting_balance
	# 	0.036 # interest_rate
	# }

	# bank2 = {
	# 	5000.0, # starting_balance
	# 	0.001 # interest_rate
	# }

	bank1 = Bank("BOK", 5000, 0.001)
	bank2 = Bank("CO", 3000, 0.036)


	# starting_balance = 8236.0
	
	# Monthly costs: {name: (amount, day_of_month)}
	monthly_costs = {
		# 'gas': (-120, 1),
		# 'food':(-15, 1),
		# 'dates':(-50, 1),
		# 'insurance': (-90, 1),
		# 'social': (-15, 1),
		# 'interest':(2, 1),
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
		# 'tuition': (-4000, datetime(2026, 1, 15)), # probably more like $3200 but not sure yet
		# 'tithe': (-500, datetime(2025, 9, 1)),
		# 'paycheck': (1000, datetime(2025, 12, 26)),
		# 'paycheck2': (1000, datetime(2026, 1, 16))
	}

	banks = [
		bank1, 
		bank2
	]

	bank_balance = 0
	for bank in banks:
		bank_balance += bank.starting_amount
	
	return monthly_costs, daily_costs, special_events, banks, bank_balance

def display_setup_costs(monthly_costs, daily_costs, special_events, starting_bank_balance):
	"""Display the hardcoded costs for verification"""
	print("=== CURRENT COST SETUP ===\n")

	# color = Colors.GREEN if starting_balance >= 0 else Colors.RED
	print("Starting Balance: " + str(starting_bank_balance) + "\n")
	
	print("Monthly Costs:")
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

def run_cost_simulation(monthly_costs, daily_costs, special_events, target_year, banks, starting_bank_balance):
	current_date = datetime.now().date()
	end_date = datetime(target_year, 12, 31).date()
	total_money = starting_bank_balance
	
	print(f"=== COST SIMULATION FROM {current_date} TO {end_date} ===\n")
	
	while ((current_date <= end_date) and (total_money > 0)):
		day_costs = []

		if(current_date.day == 1):
			for bank in banks:
				interest = bank.current_balance * bank.interest_rate / 12
				bank.current_balance += interest
				day_costs.append((bank.name + " Interest", interest))
		
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
		
		# Print costs for this day if any exist
		if day_costs:
			for name, amount in day_costs:
				total_money += amount
				
				cost_text = f"{name}: ${amount:.2f}"
				colored_cost = color_text(cost_text, amount >= 0)
				
				total_text = f"${total_money:.2f}"
				colored_total = color_text(total_text, total_money >= 0)
				
				print(f"{current_date} - {colored_cost} - Total: {colored_total}")
		
		current_date += timedelta(days=1)
	
	print(f"\n=== SIMULATION COMPLETE ===")
	final_total_text = f"Final Total: ${total_money:.2f}"
	colored_final = color_text(final_total_text, total_money >= 0)
	print(colored_final)


def load_existing_budget_data():
    """Load existing budget data from JSON if it exists"""
    try:
        with open('financial_data.json', 'r') as f:
            existing_data = json.load(f)
            return existing_data.get('budget', [])
    except (FileNotFoundError, json.JSONDecodeError, KeyError):
        return []

def run_cost_simulation_for_web(monthly_costs, daily_costs, special_events, target_year, banks, starting_bank_balance):
    """Modified simulation that returns data for web visualization"""
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
                interest = bank.current_balance * bank.interest_rate / 12
                bank.current_balance += interest
                day_costs.append((bank.name + " Interest", interest))
                
                # Track individual bank balances
                bank_data.append({
                    "date": current_date.isoformat(),
                    "bank": bank.name,
                    "balance": bank.current_balance,
                    "interest_rate": bank.interest_rate
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
    
    # Load existing budget data to preserve user changes
    existing_budget = load_existing_budget_data()
    
    # Prepare data for export
    export_data = {
        "metadata": {
            "start_date": datetime.now().date().isoformat(),
            "end_date": end_date.isoformat(),
            "starting_balance": starting_bank_balance,
            "final_balance": total_money,
            "banks": [{"name": bank.name, "starting_amount": bank.starting_amount, "interest_rate": bank.interest_rate} for bank in banks]
        },
        "balance_data": balance_data,
        "transactions": transactions,
        "bank_data": bank_data,
        "budget": existing_budget  # Preserve existing budget data
    }
    
    # Export to JSON
    with open('financial_data.json', 'w') as f:
        json.dump(export_data, f, indent=2)
    
    print(f"\n=== DATA EXPORTED TO financial_data.json ===")
    print(f"=== BUDGET DATA PRESERVED: {len(existing_budget)} items ===")
    print(f"=== SIMULATION COMPLETE ===")
    final_total_text = f"Final Total: ${total_money:.2f}"
    colored_final = color_text(final_total_text, total_money >= 0)
    print(colored_final)
    
    return export_data


def main():
	monthly_costs, daily_costs, special_events, banks, starting_bank_balance = get_hardcoded_costs()
	
	display_setup_costs(monthly_costs, daily_costs, special_events, starting_bank_balance)
	
	target_year = get_target_year()
	
	# run_cost_simulation(monthly_costs, daily_costs, special_events, target_year, banks, starting_bank_balance)
	# plt.plot([1,2], [2,3])

	data = run_cost_simulation_for_web(monthly_costs, daily_costs, special_events, target_year, banks, starting_bank_balance)


if __name__ == "__main__":
	main()
