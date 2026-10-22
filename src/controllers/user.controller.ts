import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service';
import { chatService } from '../services/chat.service';

export class UserController {
  async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.createUser(req.body);
      res.status(201).json({
        success: true,
        data: user,
      });
    } catch (err) {
      next(err);
    }
  }

  async getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = String(req.params.userId);
      const user = await userService.getUserById(userId);
      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (err) {
      next(err);
    }
  }

  async listUsers(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await userService.listUsers();
      res.status(200).json({
        success: true,
        data: users,
      });
    } catch (err) {
      next(err);
    }
  }

  // API 6: GET /user/:userId/chats
  async getUserChats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = String(req.params.userId);
      const chats = await chatService.getUserChats(userId);
      res.status(200).json({
        success: true,
        data: chats,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const userController = new UserController();
