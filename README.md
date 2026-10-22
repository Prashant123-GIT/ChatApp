# Hybrid Chat Backend (Node.js + TypeScript + PostgreSQL + Firebase Firestore)

A scalable, strictly typed Chat Backend built with **Node.js**, **TypeScript**, **PostgreSQL**, and **Firebase Firestore**.

---

## 🏗️ Architecture & Storage Strategy

This backend employs a hybrid architecture separating relational data and document/realtime stream data:

| Entity / Concern | Storage Engine | Rationale |
| :--- | :--- | :--- |
| **Users** | **PostgreSQL** | Strict relational integrity, uniqueness on emails, transactional user lifecycle. |
| **Chats & Memberships** | **PostgreSQL** | Relational queries for 1:1 chat deduplication, fast member lookups, ACID group joins. |
| **Messages** | **Firebase Firestore** | Scalable append-only message stream, millisecond query latency, ordered timeline retrieval. |
| **Read Receipts** | **Firebase Firestore** | High write throughput; updates `readBy` array and `readReceipts` map per message without heavy DB locking. |
| **Last Seen Tracking** | **Firebase Firestore** | Key-value/document store per user in chat (`chats/{chatId}/lastSeen/{userId}`), updated in real time. |

---

## 🛠️ Tech Stack

- **Runtime**: Node.js (v20+)
- **Language**: TypeScript 5.7+ (strict mode, no implicit any)
- **Relational DB**: PostgreSQL 17 (via connection pooling `pg`)
- **Document / Realtime DB**: Firebase Firestore (`firebase-admin`) with automatic in-memory fallback for local development/testing without cloud credentials
- **API Framework**: Express 5 + CORS + Body Parsers
- **Validation**: Zod (strict body, params, and query schemas)
- **Testing**: Jest + Supertest (21 automated integration tests)

---

## 📂 Project Structure

```
├── src/
│   ├── app.ts                 # Express app instance and middleware pipeline
│   ├── index.ts               # Server bootstrap & graceful shutdown
│   ├── config/
│   │   ├── env.ts             # Zod-validated environment config
│   │   └── firebase.ts        # Firebase Admin SDK & Firestore provider
│   ├── db/
│   │   ├── migrate.ts         # Automated migration runner
│   │   ├── pool.ts            # PostgreSQL connection pool & transaction helper
│   │   ├── schema.sql         # Relational schema (users, chats, chat_members)
│   │   └── seed.ts            # Seed script with sample users, chats, & messages
│   ├── types/
│   │   ├── chat.ts            # Chat, ChatMember, and ChatType interfaces
│   │   ├── message.ts         # Message, ReadReceipt, and LastSeen interfaces
│   │   └── user.ts            # User domain models
│   ├── repositories/
│   │   ├── chat.repository.ts # Relational queries for chats & members
│   │   ├── message.repository.ts # Firestore message & receipt repository
│   │   └── user.repository.ts # Relational queries for users
│   ├── services/
│   │   ├── chat.service.ts    # 1:1 deduplication and group chat business logic
│   │   ├── message.service.ts # Message dispatch, read receipt & last seen logic
│   │   └── user.service.ts    # User management logic
│   ├── controllers/
│   │   ├── chat.controller.ts # Handlers for all chat & message endpoints
│   │   └── user.controller.ts # Handlers for user & chat listing endpoints
│   ├── middlewares/
│   │   ├── errorHandler.ts    # Centralized JSON error handling
│   │   └── validate.ts        # Zod request validation
│   ├── schemas/
│   │   ├── chat.schema.ts     # Request validation schemas for chats & messages
│   │   └── user.schema.ts     # Request validation schemas for users
│   ├── routes/
│   │   ├── chat.routes.ts     # All /chat/* routes
│   │   ├── user.routes.ts     # All /user/* and /users routes
│   │   └── index.ts           # Route aggregator & health check
│   └── tests/
│       └── chat.test.ts       # 21 integration tests
├── .env                       # Environment variables
├── .env.example               # Example environment variables
├── jest.config.js             # Jest test configuration
├── tsconfig.json              # Strict TypeScript configuration
└── package.json
```

