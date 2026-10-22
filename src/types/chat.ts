export type ChatType = 'direct' | 'group';

export type MemberRole = 'member' | 'admin';

export interface ChatMember {
  userId: string;
  role: MemberRole;
  joinedAt: Date;
  name?: string;
  email?: string;
}

export interface Chat {
  id: string;
  type: ChatType;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatWithMembers extends Chat {
  members: ChatMember[];
}

export interface CreateDirectChatInput {
  userAId: string;
  userBId: string;
}

export interface CreateGroupChatInput {
  name: string;
  creatorId: string;
  memberIds: string[];
}
