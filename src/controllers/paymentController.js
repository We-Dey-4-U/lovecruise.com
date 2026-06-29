const db = require('../config/db');
const OpayService = require('../services/opayService');
const WalletService = require('../services/walletService');

exports.listPackages = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM coin_packages WHERE is_active = TRUE ORDER BY sort_order ASC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

exports.initiateOpay = async (req, res, next) => {
  try {
    const { coinPackageId } = req.body;
    if (!coinPackageId) {
      return res.status(400).json({ success: false, message: 'coinPackageId is required' });
    }

    const result = await OpayService.initiatePurchase({
      userId: req.user.id,
      coinPackageId,
      userEmail: req.user.email,
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

exports.opayWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-opay-signature'];
    const isValid = OpayService.verifyWebhookSignature(req.body, signature);

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }

    const result = await OpayService.handleWebhook(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

exports.checkStatus = async (req, res, next) => {
  try {
    const tx = await OpayService.getStatus(req.user.id, req.params.reference);

    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    res.json({ success: true, data: tx });
  } catch (err) {
    next(err);
  }
};

exports.ledger = async (req, res, next) => {
  try {
    const data = await WalletService.getLedger(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.requestWithdrawal = async (req, res, next) => {
  try {
    const { coins, bankAccountName, bankAccountNumber, bankName } = req.body;

    if (!coins || coins <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid coins' });
    }

    const { rows: userRows } = await db.query(
      'SELECT earnings_balance FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!userRows[0] || userRows[0].earnings_balance < coins) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    const COIN_TO_NAIRA_RATE = 4;
    const cashAmount = coins * COIN_TO_NAIRA_RATE;

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      await client.query(
        'UPDATE users SET earnings_balance = earnings_balance - $1 WHERE id = $2',
        [coins, req.user.id]
      );

      const { rows } = await client.query(
        `INSERT INTO withdrawal_requests
        (user_id, coins_requested, cash_amount, bank_account_name, bank_account_number, bank_name)
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING *`,
        [req.user.id, coins, cashAmount, bankAccountName, bankAccountNumber, bankName]
      );

      await client.query(
        `INSERT INTO wallet_ledger
        (user_id, type, amount, balance_after, reference_type, reference_id, description)
        VALUES ($1,'withdrawal',$2,
        (SELECT earnings_balance FROM users WHERE id = $1),
        'withdrawal_requests',$3,'Withdrawal requested')`,
        [req.user.id, -coins, rows[0].id]
      );

      await client.query('COMMIT');

      res.status(201).json({ success: true, data: rows[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};