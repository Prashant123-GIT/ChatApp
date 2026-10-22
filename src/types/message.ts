export interface ReadReceipt {
  userId: string;
  readAt: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  timestamp: string;
  readBy: string[];
  readReceipts: Record<string, string>;
  isEdited?: boolean;
  editedAt?: string | null;
  isDeleted?: boolean;
  deletedAt?: string | null;
}

export interface SendMessageInput {
  chatId: string;
  senderId: string;
  text: string;
}

export interface LastSeenRecord {
  chatId: string;
  userId: string;
  messageId: string;
  seenAt: string;
}

export interface UpdateLastSeenInput {
  chatId: string;
  userId: string;
  messageId: string;
}
