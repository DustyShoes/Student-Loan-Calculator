console.log("dataHandler.js loaded");

var todaysDate = new Date();
var todaysMonth = todaysDate.getMonth()+1;
var todaysYear = todaysDate.getFullYear();

/* DATA STORAGE */
var listLoans = new Array();
var scenario = {};
var future = {};

/* outputs the listLoans variable to the screen */
function displayLoans() {
	//Need to clear out other rows that were made here before
	for( var loanIndex = 0; loanIndex < listLoans.length + 1; loanIndex++ ) {
		var element = document.getElementById("displayLoan" + loanIndex);
		if(element) {
			element.parentNode.removeChild(element);
		}
	}
	
	//insert a dom element to display the new loan
	for( var loanIndex = 0; loanIndex < listLoans.length; loanIndex++ ) { 
		//alert("for index " + loanIndex + " listLoans.length=" + listLoans.length);
		var displayLoanRow = '<div id="displayLoan' + loanIndex + '" class="single-loan-row single-loan-row-locked"> \
			<div class="horizontal-divs loan-amount"> \
		    	<output type="text" id="loanAmount' + loanIndex + '" class="display-loan-output"></output> \
		    	' + listLoans[loanIndex].amount + ' \
	       	</div> \
	       	<div class="horizontal-divs interest-rate-column"> \
        		<output type="text" id="interestRate' + loanIndex + '" class="display-loan-output"></output> \
        		' + listLoans[loanIndex].rate + ' \
        	</div> \
        	<div class="horizontal-divs add-edit-loan-button"> \
        		<button type="button" id="editLoanButton' + loanIndex + '" name="editLoanButton' + loanIndex + '" class="user-input-rectangle loan-edit-button">Edit</button> \
        	</div> \
			</div>';
		document.getElementById("newLoan").insertAdjacentHTML('beforebegin', displayLoanRow);
		
		// Edit button callback. This deletes the loan from the list.
		document.getElementById("editLoanButton" + loanIndex).addEventListener("click", function() {
			var deleteIndex = this.name.slice(-1);
			if(deleteIndex == 0) {
				listLoans.shift();
			} else {
				listLoans.splice(deleteIndex, deleteIndex);
			}
			displayLoans();
		}, false);
	}
}

/* ADD NEW USERDATA */
function addLoan(amount, rate) {
	var newLoan = {'amount': amount, 'rate': rate};
	console.log(newLoan);
	listLoans.push(newLoan);
	//console.log("listLoans[0].amount=" + listLoans[0].amount + "  listLoans[0].rate=" + listLoans[0].rate);
	displayLoans();
	playScenario();
}
function addScenario(inScenario) {
	//TODO: Reformat this json string in file javascript.js event listener for submitButton. Just pass a json object, like normal.
	//console.log("addScenario() incoming scenario (json string) is: " + inScenario);
	var json = JSON.parse(inScenario).scenario;
	//console.log(json);
	
	scenario = json; //save to global var
	playScenario();
}

