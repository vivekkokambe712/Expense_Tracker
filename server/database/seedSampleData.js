import db from './db.js';
import { createTransaction } from '../services/transactionService.js';

export function seedSampleData() {
  const count = db.prepare('SELECT COUNT(*) as count FROM transactions').get().count;
  if (count > 0) return; // already has transactions

  const categories = db.prepare('SELECT * FROM categories').all();
  const subcategories = db.prepare('SELECT * FROM subcategories').all();
  const paymentMethods = db.prepare('SELECT * FROM payment_methods').all();

  const bizExp = categories.find(c => c.name === 'Business Expense')?.id;
  const homeExp = categories.find(c => c.name === 'Home Expense')?.id;
  const bizInc = categories.find(c => c.name === 'Business Income')?.id;

  const rawMatSub = subcategories.find(s => s.name === 'Raw Material' && s.category_id === bizExp)?.id;
  const bizElecSub = subcategories.find(s => s.name === 'Electricity Bill' && s.category_id === bizExp)?.id;
  const bizWifiSub = subcategories.find(s => s.name === 'WiFi / Internet' && s.category_id === bizExp)?.id;
  const maintSub = subcategories.find(s => s.name === 'Maintenance' && s.category_id === bizExp)?.id;
  const packSub = subcategories.find(s => s.name === 'Packaging' && s.category_id === bizExp)?.id;

  const grocerySub = subcategories.find(s => s.name === 'Grocery' && s.category_id === homeExp)?.id;
  const gasSub = subcategories.find(s => s.name === 'Gas Bill' && s.category_id === homeExp)?.id;
  const homeElecSub = subcategories.find(s => s.name === 'Electricity Bill' && s.category_id === homeExp)?.id;
  const travelSub = subcategories.find(s => s.name === 'Travel' && s.category_id === homeExp)?.id;

  const printSub = subcategories.find(s => s.name === 'Printing Orders' && s.category_id === bizInc)?.id;
  const cardSub = subcategories.find(s => s.name === 'Visiting Cards' && s.category_id === bizInc)?.id;
  const pamphSub = subcategories.find(s => s.name === 'Pamphlets' && s.category_id === bizInc)?.id;

  const cash = paymentMethods.find(m => m.name === 'Cash')?.id;
  const upi = paymentMethods.find(m => m.name === 'UPI')?.id;
  const bank = paymentMethods.find(m => m.name === 'Bank Transfer')?.id;

  // Sample transactions
  const samples = [
    // Business Income
    { type: 'Income', category_id: bizInc, subcategory_id: printSub, item_name: 'Printing Order 100 Log Books', amount: 25000, transaction_date: '2026-09-24', payment_method_id: bank, vendor_or_customer: 'ABC Company', notes: 'Delivered and invoiced', tags: '#business, #bulk' },
    { type: 'Income', category_id: bizInc, subcategory_id: cardSub, item_name: 'Visiting Cards 1000 Matte Finish', amount: 1800, transaction_date: '2026-09-23', payment_method_id: upi, vendor_or_customer: 'Apex Logistics', notes: '350gsm cardstock', tags: '#cards' },
    { type: 'Income', category_id: bizInc, subcategory_id: pamphSub, item_name: 'Pamphlets 5000 Colour Glossy', amount: 6500, transaction_date: '2026-09-20', payment_method_id: cash, vendor_or_customer: 'Metro Coaching Institute', notes: 'Full advance paid' },
    { type: 'Income', category_id: bizInc, subcategory_id: printSub, item_name: 'Custom Product Catalogues', amount: 14500, transaction_date: '2026-09-15', payment_method_id: bank, vendor_or_customer: 'Sunrise Motors', tags: '#urgent' },

    // Business Expenses
    { type: 'Expense', category_id: bizExp, subcategory_id: rawMatSub, item_name: 'Paper A4 75 GSM (10 Reams)', amount: 3400, transaction_date: '2026-09-24', payment_method_id: upi, vendor_or_customer: 'Sri Balaji Paper Mart', tags: '#stock' },
    { type: 'Expense', category_id: bizExp, subcategory_id: rawMatSub, item_name: 'Printing Ink Cartridges Cyan & Black', amount: 4200, transaction_date: '2026-09-21', payment_method_id: upi, vendor_or_customer: 'Canon Dealer', notes: 'Genuine cartridges' },
    { type: 'Expense', category_id: bizExp, subcategory_id: bizElecSub, item_name: 'Press Electricity Bill', amount: 4500, transaction_date: '2026-09-18', payment_method_id: bank, notes: 'Meter reading paid' },
    { type: 'Expense', category_id: bizExp, subcategory_id: bizWifiSub, item_name: 'Office Highspeed WiFi', amount: 1200, transaction_date: '2026-09-10', payment_method_id: upi, notes: 'Airtel Broadband ~90 days' },
    { type: 'Expense', category_id: bizExp, subcategory_id: bizWifiSub, item_name: 'Office Highspeed WiFi', amount: 1200, transaction_date: '2026-06-12', payment_method_id: upi, notes: 'Airtel Broadband' },
    { type: 'Expense', category_id: bizExp, subcategory_id: maintSub, item_name: 'Machine Roller Servicing', amount: 1500, transaction_date: '2026-09-12', payment_method_id: cash, notes: 'Quarterly maintenance' },
    { type: 'Expense', category_id: bizExp, subcategory_id: packSub, item_name: 'Packaging Boxes & Corrugated Rolls', amount: 850, transaction_date: '2026-09-08', payment_method_id: cash },

    // Home Expenses
    { type: 'Expense', category_id: homeExp, subcategory_id: grocerySub, item_name: 'Chicken', amount: 350, transaction_date: '2026-09-24', payment_method_id: cash, notes: '1kg fresh' },
    { type: 'Expense', category_id: homeExp, subcategory_id: grocerySub, item_name: 'Milk', amount: 60, transaction_date: '2026-09-24', payment_method_id: upi },
    { type: 'Expense', category_id: homeExp, subcategory_id: grocerySub, item_name: 'Milk', amount: 60, transaction_date: '2026-09-23', payment_method_id: upi },
    { type: 'Expense', category_id: homeExp, subcategory_id: grocerySub, item_name: 'Milk', amount: 60, transaction_date: '2026-09-22', payment_method_id: upi },
    { type: 'Expense', category_id: homeExp, subcategory_id: grocerySub, item_name: 'Rice Basmati (10kg)', amount: 1200, transaction_date: '2026-09-19', payment_method_id: upi },
    { type: 'Expense', category_id: homeExp, subcategory_id: grocerySub, item_name: 'Vegetables & Fruits', amount: 480, transaction_date: '2026-09-21', payment_method_id: cash },
    { type: 'Expense', category_id: homeExp, subcategory_id: gasSub, item_name: 'HP Cooking Gas Cylinder', amount: 950, transaction_date: '2026-09-14', payment_method_id: upi },
    { type: 'Expense', category_id: homeExp, subcategory_id: homeElecSub, item_name: 'Home Electricity Bill', amount: 2450, transaction_date: '2026-09-11', payment_method_id: bank },
    { type: 'Expense', category_id: homeExp, subcategory_id: travelSub, item_name: 'Petrol for Bike', amount: 500, transaction_date: '2026-09-22', payment_method_id: upi }
  ];

  for (const s of samples) {
    createTransaction(s);
  }
}