---

## 🗄️ Database Schemas

### 1. PostgreSQL Schema

```sql
-- Users
CREATE TABLE users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Chats
CREATE TABLE chats (
    id VARCHAR(64) PRIMARY KEY,
    type VARCHAR(20) NOT NULL CHECK (type IN ('direct', 'group')),
    name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Chat Members
CREATE TABLE chat_members (
    chat_id VARCHAR(64) NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chat_id, user_id)
);
```

### 2. Firestore Document Structure

- **Messages Subcollection**: `chats/{chatId}/messages/{messageId}`
  ```json
  {
    "id": "e98ce541-c744-412f-9ff1-7255b90a7dd7",
    "chatId": "de440618-66cf-4b8a-92ad-feccd67d7d9f",
    "senderId": "user-alice-101",
    "text": "Hello Bob! How are you doing?",
    "timestamp": "2026-10-22T14:05:16.123Z",
    "readBy": ["user-alice-101", "user-bob-102"],
    "readReceipts": {
      "user-alice-101": "2026-10-22T14:05:16.123Z",
      "user-bob-102": "2026-10-22T14:05:16.456Z"
    },
    "isEdited": false,
    "editedAt": null,
    "isDeleted": false,
    "deletedAt": null
  }
  ```

- **Last Seen Subcollection**: `chats/{chatId}/lastSeen/{userId}`
  ```json
  {
    "chatId": "de440618-66cf-4b8a-92ad-feccd67d7d9f",
    "userId": "user-bob-102",
    "messageId": "e98ce541-c744-412f-9ff1-7255b90a7dd7",
    "seenAt": "2026-10-22T14:05:16.456Z"
  }
  ```

---

## 🚀 Setup & Execution

### 1. Prerequisites
- Node.js (v20+)
- PostgreSQL (running locally or remotely)
- (Optional) Firebase project credentials file (`serviceAccountKey.json`) or Firestore emulator. If omitted, the server automatically uses the high-performance in-memory Firestore engine for immediate testing.

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure your PostgreSQL credentials in `.env` match:
```env
PORT=3000
DATABASE_URL=postgresql://postgres:admin@localhost:5432/chat_app_db
PGUSER=postgres
PGPASSWORD=admin
PGHOST=localhost
PGPORT=5432
PGDATABASE=chat_app_db
USE_FIRESTORE_MOCK_FALLBACK=true
```

### 3. Run Migrations & Seed Sample Data
```bash
# Run PostgreSQL migrations
npm run migrate

# Seed sample users (Alice, Bob, Charlie) and chats
npm run seed
```

### 4. Run Automated Tests
```bash
npm test
```
All 21 integration tests covering all requirements and bonus features will execute.

### 5. Start the Server
```bash
# Development (with watch reload)
npm run dev

# Production
npm run build
npm start
```

---

## 📡 API Reference & Examples

### Health Check
```http
GET /health
```
**Response (200 OK):**
```json
{
  "status": "ok",
  "database": {
    "type": "PostgreSQL",
    "healthy": true
  },
  "firestore": {
    "mode": "in-memory-fallback"
  },
  "uptime": 12.34,
  "timestamp": "2026-10-22T14:05:16.000Z"
}
```

---

### 1. Create or Get Chat
Finds an existing 1:1 chat between two users, or creates one atomically in PostgreSQL.

```http
POST /chat/create
Content-Type: application/json

{
  "userAId": "user-alice-101",
  "userBId": "user-bob-102"
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "chatId": "de440618-66cf-4b8a-92ad-feccd67d7d9f",
  "isNew": false
}
```

---

### 2. Send Message
Stores the message in Firestore with timestamp and validates chat membership.

