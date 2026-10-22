import { chatRepository, ChatRepository } from '../repositories/chat.repository';
import { userRepository, UserRepository } from '../repositories/user.repository';
import { ChatWithMembers, CreateGroupChatInput } from '../types/chat';

export class ChatService {
  constructor(
    private chatRepo: ChatRepository = chatRepository,
    private userRepo: UserRepository = userRepository
  ) {}

  async getOrCreateDirectChat(userAId: string, userBId: string): Promise<{ chatId: string; isNew: boolean }> {
    if (userAId === userBId) {
      throw new Error('Cannot create a 1:1 chat with oneself');
    }

    const [userAExists, userBExists] = await Promise.all([
      this.userRepo.exists(userAId),
      this.userRepo.exists(userBId),
    ]);

    if (!userAExists) {
      throw new Error(`User with ID "${userAId}" does not exist`);
    }
    if (!userBExists) {
      throw new Error(`User with ID "${userBId}" does not exist`);
    }

    // Check if direct chat already exists
    const existing = await this.chatRepo.findDirectChat(userAId, userBId);
    if (existing) {
      return { chatId: existing.id, isNew: false };
    }

    // Create new direct chat
    const newChat = await this.chatRepo.createDirectChat({ userAId, userBId });
    return { chatId: newChat.id, isNew: true };
  }

  async createGroupChat(input: CreateGroupChatInput): Promise<ChatWithMembers> {
    const creatorExists = await this.userRepo.exists(input.creatorId);
    if (!creatorExists) {
      throw new Error(`Creator with ID "${input.creatorId}" does not exist`);
    }

    for (const memberId of input.memberIds) {
      const exists = await this.userRepo.exists(memberId);
      if (!exists) {
        throw new Error(`Member with ID "${memberId}" does not exist`);
      }
    }

    return this.chatRepo.createGroupChat(input);
  }

  async getUserChats(userId: string): Promise<ChatWithMembers[]> {
    const userExists = await this.userRepo.exists(userId);
    if (!userExists) {
      throw new Error(`User with ID "${userId}" does not exist`);
    }

    return this.chatRepo.findUserChats(userId);
  }

  async getChatById(chatId: string): Promise<ChatWithMembers> {
    const chat = await this.chatRepo.findById(chatId);
    if (!chat) {
      throw new Error(`Chat with ID "${chatId}" not found`);
    }
    return chat;
  }

  async addMemberToGroup(
    chatId: string,
    adminId: string,
    newMemberId: string
  ): Promise<void> {
    const chat = await this.getChatById(chatId);
    if (chat.type !== 'group') {
      throw new Error('Members can only be added to group chats');
    }

    const role = await this.chatRepo.getMemberRole(chatId, adminId);
    if (role !== 'admin') {
      throw new Error('Only a group admin can add members');
    }

    const memberExists = await this.userRepo.exists(newMemberId);
    if (!memberExists) {
      throw new Error(`User with ID "${newMemberId}" does not exist`);
    }

    await this.chatRepo.addMember(chatId, newMemberId, 'member');
  }

  async removeMemberFromGroup(
    chatId: string,
    adminId: string,
    memberIdToRemove: string
  ): Promise<void> {
    const chat = await this.getChatById(chatId);
    if (chat.type !== 'group') {
      throw new Error('Members can only be removed from group chats');
    }

    const role = await this.chatRepo.getMemberRole(chatId, adminId);
    if (role !== 'admin') {
      throw new Error('Only a group admin can remove members');
    }

    await this.chatRepo.removeMember(chatId, memberIdToRemove);
  }
}

export const chatService = new ChatService();
