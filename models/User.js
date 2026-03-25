const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, required: true },
  amount: { type: Number, required: true },
  from: String,
  to: String,
  reference: String,
  bbcCodes: [String],
  status: { type: String, default: 'Completed' },
  date: { type: Date, default: Date.now }
});

const cardSchema = new mongoose.Schema({
  id: String,
  type: String,
  last4: String,
  cvv: String,
  expiry: String,
  limit: Number,
  active: { type: Boolean, default: true },
  purchasedAt: Date
});

const goalSchema = new mongoose.Schema({
  id: String,
  name: String,
  target: Number,
  saved: { type: Number, default: 0 },
  deadline: Date,
  createdAt: { type: Date, default: Date.now }
});

const achievementSchema = new mongoose.Schema({
  id: String,
  name: String,
  icon: String,
  description: String,
  earnedAt: Date
});

const investmentSchema = new mongoose.Schema({
  id: String,
  type: String,
  name: String,
  amount: Number,
  value: Number,
  purchasedAt: Date
});

const loanSchema = new mongoose.Schema({
  id: String,
  type: String,
  amount: Number,
  interestRate: Number,
  term: Number,
  remaining: Number,
  status: { type: String, default: 'Pending' },
  appliedAt: Date
});

const grantSchema = new mongoose.Schema({
  id: String,
  type: String,
  amount: Number,
  purpose: String,
  status: { type: String, default: 'Pending' },
  appliedAt: Date
});

const billPaymentSchema = new mongoose.Schema({
  id: String,
  type: String,
  amount: Number,
  provider: String,
  accountNumber: String,
  date: Date
});

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  country: { type: String, required: true },
  currency: { type: String, default: 'USD' },
  accountType: { type: String, default: 'Standard' },
  transactionPin: { type: String, required: true },
  accountNumber: { type: String, required: true, unique: true },
  balance: { type: Number, default: 0 },
  balanceHidden: { type: Boolean, default: false },
  theme: { type: String, default: 'light' },
  notifications: { type: Boolean, default: true },
  twoFactorEnabled: { type: Boolean, default: false },
  cards: [cardSchema],
  transactions: [transactionSchema],
  goals: [goalSchema],
  achievements: [achievementSchema],
  investments: [investmentSchema],
  loans: [loanSchema],
  grants: [grantSchema],
  billPayments: [billPaymentSchema],
  isVerified: { type: Boolean, default: true },
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
