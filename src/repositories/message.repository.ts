import admin from 'firebase-admin';
import { getFirestore, isFirestoreMock } from '../config/firebase';
import {
  LastSeenRecord,
  Message,
  SendMessageInput,
  UpdateLastSeenInput,
} from '../types/message';
import crypto from 'crypto';

export interface IMessageRepository {
  createMessage(input: SendMessageInput): Promise<Message>;
  getMessages(chatId: string, limit?: number, beforeTimestamp?: string): Promise<Message[]>;
  getMessageById(chatId: string, messageId: string): Promise<Message | null>;
  markMessageRead(chatId: string, messageId: string, userId: string): Promise<Message>;
  updateLastSeen(input: UpdateLastSeenInput): Promise<LastSeenRecord>;
  getLastSeenRecords(chatId: string): Promise<LastSeenRecord[]>;
  editMessage(chatId: string, messageId: string, senderId: string, text: string): Promise<Message>;
  deleteMessage(chatId: string, messageId: string, senderId: string): Promise<Message>;
}

// In-Memory Fallback Store
class InMemoryMessageRepository implements IMessageRepository {
  // chatId -> messageId -> Message
  private messages = new Map<string, Map<string, Message>>();
  // chatId -> userId -> LastSeenRecord
  private lastSeen = new Map<string, Map<string, LastSeenRecord>>();

  async createMessage(input: SendMessageInput): Promise<Message> {
    const id = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const msg: Message = {
      id,
      chatId: input.chatId,
      senderId: input.senderId,
      text: input.text,
      timestamp: nowIso,
      readBy: [input.senderId],
      readReceipts: {
        [input.senderId]: nowIso,
      },
      isEdited: false,
      editedAt: null,
      isDeleted: false,
      deletedAt: null,
    };

    if (!this.messages.has(input.chatId)) {
      this.messages.set(input.chatId, new Map());
    }
    this.messages.get(input.chatId)!.set(id, msg);
    return { ...msg };
  }

  async getMessages(
    chatId: string,
    limit = 50,
    beforeTimestamp?: string
  ): Promise<Message[]> {
    const chatMsgs = this.messages.get(chatId);
    if (!chatMsgs) return [];

    let list = Array.from(chatMsgs.values());

    if (beforeTimestamp) {
      list = list.filter((m) => new Date(m.timestamp) < new Date(beforeTimestamp));
    }

    list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return list.slice(0, limit);
  }

  async getMessageById(chatId: string, messageId: string): Promise<Message | null> {
    const msg = this.messages.get(chatId)?.get(messageId);
    return msg ? { ...msg } : null;
  }

  async markMessageRead(
    chatId: string,
    messageId: string,
    userId: string
  ): Promise<Message> {
    const chatMsgs = this.messages.get(chatId);
    if (!chatMsgs) throw new Error('Chat messages not found');
    const msg = chatMsgs.get(messageId);
    if (!msg) throw new Error('Message not found');

    const nowIso = new Date().toISOString();
    if (!msg.readBy.includes(userId)) {
      msg.readBy.push(userId);
    }
    msg.readReceipts[userId] = nowIso;

    chatMsgs.set(messageId, msg);
    return { ...msg };
  }

  async updateLastSeen(input: UpdateLastSeenInput): Promise<LastSeenRecord> {
    const nowIso = new Date().toISOString();
    const record: LastSeenRecord = {
      chatId: input.chatId,
      userId: input.userId,
      messageId: input.messageId,
      seenAt: nowIso,
    };

    if (!this.lastSeen.has(input.chatId)) {
      this.lastSeen.set(input.chatId, new Map());
    }
    this.lastSeen.get(input.chatId)!.set(input.userId, record);
    return { ...record };
  }

  async getLastSeenRecords(chatId: string): Promise<LastSeenRecord[]> {
    const records = this.lastSeen.get(chatId);
    if (!records) return [];
    return Array.from(records.values());
  }