```http
POST /chat/:chatId/message/send
Content-Type: application/json

{
  "senderId": "user-alice-101",
  "text": "Hello Bob! Did you see the new update?"
}
```
**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "c1f7a0b3-9e11-4df6-8d59-33b668021ab0",
    "chatId": "de440618-66cf-4b8a-92ad-feccd67d7d9f",
    "senderId": "user-alice-101",
    "text": "Hello Bob! Did you see the new update?",
    "timestamp": "2026-10-22T14:15:30.000Z",
    "readBy": ["user-alice-101"],
    "readReceipts": {
      "user-alice-101": "2026-10-22T14:15:30.000Z"
    },
    "isEdited": false,
    "editedAt": null,
    "isDeleted": false,
    "deletedAt": null
  }
}
```

---

### 3. Get Messages
Retrieves messages ordered chronologically by timestamp from Firestore.

```http
GET /chat/:chatId/messages?limit=50
```
**Response (200 OK):**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "e98ce541-c744-412f-9ff1-7255b90a7dd7",
      "chatId": "de440618-66cf-4b8a-92ad-feccd67d7d9f",
      "senderId": "user-alice-101",
      "text": "Hello Bob! How are you doing?",
      "timestamp": "2026-10-22T14:05:16.123Z",
      "readBy": ["user-alice-101", "user-bob-102"],
      "readReceipts": {
        "user-alice-101": "2026-10-22T14:05:16.123Z",
        "user-bob-102": "2026-10-22T14:05:16.456Z"
      }
    }
  ]
}
```

---

### 4. Mark Message Read
Updates read receipts in Firestore with the reader's user ID and timestamp.

```http
POST /chat/:chatId/message/:messageId/read
Content-Type: application/json

{
  "userId": "user-bob-102"
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "e98ce541-c744-412f-9ff1-7255b90a7dd7",
    "chatId": "de440618-66cf-4b8a-92ad-feccd67d7d9f",
    "readBy": ["user-alice-101", "user-bob-102"],
    "readReceipts": {
      "user-alice-101": "2026-10-22T14:05:16.123Z",
      "user-bob-102": "2026-10-22T14:16:00.000Z"
    }
  }
}
```

---

### 5. Update Last Seen Message
Updates the last seen pointer per user in Firestore.

```http
POST /chat/:chatId/lastseen
Content-Type: application/json

{
  "userId": "user-bob-102",
  "messageId": "e98ce541-c744-412f-9ff1-7255b90a7dd7"
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "chatId": "de440618-66cf-4b8a-92ad-feccd67d7d9f",
    "userId": "user-bob-102",
    "messageId": "e98ce541-c744-412f-9ff1-7255b90a7dd7",
    "seenAt": "2026-10-22T14:16:30.000Z"
  }
}
```

---

### 6. List User Chats
Queries PostgreSQL for all chats the user belongs to, including all member IDs, roles, and details.

```http
GET /user/:userId/chats
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "de440618-66cf-4b8a-92ad-feccd67d7d9f",
      "type": "direct",
      "name": null,
      "createdAt": "2026-10-22T14:05:16.000Z",
      "updatedAt": "2026-10-22T14:15:30.000Z",
      "members": [
        {
          "userId": "user-alice-101",
          "role": "member",
          "joinedAt": "2026-10-22T14:05:16.000Z",
          "name": "Alice Smith",
          "email": "alice@example.com"
        },
        {
          "userId": "user-bob-102",
          "role": "member",
          "joinedAt": "2026-10-22T14:05:16.000Z",
          "name": "Bob Jones",
          "email": "bob@example.com"
        }
      ]
    }
  ]
}
```

---

### Bonus Features

#### Group Chat Creation
```http
POST /chat/group/create
Content-Type: application/json

{
  "name": "Frontend Team",
  "creatorId": "user-alice-101",
  "memberIds": ["user-bob-102", "user-charlie-103"]
}
```

#### Message Edit
```http
PATCH /chat/:chatId/message/:messageId
Content-Type: application/json

{
  "senderId": "user-alice-101",
  "text": "Corrected message text"
}
```

#### Message Delete
```http
DELETE /chat/:chatId/message/:messageId
Content-Type: application/json

{
  "senderId": "user-alice-101"
}
```
