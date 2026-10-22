import { query } from '../db/pool';
import { User, CreateUserInput } from '../types/user';
import crypto from 'crypto';

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    const res = await query<{
      id: string;
      name: string;
      email: string;
      created_at: Date;
    }>('SELECT id, name, email, created_at FROM users WHERE id = $1', [id]);

    if (!res.rows[0]) return null;

    const row = res.rows[0];
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      createdAt: row.created_at,
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    const res = await query<{
      id: string;
      name: string;
      email: string;
      created_at: Date;
    }>('SELECT id, name, email, created_at FROM users WHERE email = $1', [email]);

    if (!res.rows[0]) return null;

    const row = res.rows[0];
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      createdAt: row.created_at,
    };
  }

  async exists(id: string): Promise<boolean> {
    const res = await query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM users WHERE id = $1) as exists',
      [id]
    );
    return res.rows[0]?.exists ?? false;
  }

  async create(input: CreateUserInput): Promise<User> {
    const id = input.id || crypto.randomUUID();
    const res = await query<{
      id: string;
      name: string;
      email: string;
      created_at: Date;
    }>(
      `INSERT INTO users (id, name, email)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [id, input.name, input.email]
    );

    const row = res.rows[0]!;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      createdAt: row.created_at,
    };
  }

  async list(limit = 100): Promise<User[]> {
    const res = await query<{
      id: string;
      name: string;
      email: string;
      created_at: Date;
    }>('SELECT id, name, email, created_at FROM users ORDER BY created_at DESC LIMIT $1', [
      limit,
    ]);

    return res.rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      createdAt: row.created_at,
    }));
  }
}

export const userRepository = new UserRepository();