  async editMessage(
    chatId: string,
    messageId: string,
    senderId: string,
    text: string
  ): Promise<Message> {
    const msg = await this.getMessageById(chatId, messageId);
    if (!msg) throw new Error('Message not found');
    if (msg.senderId !== senderId) throw new Error('Only the sender can edit this message');
    if (msg.isDeleted) throw new Error('Cannot edit a deleted message');

    msg.text = text;
    msg.isEdited = true;
    msg.editedAt = new Date().toISOString();
    this.messages.get(chatId)!.set(messageId, msg);
    return { ...msg };
  }

  async deleteMessage(
    chatId: string,
    messageId: string,
    senderId: string
  ): Promise<Message> {
    const msg = await this.getMessageById(chatId, messageId);
    if (!msg) throw new Error('Message not found');
    if (msg.senderId !== senderId) throw new Error('Only the sender can delete this message');

    msg.text = '[This message was deleted]';
    msg.isDeleted = true;
    msg.deletedAt = new Date().toISOString();
    this.messages.get(chatId)!.set(messageId, msg);
    return { ...msg };
  }
}

// Firestore Implementation
class FirestoreMessageRepository implements IMessageRepository {
  private getDb(): FirebaseFirestore.Firestore {
    const db = getFirestore();
    if (!db) {
      throw new Error('Firestore is not initialized');
    }
    return db;
  }

  async createMessage(input: SendMessageInput): Promise<Message> {
    const db = this.getDb();
    const id = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const messageData = {
      id,
      chatId: input.chatId,
      senderId: input.senderId,
      text: input.text,
      timestamp: admin.firestore.Timestamp.now(),
      timestampIso: nowIso,
      readBy: [input.senderId],
      readReceipts: {
        [input.senderId]: nowIso,
      },
      isEdited: false,
      editedAt: null,
      isDeleted: false,
      deletedAt: null,
    };

    const docRef = db
      .collection('chats')
      .doc(input.chatId)
      .collection('messages')
      .doc(id);

    await docRef.set(messageData);

    return {
      id,
      chatId: input.chatId,
      senderId: input.senderId,
      text: input.text,
      timestamp: nowIso,
      readBy: [input.senderId],
      readReceipts: {
        [input.senderId]: nowIso,
      },
      isEdited: false,
      editedAt: null,
      isDeleted: false,
      deletedAt: null,
    };
  }

