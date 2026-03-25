const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

const User = require('../models/User');

// Email Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Generate Account Number
function generateAccountNumber() {
  return 'PHT-' + Math.floor(1000 + Math.random() * 9000) + '-' + 
         Math.floor(1000 + Math.random() * 9000);
}

// Generate 6-digit verification code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send Verification Email
async function sendVerificationEmail(email, code, name) {
  const mailOptions = {
    from: `"Prime Heritage Trust" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '🔐 Verify Your Prime Heritage Trust Account',
    html: `
      <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0A2540, #1F4A6E); padding: 40px 30px; text-align: center; border-radius: 24px 24px 0 0;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 20px;">
            <div style="width: 50px; height: 50px; background: #F5A623; border-radius: 16px; display: flex; align-items: center; justify-content: center;">
              <i style="font-size: 28px; color: #0A2540;">🏦</i>
            </div>
            <h1 style="color: white; margin: 0;">PRIME HERITAGE</h1>
          </div>
          <p style="color: rgba(255,255,255,0.8); margin: 0;">TRUST BANK</p>
        </div>
        <div style="background: white; padding: 40px 30px; border-radius: 0 0 24px 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
          <h2 style="color: #0A2540; margin-bottom: 16px;">Welcome, ${name}! 👋</h2>
          <p style="color: #4A5568; font-size: 16px; line-height: 1.6;">Thank you for choosing Prime Heritage Trust Bank. Please verify your email address to complete your registration.</p>
          <div style="background: #F5F7FA; padding: 24px; text-align: center; border-radius: 16px; margin: 30px 0;">
            <p style="color: #718096; margin-bottom: 12px; font-size: 14px;">Your verification code is:</p>
            <h1 style="color: #F5A623; font-size: 48px; letter-spacing: 12px; margin: 10px 0;">${code}</h1>
            <p style="color: #718096; font-size: 12px;">This code expires in 10 minutes</p>
          </div>
          <p style="color: #4A5568; font-size: 14px;">If you didn't request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;">
          <p style="color: #A0AEC0; font-size: 12px; text-align: center;">© 2025 Prime Heritage Trust Bank. All rights reserved.</p>
        </div>
      </div>
    `
  };
  await transporter.sendMail(mailOptions);
}

// Send Transaction Receipt Email
async function sendReceiptEmail(email, receiptData) {
  const mailOptions = {
    from: `"Prime Heritage Trust" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '📄 Transaction Receipt - Prime Heritage Trust',
    html: `
      <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0A2540, #1F4A6E); padding: 30px; text-align: center; border-radius: 24px 24px 0 0;">
          <h2 style="color: #F5A623; margin: 0;">PRIME HERITAGE</h2>
          <p style="color: white;">TRUST BANK</p>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 24px 24px;">
          <h2 style="color: #0A2540;">Transaction Receipt</h2>
          <div style="background: #F5F7FA; padding: 20px; border-radius: 16px; margin: 20px 0;">
            <p><strong>Transaction ID:</strong> ${receiptData.id}</p>
            <p><strong>Type:</strong> ${receiptData.type}</p>
            <p><strong>Amount:</strong> ${receiptData.currency}${receiptData.amount.toLocaleString()}</p>
            <p><strong>From:</strong> ${receiptData.from}</p>
            <p><strong>To:</strong> ${receiptData.to}</p>
            <p><strong>Reference:</strong> ${receiptData.reference || '—'}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Status:</strong> ✅ Completed</p>
          </div>
          <p style="color: #4A5568;">Thank you for banking with us!</p>
        </div>
      </div>
    `
  };
  await transporter.sendMail(mailOptions);
}

// Middleware to verify token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ==================== API ENDPOINTS ====================

