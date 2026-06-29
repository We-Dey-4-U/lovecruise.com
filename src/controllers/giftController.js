const GiftService = require('../services/giftService');

const GiftController = {
  // GET /api/gifts
  async catalog(req, res, next) {
    try {
      const gifts = await GiftService.listCatalog();
      res.json({ success: true, data: gifts });
    } catch (err) {
      next(err);
    }
  },

  // POST /api/gifts/send  { receiverId, giftId, quantity, contextType, contextId }
  async send(req, res, next) {
    try {
      const { receiverId, giftId, quantity, contextType, contextId } = req.body;
      if (!receiverId || !giftId || !contextType) {
        return res.status(400).json({ success: false, message: 'receiverId, giftId and contextType are required' });
      }
      if (!['chat', 'call', 'live_room', 'podcast'].includes(contextType)) {
  return res.status(400).json({
    success: false,
    message: 'Invalid contextType'
  });
}

      const result = await GiftService.sendGift({
        senderId: req.user.id,
        receiverId,
        giftId,
        quantity: quantity || 1,
        contextType,
        contextId,
      });

      const io = req.app.get('io');
      if (io && contextType === 'live_room') {
        io.to(`room:${contextId}`).emit(
    "giftReceived", {
          senderId: req.user.id,
          receiverId,
          gift: result.gift,
          quantity: quantity || 1,
        });
      }
      if (io && contextType === 'chat') {
        io.to(`conversation:${contextId}`).emit(
    "giftReceived", {
          senderId: req.user.id,
          receiverId,
          gift: result.gift,
          quantity: quantity || 1,
        });
      }

      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  // GET /api/gifts/received
  async received(req, res, next) {
    try {
      const data = await GiftService.receivedHistory(req.user.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  // GET /api/gifts/sent
  async sent(req, res, next) {
    try {
      const data = await GiftService.sentHistory(req.user.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = GiftController;