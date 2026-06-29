const db = require('../config/db');
const WalletService = require('./walletService');

const GiftService = {
  async listCatalog() {
    const { rows } = await db.query(
      `SELECT id, name, emoji, icon_url, animation_url, price_coins, category, sort_order
       FROM gifts WHERE is_active = TRUE ORDER BY sort_order ASC, price_coins ASC`
    );
    return rows;
  },

  /**
   * Send a gift from one user to another. Runs in a DB transaction:
   * 1. Debit sender's spendable coin_balance
   * 2. Credit receiver's earnings_balance
   * 3. Record the gift_transactions row
   * 4. (optional) Insert a chat/live-room message representing the gift
   */
  async sendGift({ senderId, receiverId, giftId, quantity = 1, contextType, contextId }) {
    if (senderId === receiverId) {
      const err = new Error('You cannot send a gift to yourself');
      err.status = 400;
      throw err;
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const { rows: giftRows } = await client.query(
        'SELECT * FROM gifts WHERE id = $1 AND is_active = TRUE',
        [giftId]
      );
      const gift = giftRows[0];
      if (!gift) {
        const err = new Error('Gift not found');
        err.status = 404;
        throw err;
      }

      const totalCoins = gift.price_coins * quantity;

      await WalletService.debitCoins(client, {
        userId: senderId,
        amount: totalCoins,
        type: 'gift_sent',
        referenceType: 'gift_transactions',
        referenceId: null,
        description: `Sent ${quantity}x ${gift.name}`,
      });

      const { rows: txRows } = await client.query(
        `INSERT INTO gift_transactions (gift_id, sender_id, receiver_id, quantity, total_coins, context_type, context_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [giftId, senderId, receiverId, quantity, totalCoins, contextType, contextId]
      );
      const tx = txRows[0];

      await WalletService.creditEarnings(client, {
        userId: receiverId,
        amount: totalCoins,
        referenceType: 'gift_transactions',
        referenceId: tx.id,
        description: `Received ${quantity}x ${gift.name}`,
      });

      if (contextType === 'live_room') {
        await client.query(
          `INSERT INTO live_room_messages (room_id, user_id, body, message_type, gift_id)
           VALUES ($1, $2, $3, 'gift', $4)`,
          [contextId, senderId, `sent ${quantity}x ${gift.name} ${gift.emoji || ''}`, giftId]
        );
        await client.query(
          `UPDATE live_rooms SET total_coins_earned = total_coins_earned + $1 WHERE id = $2`,
          [totalCoins, contextId]
        );
      } else if (contextType === 'chat') {
        await client.query(
          `INSERT INTO messages (conversation_id, sender_id, body, message_type, gift_id)
           VALUES ($1, $2, $3, 'gift', $4)`,
          [contextId, senderId, `sent ${quantity}x ${gift.name} ${gift.emoji || ''}`, giftId]
        );
      }

      await client.query('COMMIT');
      return { transaction: tx, gift, totalCoins };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async receivedHistory(userId, { limit = 50, offset = 0 } = {}) {
    const { rows } = await db.query(
      `SELECT gt.*, g.name AS gift_name, g.emoji, u.username AS sender_username
       FROM gift_transactions gt
       JOIN gifts g ON g.id = gt.gift_id
       JOIN users u ON u.id = gt.sender_id
       WHERE gt.receiver_id = $1
       ORDER BY gt.created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return rows;
  },

  async sentHistory(userId, { limit = 50, offset = 0 } = {}) {
    const { rows } = await db.query(
      `SELECT gt.*, g.name AS gift_name, g.emoji, u.username AS receiver_username
       FROM gift_transactions gt
       JOIN gifts g ON g.id = gt.gift_id
       JOIN users u ON u.id = gt.receiver_id
       WHERE gt.sender_id = $1
       ORDER BY gt.created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return rows;
  },
};

module.exports = GiftService;