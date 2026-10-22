import { Request, Response, NextFunction } from 'express';
import { chatService } from '../services/chat.service';
import { messageService } from '../services/message.service';

export class ChatController {
  // API 1: POST /chat/create
  async createOrGetChat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userAId, userBId } = req.body;
      const result = await chatService.getOrCreateDirectChat(userAId, userBId);
      res.status(200).json({
        success: true,
        chatId: result.chatId,
        isNew: result.isNew,
      });
    } catch (err) {
      next(err);
    }
  }

  // API 2: POST /chat/:chatId/message/send
  async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const chatId = String(req.params.chatId);
      const { senderId, text } = req.body;
      const message = await messageService.sendMessage(chatId, senderId, text);
      res.status(201).json({
        success: true,
        data: message,
      });
    } catch (err) {
      next(err);
    }
  }

  // API 3: GET /chat/:chatId/messages?limit=50
  async getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const chatId = String(req.params.chatId);
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const before = req.query.before as string | undefined;

      const messages = await messageService.getMessages(chatId, limit, before);
      res.status(200).json({
        success: true,
        count: messages.length,
        data: messages,
      });
    } catch (err) {
      next(err);
    }
  }

  // API 4: POST /chat/:chatId/message/:messageId/read
  async markMessageRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const chatId = String(req.params.chatId);
      const messageId = String(req.params.messageId);
      const { userId } = req.body;
      const message = await messageService.markMessageRead(chatId, messageId, userId);
      res.status(200).json({
        success: true,
        data: message,
      });
    } catch (err) {
      next(err);
    }
  }

  // API 5: POST /chat/:chatId/lastseen
  async updateLastSeen(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const chatId = String(req.params.chatId);
      const { userId, messageId } = req.body;
      const lastSeen = await messageService.updateLastSeen(chatId, userId, messageId);
      res.status(200).json({
        success: true,
        data: lastSeen,
      });
    } catch (err) {
      next(err);
    }
  }

  // Companion: GET /chat/:chatId/lastseen
  async getLastSeen(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const chatId = String(req.params.chatId);
      const records = await messageService.getLastSeenRecords(chatId);
      res.status(200).json({
        success: true,
        data: records,
      });
    } catch (err) {
      next(err);
    }
  }

  // Companion: GET /chat/:chatId
  async getChatDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const chatId = String(req.params.chatId);
      const chat = await chatService.getChatById(chatId);
      res.status(200).json({
        success: true,
        data: chat,
      });
    } catch (err) {
      next(err);
    }
  }

  // Bonus: POST /chat/group/create
  async createGroupChat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, creatorId, memberIds } = req.body;
      const chat = await chatService.createGroupChat({ name, creatorId, memberIds });
      res.status(201).json({
        success: true,
        data: chat,
      });
    } catch (err) {
      next(err);
    }
  }

  // Bonus: POST /chat/:chatId/members/add
  async addMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const chatId = String(req.params.chatId);
      const { adminId, memberId } = req.body;
      await chatService.addMemberToGroup(chatId, adminId, memberId);
      res.status(200).json({
        success: true,
        message: 'Member added successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  // Bonus: POST /chat/:chatId/members/remove
  async removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const chatId = String(req.params.chatId);
      const { adminId, memberId } = req.body;
      await chatService.removeMemberFromGroup(chatId, adminId, memberId);
      res.status(200).json({
        success: true,
        message: 'Member removed successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  // Bonus: PATCH /chat/:chatId/message/:messageId
  async editMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const chatId = String(req.params.chatId);
      const messageId = String(req.params.messageId);
      const { senderId, text } = req.body;
      const message = await messageService.editMessage(chatId, messageId, senderId, text);
      res.status(200).json({
        success: true,
        data: message,
      });
    } catch (err) {
      next(err);
    }
  }

  // Bonus: DELETE /chat/:chatId/message/:messageId
  async deleteMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const chatId = String(req.params.chatId);
      const messageId = String(req.params.messageId);
      const { senderId } = req.body;
      const message = await messageService.deleteMessage(chatId, messageId, senderId);
      res.status(200).json({
        success: true,
        data: message,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const chatController = new ChatController();
