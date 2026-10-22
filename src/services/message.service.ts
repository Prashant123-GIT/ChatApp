import { chatRepository, ChatRepository } from '../repositories/chat.repository';
import {
  IMessageRepository,
  messageRepository,
} from '../repositories/message.repository';
import { LastSeenRecord, Message } from '../types/message';

export class MessageService {
  constructor(
    private msgRepo: IMessageRepository = messageRepository,
    private chatRepo: ChatRepository = chatRepository
  ) {}

  async sendMessage(
    chatId: string,
    senderId: string,
    text: string
  ): Promise<Message> {
    const isMember = await this.chatRepo.isMember(chatId, senderId);
    if (!isMember) {
      throw new Error(`User "${senderId}" is not a member of chat "${chatId}"`);
    }

    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('Message text cannot be empty');
    }

    const message = await this.msgRepo.createMessage({
      chatId,
      senderId,
      text: trimmed,
    });

    // Touch chat in relational DB to update updated_at timestamp
    await this.chatRepo.touchChat(chatId);

    return message;
  }

  async getMessages(
    chatId: string,
    limit = 50,
    beforeTimestamp?: string
  ): Promise<Message[]> {
    const chat = await this.chatRepo.findById(chatId);
    if (!chat) {
      throw new Error(`Chat with ID "${chatId}" not found`);
    }

    return this.msgRepo.getMessages(chatId, limit, beforeTimestamp);
  }

  async markMessageRead(
    chatId: string,
    messageId: string,
    userId: string
  ): Promise<Message> {
    const isMember = await this.chatRepo.isMember(chatId, userId);
    if (!isMember) {
      throw new Error(`User "${userId}" is not a member of chat "${chatId}"`);
    }

    const message = await this.msgRepo.getMessageById(chatId, messageId);
    if (!message) {
      throw new Error(`Message with ID "${messageId}" not found in chat "${chatId}"`);
    }

    return this.msgRepo.markMessageRead(chatId, messageId, userId);
  }

  async updateLastSeen(
    chatId: string,
    userId: string,
    messageId: string
  ): Promise<LastSeenRecord> {
    const isMember = await this.chatRepo.isMember(chatId, userId);
    if (!isMember) {
      throw new Error(`User "${userId}" is not a member of chat "${chatId}"`);
    }

    const message = await this.msgRepo.getMessageById(chatId, messageId);
    if (!message) {
      throw new Error(`Message with ID "${messageId}" not found in chat "${chatId}"`);
    }

    return this.msgRepo.updateLastSeen({
      chatId,
      userId,
      messageId,
    });
  }

  async getLastSeenRecords(chatId: string): Promise<LastSeenRecord[]> {
    const chat = await this.chatRepo.findById(chatId);
    if (!chat) {
      throw new Error(`Chat with ID "${chatId}" not found`);
    }

    return this.msgRepo.getLastSeenRecords(chatId);
  }

  async editMessage(
    chatId: string,
    messageId: string,
    senderId: string,
    newText: string
  ): Promise<Message> {
    const isMember = await this.chatRepo.isMember(chatId, senderId);
    if (!isMember) {
      throw new Error(`User "${senderId}" is not a member of chat "${chatId}"`);
    }

    const trimmed = newText.trim();
    if (!trimmed) {
      throw new Error('Message text cannot be empty');
    }

    return this.msgRepo.editMessage(chatId, messageId, senderId, trimmed);
  }

  async deleteMessage(
    chatId: string,
    messageId: string,
    senderId: string
  ): Promise<Message> {
    const isMember = await this.chatRepo.isMember(chatId, senderId);
    if (!isMember) {
      throw new Error(`User "${senderId}" is not a member of chat "${chatId}"`);
    }

    return this.msgRepo.deleteMessage(chatId, messageId, senderId);
  }
}

export const messageService = new MessageService();
