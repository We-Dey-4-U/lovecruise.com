// backend/src/sockets/gift.socket.js
// Gift socket — non-live-room gift events only
// NOTE: live_room gifts are handled in stream.socket.js to avoid duplicates

module.exports = (io, socket) => {

  // Chat/call context gifts (not live room — that's stream.socket.js)
  socket.on("sendChatGift", (payload) => {
    const { conversationId, receiverId } = payload;

    if (conversationId) {
      io.to(`conversation:${conversationId}`).emit("giftReceived", payload);
    }
    if (receiverId) {
      io.to(`user:${receiverId}`).emit("giftNotification", payload);
    }
  });

};