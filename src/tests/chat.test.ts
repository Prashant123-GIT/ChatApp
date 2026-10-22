import request from 'supertest';
import { app } from '../app';
import { pool } from '../db/pool';
import { runMigrations } from '../db/migrate';
import { userRepository } from '../repositories/user.repository';

describe('Chat Backend Integration Tests', () => {
  const user1 = { id: 'test-user-1', name: 'Tester One', email: 'test1@example.com' };
  const user2 = { id: 'test-user-2', name: 'Tester Two', email: 'test2@example.com' };
  const user3 = { id: 'test-user-3', name: 'Tester Three', email: 'test3@example.com' };

  let activeChatId: string;
  let activeMessageId: string;

  beforeAll(async () => {
    await runMigrations();

    // Clean test data
    await pool.query('DELETE FROM chat_members WHERE user_id LIKE $1', ['test-user-%']);
    await pool.query('DELETE FROM users WHERE id LIKE $1', ['test-user-%']);

    // Seed test users
    await userRepository.create(user1);
    await userRepository.create(user2);
    await userRepository.create(user3);
  });

  afterAll(async () => {
    // Cleanup
    await pool.query('DELETE FROM chat_members WHERE user_id LIKE $1', ['test-user-%']);
    await pool.query('DELETE FROM users WHERE id LIKE $1', ['test-user-%']);
    await pool.end();
  });

  describe('Health Check API', () => {
    it('GET /health - should return healthy database status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.database.healthy).toBe(true);
      expect(res.body.firestore).toBeDefined();
    });
  });

  describe('API 1: Create or Get Chat (POST /chat/create)', () => {
    it('should create a new 1:1 chat between user1 and user2', async () => {
      const res = await request(app)
        .post('/chat/create')
        .send({ userAId: user1.id, userBId: user2.id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.chatId).toBeDefined();
      expect(res.body.isNew).toBe(true);

      activeChatId = res.body.chatId;
    });

    it('should return existing chat when called again with same users', async () => {
      const res = await request(app)
        .post('/chat/create')
        .send({ userAId: user1.id, userBId: user2.id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.chatId).toBe(activeChatId);
      expect(res.body.isNew).toBe(false);
    });

    it('should return existing chat even when user order is reversed (user2, user1)', async () => {
      const res = await request(app)
        .post('/chat/create')
        .send({ userAId: user2.id, userBId: user1.id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.chatId).toBe(activeChatId);
      expect(res.body.isNew).toBe(false);
    });

    it('should reject chat creation with oneself', async () => {
      const res = await request(app)
        .post('/chat/create')
        .send({ userAId: user1.id, userBId: user1.id });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('oneself');
    });

    it('should reject chat creation when a user does not exist', async () => {
      const res = await request(app)
        .post('/chat/create')
        .send({ userAId: user1.id, userBId: 'non-existent-user' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('API 2: Send Message (POST /chat/:chatId/message/send)', () => {
    it('should send a message successfully and store in Firestore with timestamp', async () => {
      const res = await request(app)
        .post(`/chat/${activeChatId}/message/send`)
        .send({
          senderId: user1.id,
          text: 'Hello from user 1!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.chatId).toBe(activeChatId);
      expect(res.body.data.senderId).toBe(user1.id);
      expect(res.body.data.text).toBe('Hello from user 1!');
      expect(res.body.data.timestamp).toBeDefined();
      expect(res.body.data.readBy).toContain(user1.id);

      activeMessageId = res.body.data.id;
    });

    it('should reject sending message if sender is not a member of the chat', async () => {
      const res = await request(app)
        .post(`/chat/${activeChatId}/message/send`)
        .send({
          senderId: user3.id,
          text: 'Intruder message',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not a member');
    });

    it('should reject empty message text', async () => {
      const res = await request(app)
        .post(`/chat/${activeChatId}/message/send`)
        .send({
          senderId: user1.id,
          text: '   ',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('API 3: Get Messages (GET /chat/:chatId/messages?limit=50)', () => {
    beforeAll(async () => {
      // Send a second message
      await request(app)
        .post(`/chat/${activeChatId}/message/send`)
        .send({
          senderId: user2.id,
          text: 'Hello back from user 2!',
        });
    });

    it('should return messages ordered by timestamp', async () => {
      const res = await request(app)
        .get(`/chat/${activeChatId}/messages?limit=50`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);

      // Verify ordering
      const msgs = res.body.data;
      const t1 = new Date(msgs[0].timestamp).getTime();
      const t2 = new Date(msgs[1].timestamp).getTime();
      expect(t1).toBeLessThanOrEqual(t2);
    });

    it('should respect the limit parameter', async () => {
      const res = await request(app)
        .get(`/chat/${activeChatId}/messages?limit=1`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });
  });

  describe('API 4: Mark Message Read (POST /chat/:chatId/message/:messageId/read)', () => {
    it('should update read receipt in Firestore for user2', async () => {
      const res = await request(app)
        .post(`/chat/${activeChatId}/message/${activeMessageId}/read`)
        .send({
          userId: user2.id,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.readBy).toContain(user2.id);
      expect(res.body.data.readReceipts[user2.id]).toBeDefined();
    });

    it('should reject marking read for non-member', async () => {
      const res = await request(app)
        .post(`/chat/${activeChatId}/message/${activeMessageId}/read`)
        .send({
          userId: user3.id,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('not a member');
    });
  });

  describe('API 5: Update Last Seen Message (POST /chat/:chatId/lastseen)', () => {
    it('should update last seen message per user in Firestore', async () => {
      const res = await request(app)
        .post(`/chat/${activeChatId}/lastseen`)
        .send({
          userId: user2.id,
          messageId: activeMessageId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.chatId).toBe(activeChatId);
      expect(res.body.data.userId).toBe(user2.id);
      expect(res.body.data.messageId).toBe(activeMessageId);
      expect(res.body.data.seenAt).toBeDefined();
    });

    it('should be retrievable via GET /chat/:chatId/lastseen', async () => {
      const res = await request(app).get(`/chat/${activeChatId}/lastseen`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const found = res.body.data.find(
        (r: { userId: string; messageId: string }) =>
          r.userId === user2.id && r.messageId === activeMessageId
      );
      expect(found).toBeDefined();
    });
  });

  describe('API 6: List User Chats (GET /user/:userId/chats)', () => {
    it('should list all chats with member IDs from relational DB for user1', async () => {
      const res = await request(app).get(`/user/${user1.id}/chats`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const chat = res.body.data.find((c: { id: string }) => c.id === activeChatId);
      expect(chat).toBeDefined();
      expect(chat.type).toBe('direct');
      expect(Array.isArray(chat.members)).toBe(true);

      const memberIds = chat.members.map((m: { userId: string }) => m.userId);
      expect(memberIds).toContain(user1.id);
      expect(memberIds).toContain(user2.id);
    });

    it('should return 404 if user does not exist', async () => {
      const res = await request(app).get('/user/non-existent-user/chats');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Bonus APIs: Group Chat & Message Edit/Delete', () => {
    let groupChatId: string;
    let groupMessageId: string;

    it('POST /chat/group/create - should create a group chat', async () => {
      const res = await request(app)
        .post('/chat/group/create')
        .send({
          name: 'Super Squad',
          creatorId: user1.id,
          memberIds: [user2.id, user3.id],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('group');
      expect(res.body.data.name).toBe('Super Squad');
      expect(res.body.data.members.length).toBe(3);

      groupChatId = res.body.data.id;
    });

    it('POST /chat/:chatId/message/send - should send message in group chat', async () => {
      const res = await request(app)
        .post(`/chat/${groupChatId}/message/send`)
        .send({
          senderId: user1.id,
          text: 'Original Group Message',
        });

      expect(res.status).toBe(201);
      groupMessageId = res.body.data.id;
    });

    it('PATCH /chat/:chatId/message/:messageId - should edit message', async () => {
      const res = await request(app)
        .patch(`/chat/${groupChatId}/message/${groupMessageId}`)
        .send({
          senderId: user1.id,
          text: 'Edited Group Message!',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.text).toBe('Edited Group Message!');
      expect(res.body.data.isEdited).toBe(true);
    });

    it('DELETE /chat/:chatId/message/:messageId - should delete message', async () => {
      const res = await request(app)
        .delete(`/chat/${groupChatId}/message/${groupMessageId}`)
        .send({
          senderId: user1.id,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.isDeleted).toBe(true);
      expect(res.body.data.text).toBe('[This message was deleted]');
    });
  });
});
