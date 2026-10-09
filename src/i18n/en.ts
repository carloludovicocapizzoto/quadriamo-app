// Dizionario di riferimento: le altre lingue devono avere esattamente le stesse chiavi (lo controlla TypeScript).
const en = {
  'app.tagline': 'Your money, in four.',
  'app.rule': 'Suggested split: 55% Essentials · 20% Quality of Life · 15% Safety Fund · 10% Investments. Your rule, your call.',
  'lang.label': 'Language',
  'month.title': 'This month',
  'month.income': 'Income',
  'month.spent': 'Spent',
  'month.saved': 'Saved & invested',
  'month.leftOver': 'Left over',
  'bucket.available': 'Available',
  'bucket.remaining': 'Remaining',
  'bucket.spent': 'Spent',
  'checks.allGood': 'All good',
  'checks.fix': 'Some rows need fixing',
  'demo.note': 'Preview with sample data. Logging, settings and sync arrive in the next steps.',
  'install.hint': 'Install it: in your browser menu choose “Add to Home Screen” or “Install app”.',
  'offline.ready': 'Ready to work offline.',

  'b.essentials': 'Essentials',
  'b.qualityOfLife': 'Quality of Life',
  'b.safetyFund': 'Safety Fund',
  'b.investments': 'Investments',

  'c.salary': 'Salary',
  'c.extraIncome': 'Extra income',
  'c.fixedCosts': 'Fixed costs',
  'c.groceries': 'Groceries',
  'c.transport': 'Transport',
  'c.health': 'Health',
  'c.eatingOut': 'Eating out',
  'c.funShopping': 'Fun & shopping',
  'c.gifts': 'Gifts',
  'c.other': 'Other',
  'c.safetyFundSaving': 'Safety fund',
  'c.investmentsSaving': 'Investments',

  'm.1': 'January', 'm.2': 'February', 'm.3': 'March', 'm.4': 'April', 'm.5': 'May', 'm.6': 'June',
  'm.7': 'July', 'm.8': 'August', 'm.9': 'September', 'm.10': 'October', 'm.11': 'November', 'm.12': 'December',
}

export type Dict = Record<keyof typeof en, string>
export default en as Dict
