import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { validateBody } from '../middlewares/validate';
import { createUserSchema } from '../schemas/user.schema';

const router = Router();

// Create user
router.post('/users', validateBody(createUserSchema), userController.createUser);

// List all users
router.get('/users', userController.listUsers);

// Get specific user
router.get('/user/:userId', userController.getUser);

// Requirement 6: List User Chats
// GET /user/:userId/chats
router.get('/user/:userId/chats', userController.getUserChats);

export default router;
