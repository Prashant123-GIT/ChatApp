import { query, withTransaction } from '../db/pool';
import {
  ChatMember,
  ChatWithMembers,
  CreateDirectChatInput,
  CreateGroupChatInput,
  MemberRole,
} from '../types/chat';
import crypto from 'crypto';

export class ChatRepository {
  async findById(chatId: string): Promise<ChatWithMembers | null> {
    const chatRes = await query<{
      id: string;
      type: 'direct' | 'group';
      name: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      'SELECT id, type, name, created_at, updated_at FROM chats WHERE id = $1',
      [chatId]
    );

    if (!chatRes.rows[0]) return null;

    const chatRow = chatRes.rows[0];
    const members = await this.getChatMembers(chatId);

    return {
      id: chatRow.id,
      type: chatRow.type,
      name: chatRow.name,
      createdAt: chatRow.created_at,
      updatedAt: chatRow.updated_at,
      members,
    };
  }

  async isMember(chatId: string, userId: string): Promise<boolean> {
    const res = await query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2) as exists',
      [chatId, userId]
    );
    return res.rows[0]?.exists ?? false;
  }

  async getChatMembers(chatId: string): Promise<ChatMember[]> {
    const res = await query<{
      user_id: string;
      role: MemberRole;
      joined_at: Date;
      name?: string;
      email?: string;
    }>(
      `SELECT cm.user_id, cm.role, cm.joined_at, u.name, u.email
       FROM chat_members cm
       LEFT JOIN users u ON cm.user_id = u.id
       WHERE cm.chat_id = $1
       ORDER BY cm.joined_at ASC`,
      [chatId]
    );

    return res.rows.map((row) => ({
      userId: row.user_id,
      role: row.role,
      joinedAt: row.joined_at,
      name: row.name,
      email: row.email,
    }));
  }

  async findDirectChat(
    userAId: string,
    userBId: string
  ): Promise<ChatWithMembers | null> {
    const res = await query<{ id: string }>(
      `SELECT c.id
       FROM chats c
       JOIN chat_members m1 ON c.id = m1.chat_id AND m1.user_id = $1
       JOIN chat_members m2 ON c.id = m2.chat_id AND m2.user_id = $2
       WHERE c.type = 'direct'
       LIMIT 1`,
      [userAId, userBId]
    );

    if (!res.rows[0]) return null;

    return this.findById(res.rows[0].id);
  }

  async createDirectChat(
    input: CreateDirectChatInput
  ): Promise<ChatWithMembers> {
    const chatId = crypto.randomUUID();

    return withTransaction(async (client) => {
      const chatRes = await client.query<{
        id: string;
        type: 'direct';
        name: null;
        created_at: Date;
        updated_at: Date;
      }>(
        `INSERT INTO chats (id, type)
         VALUES ($1, 'direct')
         RETURNING id, type, name, created_at, updated_at`,
        [chatId]
      );

      await client.query(
        `INSERT INTO chat_members (chat_id, user_id, role)
         VALUES ($1, $2, 'member'), ($1, $3, 'member')`,
        [chatId, input.userAId, input.userBId]
      );

      const chatRow = chatRes.rows[0]!;
      const membersRes = await client.query<{
        user_id: string;
        role: MemberRole;
        joined_at: Date;
        name?: string;
        email?: string;
      }>(
        `SELECT cm.user_id, cm.role, cm.joined_at, u.name, u.email
         FROM chat_members cm
         LEFT JOIN users u ON cm.user_id = u.id
         WHERE cm.chat_id = $1
         ORDER BY cm.joined_at ASC`,
        [chatId]
      );

      return {
        id: chatRow.id,
        type: chatRow.type,
        name: chatRow.name,
        createdAt: chatRow.created_at,
        updatedAt: chatRow.updated_at,
        members: membersRes.rows.map((row) => ({
          userId: row.user_id,
          role: row.role,
          joinedAt: row.joined_at,
          name: row.name,
          email: row.email,
        })),
      };
    });
  }

  async createGroupChat(input: CreateGroupChatInput): Promise<ChatWithMembers> {
    const chatId = crypto.randomUUID();
    const uniqueMemberIds = Array.from(new Set([input.creatorId, ...input.memberIds]));

    return withTransaction(async (client) => {
      const chatRes = await client.query<{
        id: string;
        type: 'group';
        name: string;
        created_at: Date;
        updated_at: Date;
      }>(
        `INSERT INTO chats (id, type, name)
         VALUES ($1, 'group', $2)
         RETURNING id, type, name, created_at, updated_at`,
        [chatId, input.name]
      );

      for (const memberId of uniqueMemberIds) {
        const role: MemberRole = memberId === input.creatorId ? 'admin' : 'member';
        await client.query(
          `INSERT INTO chat_members (chat_id, user_id, role)
           VALUES ($1, $2, $3)`,
          [chatId, memberId, role]
        );
      }

      const chatRow = chatRes.rows[0]!;
      const membersRes = await client.query<{
        user_id: string;
        role: MemberRole;
        joined_at: Date;
        name?: string;
        email?: string;
      }>(
        `SELECT cm.user_id, cm.role, cm.joined_at, u.name, u.email
         FROM chat_members cm
         LEFT JOIN users u ON cm.user_id = u.id
         WHERE cm.chat_id = $1
         ORDER BY cm.joined_at ASC`,
        [chatId]
      );

      return {
        id: chatRow.id,
        type: chatRow.type,
        name: chatRow.name,
        createdAt: chatRow.created_at,
        updatedAt: chatRow.updated_at,
        members: membersRes.rows.map((row) => ({
          userId: row.user_id,
          role: row.role,
          joinedAt: row.joined_at,
          name: row.name,
          email: row.email,
        })),
      };
    });
  }

  async findUserChats(userId: string): Promise<ChatWithMembers[]> {
    // 1. Get all chats user belongs to
    const chatsRes = await query<{
      id: string;
      type: 'direct' | 'group';
      name: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT c.id, c.type, c.name, c.created_at, c.updated_at
       FROM chats c
       JOIN chat_members cm ON c.id = cm.chat_id
       WHERE cm.user_id = $1
       ORDER BY c.updated_at DESC`,
      [userId]
    );

    if (chatsRes.rows.length === 0) return [];

    const chatIds = chatsRes.rows.map((r) => r.id);

    // 2. Fetch all members for these chats
    const membersRes = await query<{
      chat_id: string;
      user_id: string;
      role: MemberRole;
      joined_at: Date;
      name?: string;
      email?: string;
    }>(
      `SELECT cm.chat_id, cm.user_id, cm.role, cm.joined_at, u.name, u.email
       FROM chat_members cm
       LEFT JOIN users u ON cm.user_id = u.id
       WHERE cm.chat_id = ANY($1)
       ORDER BY cm.joined_at ASC`,
      [chatIds]
    );

    const membersByChat = new Map<string, ChatMember[]>();
    for (const row of membersRes.rows) {
      const list = membersByChat.get(row.chat_id) || [];
      list.push({
        userId: row.user_id,
        role: row.role,
        joinedAt: row.joined_at,
        name: row.name,
        email: row.email,
      });
      membersByChat.set(row.chat_id, list);
    }

    return chatsRes.rows.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      members: membersByChat.get(row.id) || [],
    }));
  }

  async touchChat(chatId: string): Promise<void> {
    await query(
      'UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [chatId]
    );
  }

  async addMember(
    chatId: string,
    userId: string,
    role: MemberRole = 'member'
  ): Promise<void> {
    await query(
      `INSERT INTO chat_members (chat_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (chat_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [chatId, userId, role]
    );
  }

  async removeMember(chatId: string, userId: string): Promise<void> {
    await query(
      'DELETE FROM chat_members WHERE chat_id = $1 AND user_id = $2',
      [chatId, userId]
    );
  }

  async getMemberRole(
    chatId: string,
    userId: string
  ): Promise<MemberRole | null> {
    const res = await query<{ role: MemberRole }>(
      'SELECT role FROM chat_members WHERE chat_id = $1 AND user_id = $2',
      [chatId, userId]
    );
    return res.rows[0]?.role ?? null;
  }
}

export const chatRepository = new ChatRepository();
