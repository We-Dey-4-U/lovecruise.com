const db = require('../config/db');
const OpayService = require('../services/opayService');
const StripeService = require('../services/stripeService');
const FlutterwaveService = require('../services/flutterwaveService');
const PaypalService = require('../services/paypalService');
const WalletService = require('../services/walletService');
const CashappService = require('../services/cashappService');
const IpayService = require('../services/ipayService');
const CryptoService = require('../services/cryptoService');

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

/* ================= OPAY ================= */

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
    const isValid = OpayService.verifyWebhookSignature(req.body);

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

/* ================= STRIPE ================= */

exports.initiateStripe = async (req, res, next) => {
  try {
    const { coinPackageId } = req.body;
    if (!coinPackageId) {
      return res.status(400).json({ success: false, message: 'coinPackageId is required' });
    }

    const result = await StripeService.initiatePurchase({
      userId: req.user.id,
      coinPackageId,
      userEmail: req.user.email,
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// NOTE: this route MUST receive the raw (unparsed) request body —
// see the express.raw() middleware in payments.routes.js and the
// app.js body-parser exception.
exports.stripeWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['stripe-signature'];
    const event = StripeService.verifyAndConstructEvent(req.body, signature);

    if (!event) {
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }

    const result = await StripeService.handleWebhookEvent(event);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

exports.checkStripeStatus = async (req, res, next) => {
  try {
    const tx = await StripeService.getStatus(req.user.id, req.params.reference);

    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    res.json({ success: true, data: tx });
  } catch (err) {
    next(err);
  }
};

/* ================= FLUTTERWAVE ================= */

exports.initiateFlutterwave = async (req, res, next) => {
  try {
    const { coinPackageId } = req.body;
    if (!coinPackageId) {
      return res.status(400).json({ success: false, message: 'coinPackageId is required' });
    }

    const result = await FlutterwaveService.initiatePurchase({
      userId: req.user.id,
      coinPackageId,
      userEmail: req.user.email,
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

exports.flutterwaveWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['verif-hash'];
    const isValid = FlutterwaveService.verifyWebhookSignature(signature);

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }

    const result = await FlutterwaveService.handleWebhook(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

exports.checkFlutterwaveStatus = async (req, res, next) => {
  try {
    const tx = await FlutterwaveService.getStatus(req.user.id, req.params.reference);

    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    res.json({ success: true, data: tx });
  } catch (err) {
    next(err);
  }
};

/* ================= CASH APP PAY ================= */

// NOTE: unlike every other initiate*, this expects a `sourceToken`
// from Square's Web Payments SDK, not just a coinPackageId — the
// charge happens synchronously, no checkoutUrl redirect.
exports.initiateCashapp = async (req, res, next) => {
  try {
    const { coinPackageId, sourceToken } = req.body;
    if (!coinPackageId) {
      return res.status(400).json({ success: false, message: 'coinPackageId is required' });
    }
    if (!sourceToken) {
      return res.status(400).json({ success: false, message: 'sourceToken is required' });
    }

    const result = await CashappService.initiatePurchase({
      userId: req.user.id,
      coinPackageId,
      sourceToken,
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// IMPORTANT: needs the raw body — see routes file note, same pattern
// as Stripe's webhook.
exports.cashappWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-square-hmacsha256-signature'];
    const notificationUrl = `${process.env.SQUARE_WEBHOOK_NOTIFICATION_URL}`;
    const rawBody = req.body; // Buffer, when mounted with express.raw()

    const isValid = CashappService.verifyWebhookSignature(rawBody.toString('utf8'), signature, notificationUrl);

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }

    const parsedBody = JSON.parse(rawBody.toString('utf8'));
    const result = await CashappService.handleWebhook(parsedBody);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

exports.checkCashappStatus = async (req, res, next) => {
  try {
    const tx = await CashappService.getStatus(req.user.id, req.params.reference);

    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    res.json({ success: true, data: tx });
  } catch (err) {
    next(err);
  }
};

/* ================= IPAY ================= */

exports.initiateIpay = async (req, res, next) => {
  try {
    const { coinPackageId } = req.body;
    if (!coinPackageId) {
      return res.status(400).json({ success: false, message: 'coinPackageId is required' });
    }

    const result = await IpayService.initiatePurchase({
      userId: req.user.id,
      coinPackageId,
      userEmail: req.user.email,
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// iPay calls this as a form-encoded POST callback — already covered
// by app.js's global express.urlencoded() parser, no raw-body needed.
exports.ipayCallback = async (req, res, next) => {
  try {
    const isValid = IpayService.verifyCallbackSignature(req.body);

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid callback signature' });
    }

    const result = await IpayService.handleCallback(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

exports.checkIpayStatus = async (req, res, next) => {
  try {
    const tx = await IpayService.getStatus(req.user.id, req.params.reference);

    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    res.json({ success: true, data: tx });
  } catch (err) {
    next(err);
  }
};

/* ================= CRYPTO (NOWPayments) ================= */

exports.initiateCrypto = async (req, res, next) => {
  try {
    const { coinPackageId, payCurrency } = req.body;
    if (!coinPackageId) {
      return res.status(400).json({ success: false, message: 'coinPackageId is required' });
    }
    if (!payCurrency) {
      return res.status(400).json({ success: false, message: 'payCurrency is required (btc, eth, bnb, matic, usdt, usdc)' });
    }

    const result = await CryptoService.initiatePurchase({
      userId: req.user.id,
      coinPackageId,
      payCurrency,
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// This IS the auto-credit trigger for crypto — same role webhooks
// play for every other provider. NOWPayments only fires this once
// the on-chain transaction is confirmed (payment_status === 'finished'),
// so coins are credited automatically, no manual capture step.
exports.cryptoWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-nowpayments-sig'];
    const isValid = CryptoService.verifyWebhookSignature(req.body, signature);

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }

    const result = await CryptoService.handleWebhook(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

exports.checkCryptoStatus = async (req, res, next) => {
  try {
    const tx = await CryptoService.getStatus(req.user.id, req.params.reference);

    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    res.json({ success: true, data: tx });
  } catch (err) {
    next(err);
  }
};

/* ================= PAYPAL ================= */

exports.initiatePaypal = async (req, res, next) => {
  try {
    const { coinPackageId } = req.body;
    if (!coinPackageId) {
      return res.status(400).json({ success: false, message: 'coinPackageId is required' });
    }

    const result = await PaypalService.initiatePurchase({
      userId: req.user.id,
      coinPackageId,
      userEmail: req.user.email,
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// Called from the PAYPAL_RETURN_URL page once the user approves —
// this is the PRIMARY trigger for crediting coins, not the webhook.
exports.capturePaypal = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    const result = await PaypalService.capturePurchase({
      userId: req.user.id,
      orderId,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// Defense-in-depth only — does not credit coins itself beyond what
// capturePurchase already does; safe to call again if PayPal retries.
exports.paypalWebhook = async (req, res, next) => {
  try {
    const isValid = await PaypalService.verifyWebhookSignature(req.body, req.headers);

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.checkPaypalStatus = async (req, res, next) => {
  try {
    const tx = await PaypalService.getStatus(req.user.id, req.params.reference);

    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    res.json({ success: true, data: tx });
  } catch (err) {
    next(err);
  }
};

/* ================= WALLET / WITHDRAWALS (unchanged) ================= */

exports.ledger = async (req, res, next) => {
  try {
    const data = await WalletService.getLedger(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};


exports.getCryptoCurrencies = async (req, res, next) => {
  try {
    const data = CryptoService.getSupportedCurrencies();
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