/* SCENARIO HANDLER */
function playScenario() {
	console.log("------------------------- playScenario()---------------------");
	console.log("scenario is " + JSON.stringify(scenario, null, 2));
	
	future = {};
	future = {"information": {"totalMonthlyPaymentBeginning": 0}, "loans": [], "extraPayments": [0]};
	future.information.totalMonthsInPaymentPlan = scenario.totalMonthsRemaining;
	future.information.totalMonthlyPaymentBeginning = Number(scenario.extraMonthlyPaymentAmount);
	
	
	//initialize all loans
	for(var i=0; i<listLoans.length; i++) {
		var newLoan = {"rate": listLoans[i].rate, "startingAmount": listLoans[i].amount, 
				"monthlyAmounts": [{"principleRemaining": listLoans[i].amount, "principlePayment": 0, "interestPayment": 0}]};
		newLoan.monthlyAmounts[0].principlePayment = getLoanPrincipleMinimumPayment(newLoan.monthlyAmounts[0].principleRemaining, future.information.totalMonthsInPaymentPlan, scenario.plan, newLoan.rate);
		newLoan.monthlyAmounts[0].interestPayment = getLoanInterestMinimumPayment(newLoan.monthlyAmounts[0].principleRemaining, future.information.totalMonthsInPaymentPlan, scenario.plan, newLoan.rate);
		future.loans.push(newLoan);
		console.log("Inserting new loan " + JSON.stringify(newLoan, null, 2));
		
		// Add the payment to the initial total of payments. This may not be the best place for this code, init scenario?
		var totalPaymentThisLoan = Number(newLoan.monthlyAmounts[0].principlePayment) + Number(newLoan.monthlyAmounts[0].interestPayment);
		if ( totalPaymentThisLoan < 50 ) {
			totalPaymentThisLoan = 50;
		}
		future.information.totalMonthlyPaymentBeginning += totalPaymentThisLoan;
		console.log("future.extraPayments is " + future.extraPayments);
		future.extraPayments[0] = scenario.extraMonthlyPaymentAmount;
	}
	console.log("Initialized loans. future is " + JSON.stringify(future, null, 2));
	
	//Deferment
	var defermentMonthsRemainingCountdown = 0;
	if( scenario.defermentBool === 'true' ) {
		defermentMonthsRemainingCountdown = (scenario.defermentMonth - todaysMonth) + ((scenario.defermentYear - todaysYear) * 12 ); 
	}
	console.log("Number of months from today that we are in deferment is " + defermentMonthsRemainingCountdown);
	
	//IMPORTANT: Iterate through each month and calculate everything
	var allPaidOff = false;
	var monthNum = 0;
	while(!allPaidOff) {
		monthNum += 1;
		allPaidOff = true;
		console.log("Beginning computations for month " + monthNum);
		
		var moneyRemainingThisMonth = future.information.totalMonthlyPaymentBeginning; //TODO: Allow for varying payments over time
		var worstLoanIndex = getWorstLoanIndex(future.loans, scenario);
		
		// Go through each loan and update it for this month
		for(var j=0; j<future.loans.length; j++) {
			var currentMonthLoanInfo = future.loans[j].monthlyAmounts[future.loans[j].monthlyAmounts.length-1];
			var nextMonthLoanInfo = {"principleRemaining": 0, "principlePayment": 0, "interestPayment": 0};
			future.loans[j].monthlyAmounts.push(nextMonthLoanInfo);
			
			// Already paid off this loan
			if( currentMonthLoanInfo.principleRemaining === 0) {
				continue;
			}
			
			// Deferment
			if( defermentMonthsRemainingCountdown > 0 ) {
				console.log("Number of months remaining in deferment is " + defermentMonthsRemainingCountdown);
				//nextMonthLoanInfo.principleRemaining = Number(currentMonthLoanInfo.principleRemaining) + Number(currentMonthLoanInfo.interestPayment); //TODO: Capitalization event. Interest is stored separately, then added in a capitalization event.
				nextMonthLoanInfo.principleRemaining = currentMonthLoanInfo.principleRemaining; //See previous todo about capitalization. This assumes a subsidized loan. 
				defermentMonthsRemainingCountdown -= 1;
				console.log("Month " + monthNum + " is in deferment. current principle is " + currentMonthLoanInfo.principleRemaining);
			}
			
			// $50 minimum
			else if ( (currentMonthLoanInfo.principlePayment + currentMonthLoanInfo.interestPayment) < 50 ) {
				currentMonthLoanInfo.principlePayment = 50 - currentMonthLoanInfo.interestPayment;
				if( currentMonthLoanInfo.principlePayment > currentMonthLoanInfo.principleRemaining ) {
					currentMonthLoanInfo.principlePayment = currentMonthLoanInfo.principleRemaining;
				}
				
				// generate the next month's info
				nextMonthLoanInfo.principleRemaining = currentMonthLoanInfo.principleRemaining - currentMonthLoanInfo.principlePayment;
				
				console.log("The expected payment was less than the $50 minimum payment. Bumped the payment up to $50. Next month's principle remaining is " + nextMonthLoanInfo.principleRemaining);
			}
			
			// Pay the minimums here
			else if( (currentMonthLoanInfo.principleRemaining > currentMonthLoanInfo.principlePayment) && (defermentMonthsRemainingCountdown <= 0) ) {
				nextMonthLoanInfo.principleRemaining = currentMonthLoanInfo.principleRemaining - currentMonthLoanInfo.principlePayment;
				console.log("Paid the minimum. The principle remaining now is " + nextMonthLoanInfo.principleRemaining + " We did pay down the principle by " + currentMonthLoanInfo.principlePayment);
			} 
			
			// correct rounding errors
			if( nextMonthLoanInfo.principleRemaining > 0.0 && nextMonthLoanInfo.principleRemaining < 0.009) {
				console.log("We have a rounding error. This loan has nothing remaining.");
				nextMonthLoanInfo.principleRemaining = 0;
				nextMonthLoanInfo.principlePayment = 0;
				nextMonthLoanInfo.interestPayment = 0;
			}
			
			// Not finished paying off loans, reset bool
			if(nextMonthLoanInfo.principleRemaining > 0) {
				allPaidOff = false;
			}
			
			// How much do we still have left over?
			console.log("money remaining inside the for loop, before subtraction is " + moneyRemainingThisMonth + " We are iterating loan j=" + j);
			moneyRemainingThisMonth -= currentMonthLoanInfo.principlePayment;
			moneyRemainingThisMonth -= currentMonthLoanInfo.interestPayment;
			if ( moneyRemainingThisMonth < 1 ) { moneyRemainingThisMonth = 0; } //float rounding errors
			console.log("money remaining inside the for loop, after subtraction is " + moneyRemainingThisMonth);
			
			// How much do we owe next month?
			//console.log("arg 2 is " + (future.information.totalMonthsInPaymentPlan-monthNum));
			nextMonthLoanInfo.principlePayment = getLoanPrincipleMinimumPayment(nextMonthLoanInfo.principleRemaining, future.information.totalMonthsInPaymentPlan-monthNum, scenario.plan, future.loans[j].rate); //monthNum off by 1?
			nextMonthLoanInfo.interestPayment = getLoanInterestMinimumPayment(nextMonthLoanInfo.principleRemaining, future.information.totalMonthsInPaymentPlan-monthNum, scenario.plan, future.loans[j].rate); //monthNum off by 1?
			console.log("pushing next month loan " + JSON.stringify(nextMonthLoanInfo, null, 2) + "\n to future.loans.monthlyAmounts " + JSON.stringify(future.loans[j].monthlyAmounts, null, 2));
			
			//how much extra money do we have?
			
		}
		
		/*//find out how much we have paid so far. Spend the left over money on the worst loan.
		var sumPaymentsCurrentMonth = 0;
		for(var j=0; j<future.loans.length; j++) {
			var currentMonthLoanInfo = future.loans[j].monthlyAmounts[future.loans[j].monthlyAmounts.length-1];
			//var nextMonthLoanInfo = future.loans[j].monthlyAmounts[future.loans[j].monthlyAmounts.length];
			
			console.log("why is this not working. currentMonthLoanInfo.principlePayment=" + currentMonthLoanInfo.principlePayment + " and currentMonthLoanInfo.interestPayment=" + currentMonthLoanInfo.interestPayment);
			sumPaymentsCurrentMonth += currentMonthLoanInfo.principlePayment + currentMonthLoanInfo.interestPayment;
		}
		console.log("So far this month, we have paid " + sumPaymentsCurrentMonth + " and each month we should be paying " + future.information.totalMonthlyPaymentBeginning);
		if(sumPaymentsCurrentMonth < future.information.totalMonthlyPaymentBeginning && (future.loans.length > 0) && (defermentMonthsRemainingCountdown <= 0) ) { //TODO: This is not the correct way to handle deferment. What if someone wants to pay while in deferment?
			var extraPayment = future.information.totalMonthlyPaymentBeginning - sumPaymentsCurrentMonth;
			console.log("We have " + extraPayment + " still available to spend");
			
			var worstLoanIndex = getWorstLoanIndex(future.loans, scenario);
			console.log("future.loans is " + JSON.stringify(future.loans, null, 2));
			console.log("future.loans[" + worstLoanIndex + "] is " + JSON.stringify(future.loans[worstLoanIndex], null, 2));
			var worstLoan = future.loans[worstLoanIndex].monthlyAmounts[future.loans[worstLoanIndex].monthlyAmounts.length-1];
			var previousPrincipleRemaining = worstLoan.principleRemaining;
			var previousPrinciplePayment = worstLoan.principlePayment;
			var extraPayment = 0;
			if ( (worstLoan.principleRemaining > 0) && (worstLoan.principleRemaining < moneyRemainingThisMonth) ) {
				extraPayment = previousPrinciplePayment + worstLoan.principleRemaining;
				console.log("worst first");
			}
			else if(worstLoan.principleRemaining > 0) {
				extraPayment = moneyRemainingThisMonth;
				console.log("worst second");
			}
			console.log("Extra payment is " + extraPayment);
			worstLoan.principleRemaining -= extraPayment;
			worstLoan.principlePayment += extraPayment;
			moneyRemainingThisMonth = previousPrincipleRemaining - extraPayment;
			console.log("The worst loan is loan# " + worstLoanIndex + " We paid all the remaining money of $" + extraPayment + " to the loan. The principle remaining went from " + previousPrincipleRemaining + " to " + worstLoan.principleRemaining);
			console.log("The priciple payment went from " + previousPrinciplePayment + " to " + worstLoan.principlePayment);
		}*/
		
		/*//apply leftover money to the worst loan.
		console.log("leftover money at the beginning of worst loan payment is " + moneyRemainingThisMonth);
		if( (moneyRemainingThisMonth > 0) && (future.loans.length > 0)) {
			var worstLoanIndex = getWorstLoanIndex(future.loans, scenario);
			var worstLoanNextMonth = future.loans[worstLoanIndex].monthlyAmounts[future.loans[worstLoanIndex].monthlyAmounts.length-1];
			var previousPrincipleRemaining = worstLoanNextMonth.principleRemaining;
			var previousPrinciplePayment = worstLoanNextMonth.principlePayment;
			var extraPayment = 0;
			if ( (worstLoanNextMonth.principleRemaining > 0) && (worstLoanNextMonth.principleRemaining < moneyRemainingThisMonth) ) {
				extraPayment = previousPrinciplePayment + worstLoanNextMonth.principleRemaining;
				console.log("worst first");
			}
			else if(worstLoanNextMonth.principleRemaining > 0) {
				extraPayment = moneyRemainingThisMonth;
				console.log("worst second");
			}
			worstLoanNextMonth.principleRemaining -= extraPayment;
			worstLoanNextMonth.principlePayment += extraPayment;
			moneyRemainingThisMonth = previousPrincipleRemaining - extraPayment;
			console.log("The worst loan is loan# " + worstLoanIndex + " We paid all the remaining money of $" + extraPayment + " to the loan. The principle remaining went from " + previousPrincipleRemaining + " to " + worstLoanNextMonth.principleRemaining);
			console.log("The priciple payment went from " + previousPrinciplePayment + " to " + worstLoanNextMonth.principlePayment);
		}
		//error checking. leftover=$0
		console.log("leftover money this month is " + moneyRemainingThisMonth + " (should be $0)");
		if(moneyRemainingThisMonth < 0) {console.log("ERROR!! We are left with a negative amount of money this month!");}*/
		
		console.log("Intermediate future after month " + monthNum + " is " + JSON.stringify(future, null, 2));
	}

	console.log("Complete future is " + JSON.stringify(future, null, 2));
	
	displayFuture(future);
}