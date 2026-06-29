const express = require("express");
const router = express.Router();

const {
  listPackages,
  initiateOpay,
  opayWebhook,
  checkStatus,
  ledger,
  requestWithdrawal
} = require("../controllers/paymentController");

const { requireAuth } = require("../middlewares/auth");

// ================= PACKAGES =================
router.get("/packages", requireAuth, listPackages);

// ================= OPay =================
router.post("/opay/initiate", requireAuth, initiateOpay);

router.post("/opay/webhook", opayWebhook);

router.get("/opay/status/:reference", requireAuth, checkStatus);

// ================= WALLET =================
router.get("/wallet/ledger", requireAuth, ledger);

// ================= WITHDRAWALS =================
router.post("/withdrawals", requireAuth, requestWithdrawal);

module.exports = router;