// Register User (Send verification code)
app.post('/api/register', async (req, res) => {
  try {
    const { fullName, email, phone, country, currency, accountType, transactionPin } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    const verificationCode = generateVerificationCode();
    
    // Store temp data (in production use Redis or session)
    global.tempUser = {
      fullName, email, phone, country, currency, accountType, transactionPin,
      verificationCode, verificationExpires: Date.now() + 600000
    };
    
    await sendVerificationEmail(email, verificationCode, fullName);
    
    res.json({ success: true, message: 'Verification code sent to email' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify Email and Create User
app.post('/api/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    const tempData = global.tempUser;
    
    if (!tempData || tempData.email !== email) {
      return res.status(400).json({ error: 'Invalid verification session' });
    }
    
    if (tempData.verificationCode !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    
    if (Date.now() > tempData.verificationExpires) {
      return res.status(400).json({ error: 'Verification code expired' });
    }
    
    const hashedPin = await bcrypt.hash(tempData.transactionPin, 10);
    const accountNumber = generateAccountNumber();
    
    const newUser = new User({
      fullName: tempData.fullName,
      email: tempData.email,
      phone: tempData.phone,
      country: tempData.country,
      currency: tempData.currency,
      accountType: tempData.accountType,
      transactionPin: hashedPin,
      accountNumber: accountNumber,
      balance: 0,
      achievements: [{
        id: Date.now().toString(),
        name: 'Welcome to Prime Heritage',
        icon: 'fa-crown',
        description: 'Created your account',
        earnedAt: new Date()
      }]
    });
    
    await newUser.save();
    
    const token = jwt.sign({ id: newUser._id, email: newUser.email }, process.env.JWT_SECRET);
    
    delete global.tempUser;
    
    res.json({ 
      success: true, 
      token, 
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        accountNumber: newUser.accountNumber,
        balance: newUser.balance,
        currency: newUser.currency,
        accountType: newUser.accountType,
        isAdmin: newUser.isAdmin
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, pin } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValidPin = await bcrypt.compare(pin, user.transactionPin);
    if (!isValidPin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET);
    
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        accountNumber: user.accountNumber,
        balance: user.balance,
        balanceHidden: user.balanceHidden,
        currency: user.currency,
        accountType: user.accountType,
        theme: user.theme,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get User Data
app.get('/api/user/:id', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      country: user.country,
      currency: user.currency,
      accountType: user.accountType,
      accountNumber: user.accountNumber,
      balance: user.balance,
      balanceHidden: user.balanceHidden,
      theme: user.theme,
      notifications: user.notifications,
      twoFactorEnabled: user.twoFactorEnabled,
      cards: user.cards,
      transactions: user.transactions.slice(0, 10),
      goals: user.goals,
      achievements: user.achievements,
      investments: user.investments,
      loans: user.loans,
      grants: user.grants,
      billPayments: user.billPayments,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update Balance Visibility
app.put('/api/user/:id/toggle-balance', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.balanceHidden = !user.balanceHidden;
    await user.save();
    
    res.json({ success: true, balanceHidden: user.balanceHidden });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update Theme
app.put('/api/user/:id/theme', verifyToken, async (req, res) => {
  try {
    const { theme } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.theme = theme;
    await user.save();
    
    res.json({ success: true, theme: user.theme });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Change PIN
app.put('/api/user/:id/change-pin', verifyToken, async (req, res) => {
  try {
    const { currentPin, newPin } = req.body;
    const user = await User.findById(req.params.id);
    
    const isValid = await bcrypt.compare(currentPin, user.transactionPin);
    if (!isValid) {
      return res.status(401).json({ error: 'Current PIN is incorrect' });
    }
    
    user.transactionPin = await bcrypt.hash(newPin, 10);
    await user.save();
    
    res.json({ success: true, message: 'PIN changed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send Money
app.post('/api/user/:id/send', verifyToken, async (req, res) => {
  try {
    const { recipientEmail, amount, note, bbcCodes } = req.body;
    const sender = await User.findById(req.params.id);
    const recipient = await User.findOne({ email: recipientEmail });
    
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }
    
    if (sender.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // Deduct from sender
    sender.balance -= amount;
    sender.transactions.push({
      id: 'TXN-' + Date.now(),
      type: 'Transfer Sent',
      amount: -amount,
      to: recipient.fullName,
      reference: note,
      bbcCodes: bbcCodes,
      date: new Date()
    });
    
    // Add to recipient
    recipient.balance += amount;
    recipient.transactions.push({
      id: 'TXN-' + Date.now(),
      type: 'Transfer Received',
      amount: amount,
      from: sender.fullName,
      reference: note,
      bbcCodes: bbcCodes,
      date: new Date()
    });
    
    await sender.save();
    await recipient.save();
    
    // Send receipt email
    await sendReceiptEmail(sender.email, {
      id: 'TXN-' + Date.now(),
      type: 'Transfer Sent',
      amount: amount,
      currency: sender.currency === 'USD' ? '$' : (sender.currency === 'EUR' ? '€' : '£'),
      from: sender.fullName,
      to: recipient.fullName,
      reference: note
    });
    
    res.json({ 
      success: true, 
      newBalance: sender.balance,
      message: `Sent ${amount} to ${recipient.fullName}`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Purchase Virtual Card
app.post('/api/user/:id/purchase-card', verifyToken, async (req, res) => {
  try {
    const { cardType, price, bbcCodes } = req.body;
    const user = await User.findById(req.params.id);
    
    if (user.balance < price) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    const cardNumber = Math.floor(1000 + Math.random() * 9000).toString() +
                       Math.floor(1000 + Math.random() * 9000).toString() +
                       Math.floor(1000 + Math.random() * 9000).toString() +
                       Math.floor(1000 + Math.random() * 9000).toString();
    
    user.balance -= price;
    user.cards.push({
      id: 'CARD-' + Date.now(),
      type: cardType,
      last4: cardNumber.slice(-4),
      cvv: Math.floor(100 + Math.random() * 900),
      expiry: new Date(Date.now() + (cardType === 'Starter' ? 30 : cardType === 'Premium' ? 90 : 180) * 24 * 60 * 60 * 1000).toISOString().slice(2, 7),
      limit: cardType === 'Starter' ? 500 : (cardType === 'Premium' ? 2000 : 5000),
      purchasedAt: new Date()
    });
    
    user.transactions.push({
      id: 'TXN-' + Date.now(),
      type: 'Card Purchase',
      amount: -price,
      to: `${cardType} Virtual Card`,
      reference: `Purchased ${cardType} Card`,
      bbcCodes: bbcCodes,
      date: new Date()
    });
    
    // Check for achievement
    if (user.cards.length === 1) {
      user.achievements.push({
        id: Date.now().toString(),
        name: 'First Virtual Card',
        icon: 'fa-credit-card',
        description: 'Purchased your first virtual card',
        earnedAt: new Date()
      });
    }
    
    await user.save();
    
    res.json({ 
      success: true, 
      newBalance: user.balance,
      card: user.cards[user.cards.length - 1]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Pay Bill
app.post('/api/user/:id/pay-bill', verifyToken, async (req, res) => {
  try {
    const { billType, amount, provider, accountNumber, bbcCodes } = req.body;
    const user = await User.findById(req.params.id);
    
    if (user.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    user.balance -= amount;
    user.transactions.push({
      id: 'TXN-' + Date.now(),
      type: 'Bill Payment',
      amount: -amount,
      to: billType,
      reference: `${billType} - ${provider} (${accountNumber})`,
      bbcCodes: bbcCodes,
      date: new Date()
    });
    
    user.billPayments.push({
      id: 'BILL-' + Date.now(),
      type: billType,
      amount: amount,
      provider: provider,
      accountNumber: accountNumber,
      date: new Date()
    });
    
    await user.save();
    
    res.json({ 
      success: true, 
      newBalance: user.balance,
      message: `${billType} bill paid successfully`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Apply for Loan
app.post('/api/user/:id/apply-loan', verifyToken, async (req, res) => {
  try {
    const { loanType, amount, term } = req.body;
    const user = await User.findById(req.params.id);
    
    const interestRate = loanType === 'Personal' ? 9.9 : 
                         loanType === 'Mortgage' ? 4.5 : 
                         loanType === 'Business' ? 7.2 : 3.5;
    
    user.loans.push({
      id: 'LOAN-' + Date.now(),
      type: loanType,
      amount: amount,
      interestRate: interestRate,
      term: term,
      remaining: amount,
      appliedAt: new Date()
    });
    
    await user.save();
    
    res.json({ 
      success: true, 
      message: `${loanType} Loan application submitted for review`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Apply for Grant
app.post('/api/user/:id/apply-grant', verifyToken, async (req, res) => {
  try {
    const { grantType, amount, purpose } = req.body;
    const user = await User.findById(req.params.id);
    
    user.grants.push({
      id: 'GRANT-' + Date.now(),
      type: grantType,
      amount: amount,
      purpose: purpose,
      appliedAt: new Date()
    });
    
    await user.save();
    
    res.json({ 
      success: true, 
      message: `${grantType} Grant application submitted`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create Savings Goal
app.post('/api/user/:id/create-goal', verifyToken, async (req, res) => {
  try {
    const { name, target, deadline } = req.body;
    const user = await User.findById(req.params.id);
    
    user.goals.push({
      id: 'GOAL-' + Date.now(),
      name: name,
      target: target,
      saved: 0,
      deadline: new Date(deadline),
      createdAt: new Date()
    });
    
    await user.save();
    
    res.json({ success: true, goal: user.goals[user.goals.length - 1] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add to Savings Goal
app.post('/api/user/:id/add-to-goal', verifyToken, async (req, res) => {
  try {
    const { goalId, amount } = req.body;
    const user = await User.findById(req.params.id);
    
    if (user.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    const goal = user.goals.id(goalId);
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    
    user.balance -= amount;
    goal.saved += amount;
    
    user.transactions.push({
      id: 'TXN-' + Date.now(),
      type: 'Savings Contribution',
      amount: -amount,
      to: `Goal: ${goal.name}`,
      reference: `Added to ${goal.name}`,
      date: new Date()
    });
    
    // Check if goal completed
    if (goal.saved >= goal.target && !goal.completed) {
      goal.completed = true;
      user.achievements.push({
        id: Date.now().toString(),
        name: `Goal Achieved: ${goal.name}`,
        icon: 'fa-bullseye',
        description: `Reached your savings goal of ${goal.target}`,
        earnedAt: new Date()
      });
    }
    
    await user.save();
    
    res.json({ 
      success: true, 
      newBalance: user.balance,
      goal: goal
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Invest
app.post('/api/user/:id/invest', verifyToken, async (req, res) => {
  try {
    const { investmentType, amount, name } = req.body;
    const user = await User.findById(req.params.id);
    
    if (user.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    user.balance -= amount;
    user.investments.push({
      id: 'INV-' + Date.now(),
      type: investmentType,
      name: name,
      amount: amount,
      value: amount,
      purchasedAt: new Date()
    });
    
    user.transactions.push({
      id: 'TXN-' + Date.now(),
      type: 'Investment Purchase',
      amount: -amount,
      to: name,
      reference: `Invested in ${name}`,
      date: new Date()
    });
    
    await user.save();
    
    res.json({ 
      success: true, 
      newBalance: user.balance,
      message: `Invested ${amount} in ${name}`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== ADMIN ENDPOINTS ====================

// Get All Users (Admin only)
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find({}, '-transactionPin');
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin Send Money (No BBC required)
app.post('/api/admin/send-money', async (req, res) => {
  try {
    const { recipientEmail, amount, note } = req.body;
    const recipient = await User.findOne({ email: recipientEmail });
    
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }
    
    recipient.balance += amount;
    recipient.transactions.push({
      id: 'ADMIN-' + Date.now(),
      type: 'Bank Credit',
      amount: amount,
      from: 'Prime Heritage Bank',
      reference: note || 'Bank Credit',
      bbcCodes: ['ADMIN-0000-XX'],
      date: new Date()
    });
    
    await recipient.save();
    
    // Send email notification
    await sendReceiptEmail(recipient.email, {
      id: 'ADMIN-' + Date.now(),
      type: 'Bank Credit',
      amount: amount,
      currency: recipient.currency === 'USD' ? '$' : (recipient.currency === 'EUR' ? '€' : '£'),
      from: 'Prime Heritage Bank',
      to: recipient.fullName,
      reference: note
    });
    
    res.json({ 
      success: true, 
      message: `Sent ${amount} to ${recipient.fullName}`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin Stats
app.get('/api/admin/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalBalance = await User.aggregate([{ $group: { _id: null, total: { $sum: '$balance' } } }]);
    const totalCards = await User.aggregate([{ $project: { cardCount: { $size: '$cards' } } }, { $group: { _id: null, total: { $sum: '$cardCount' } } }]);
    
    res.json({
      totalUsers: totalUsers,
      totalBalance: totalBalance[0]?.total || 0,
      totalCards: totalCards[0]?.total || 0
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = app;