  async getMessages(
    chatId: string,
    limit = 50,
    beforeTimestamp?: string
  ): Promise<Message[]> {
    const db = this.getDb();
    let queryRef: FirebaseFirestore.Query = db
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .orderBy('timestamp', 'asc');

    if (beforeTimestamp) {
      const beforeDate = new Date(beforeTimestamp);
      queryRef = queryRef.where(
        'timestamp',
        '<',
        admin.firestore.Timestamp.fromDate(beforeDate)
      );
    }

    queryRef = queryRef.limit(limit);

    const snapshot = await queryRef.get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      const ts = data.timestamp instanceof admin.firestore.Timestamp
        ? data.timestamp.toDate().toISOString()
        : data.timestampIso || new Date().toISOString();

      return {
        id: doc.id,
        chatId,
        senderId: data.senderId,
        text: data.text,
        timestamp: ts,
        readBy: data.readBy || [],
        readReceipts: data.readReceipts || {},
        isEdited: data.isEdited || false,
        editedAt: data.editedAt || null,
        isDeleted: data.isDeleted || false,
        deletedAt: data.deletedAt || null,
      };
    });
  }

  async getMessageById(chatId: string, messageId: string): Promise<Message | null> {
    const db = this.getDb();
    const doc = await db
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .doc(messageId)
      .get();

    if (!doc.exists) return null;
    const data = doc.data()!;
    const ts = data.timestamp instanceof admin.firestore.Timestamp
      ? data.timestamp.toDate().toISOString()
      : data.timestampIso || new Date().toISOString();

    return {
      id: doc.id,
      chatId,
      senderId: data.senderId,
      text: data.text,
      timestamp: ts,
      readBy: data.readBy || [],
      readReceipts: data.readReceipts || {},
      isEdited: data.isEdited || false,
      editedAt: data.editedAt || null,
      isDeleted: data.isDeleted || false,
      deletedAt: data.deletedAt || null,
    };
  }

  async markMessageRead(
    chatId: string,
    messageId: string,
    userId: string
  ): Promise<Message> {
    const db = this.getDb();
    const docRef = db
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .doc(messageId);

    const nowIso = new Date().toISOString();

    await docRef.update({
      readBy: admin.firestore.FieldValue.arrayUnion(userId),
      [`readReceipts.${userId}`]: nowIso,
    });

    const updated = await this.getMessageById(chatId, messageId);
    if (!updated) throw new Error('Message not found after update');
    return updated;
  }

  async updateLastSeen(input: UpdateLastSeenInput): Promise<LastSeenRecord> {
    const db = this.getDb();
    const nowIso = new Date().toISOString();

    const docRef = db
      .collection('chats')
      .doc(input.chatId)
      .collection('lastSeen')
      .doc(input.userId);

    const record = {
      chatId: input.chatId,
      userId: input.userId,
      messageId: input.messageId,
      seenAt: nowIso,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await docRef.set(record, { merge: true });

    return {
      chatId: input.chatId,
      userId: input.userId,
      messageId: input.messageId,
      seenAt: nowIso,
    };
  }

  async getLastSeenRecords(chatId: string): Promise<LastSeenRecord[]> {
    const db = this.getDb();
    const snapshot = await db
      .collection('chats')
      .doc(chatId)
      .collection('lastSeen')
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        chatId,
        userId: doc.id,
        messageId: data.messageId,
        seenAt: data.seenAt || new Date().toISOString(),
      };
    });
  }

  async editMessage(
    chatId: string,
    messageId: string,
    senderId: string,
    text: string
  ): Promise<Message> {
    const db = this.getDb();
    const docRef = db
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .doc(messageId);

    const doc = await docRef.get();
    if (!doc.exists) throw new Error('Message not found');
    const data = doc.data()!;
    if (data.senderId !== senderId) throw new Error('Only sender can edit message');
    if (data.isDeleted) throw new Error('Cannot edit deleted message');

    const nowIso = new Date().toISOString();
    await docRef.update({
      text,
      isEdited: true,
      editedAt: nowIso,
    });

    const updated = await this.getMessageById(chatId, messageId);
    if (!updated) throw new Error('Message not found after update');
    return updated;
  }

  async deleteMessage(
    chatId: string,
    messageId: string,
    senderId: string
  ): Promise<Message> {
    const db = this.getDb();
    const docRef = db
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .doc(messageId);

    const doc = await docRef.get();
    if (!doc.exists) throw new Error('Message not found');
    const data = doc.data()!;
    if (data.senderId !== senderId) throw new Error('Only sender can delete message');

    const nowIso = new Date().toISOString();
    await docRef.update({
      text: '[This message was deleted]',
      isDeleted: true,
      deletedAt: nowIso,
    });

    const updated = await this.getMessageById(chatId, messageId);
    if (!updated) throw new Error('Message not found after update');
    return updated;
  }
}

// Factory to select active message repository
export function getMessageRepository(): IMessageRepository {
  if (isFirestoreMock()) {
    return inMemoryRepository;
  }
  return firestoreRepository;
}

const inMemoryRepository = new InMemoryMessageRepository();
const firestoreRepository = new FirestoreMessageRepository();

export const messageRepository = new Proxy({} as IMessageRepository, {
  get(_target, prop) {
    const repo = getMessageRepository();
    const value = Reflect.get(repo, prop);
    return typeof value === 'function' ? value.bind(repo) : value;
  },
});
