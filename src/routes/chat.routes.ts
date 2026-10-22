import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';
import {
  validateBody,
  validateQuery,
} from '../middlewares/validate';
import {
  createChatSchema,
  createGroupChatSchema,
  deleteMessageSchema,
  editMessageSchema,
  getMessagesQuerySchema,
  markMessageReadSchema,
  memberActionSchema,
  sendMessageSchema,
  updateLastSeenSchema,
} from '../schemas/chat.schema';

const router = Router();

// Requirement 1: Create or Get Chat
// POST /chat/create
// Input: userAId, userBId
// Output: chatId
router.post(
  '/chat/create',
  validateBody(createChatSchema),
  chatController.createOrGetChat
);

// Requirement 2: Send Message
// POST /chat/:chatId/message/send
// Input: senderId, text
// Store message in Firestore with timestamp
router.post(
  '/chat/:chatId/message/send',
  validateBody(sendMessageSchema),
  chatController.sendMessage
);

// Requirement 3: Get Messages
// GET /chat/:chatId/messages?limit=50
// Output: List of messages ordered by timestamp
router.get(
  '/chat/:chatId/messages',
  validateQuery(getMessagesQuerySchema),
  chatController.getMessages
);

// Requirement 4: Mark Message Read
// POST /chat/:chatId/message/:messageId/read
// Input: userId
// Update read receipt in Firestore
router.post(
  '/chat/:chatId/message/:messageId/read',
  validateBody(markMessageReadSchema),
  chatController.markMessageRead
);

// Requirement 5: Update Last Seen Message
// POST /chat/:chatId/lastseen
// Input: userId, messageId
// Update last seen message per user in Firestore
router.post(
  '/chat/:chatId/lastseen',
  validateBody(updateLastSeenSchema),
  chatController.updateLastSeen
);

// Companion routes for inspection
router.get('/chat/:chatId', chatController.getChatDetails);
router.get('/chat/:chatId/lastseen', chatController.getLastSeen);

// Bonus: Group Chat Creation & Management
router.post(
  '/chat/group/create',
  validateBody(createGroupChatSchema),
  chatController.createGroupChat
);
router.post(
  '/chat/:chatId/members/add',
  validateBody(memberActionSchema),
  chatController.addMember
);
router.post(
  '/chat/:chatId/members/remove',
  validateBody(memberActionSchema),
  chatController.removeMember
);

// Bonus: Message edit/delete
router.patch(
  '/chat/:chatId/message/:messageId',
  validateBody(editMessageSchema),
  chatController.editMessage
);
router.delete(
  '/chat/:chatId/message/:messageId',
  validateBody(deleteMessageSchema),
  chatController.deleteMessage
);

export default router;
