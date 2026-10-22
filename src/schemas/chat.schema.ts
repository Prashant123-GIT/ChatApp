import { z } from 'zod';

export const createChatSchema = z.object({
  userAId: z.string().min(1, 'userAId is required'),
  userBId: z.string().min(1, 'userBId is required'),
});

export const sendMessageSchema = z.object({
  senderId: z.string().min(1, 'senderId is required'),
  text: z.string().min(1, 'text cannot be empty').max(5000, 'text cannot exceed 5000 characters'),
});

export const getMessagesQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .refine((val) => !val || (!isNaN(Number(val)) && Number(val) > 0 && Number(val) <= 100), {
      message: 'limit must be a positive integer between 1 and 100',
    }),
  before: z.string().optional(),
});

export const markMessageReadSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
});

export const updateLastSeenSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  messageId: z.string().min(1, 'messageId is required'),
});

export const createGroupChatSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(100),
  creatorId: z.string().min(1, 'creatorId is required'),
  memberIds: z.array(z.string().min(1)).min(1, 'At least one memberId is required'),
});

export const memberActionSchema = z.object({
  adminId: z.string().min(1, 'adminId is required'),
  memberId: z.string().min(1, 'memberId is required'),
});

export const editMessageSchema = z.object({
  senderId: z.string().min(1, 'senderId is required'),
  text: z.string().min(1, 'text cannot be empty').max(5000),
});

export const deleteMessageSchema = z.object({
  senderId: z.string().min(1, 'senderId is required'),
});
