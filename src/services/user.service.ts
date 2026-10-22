import { userRepository, UserRepository } from '../repositories/user.repository';
import { CreateUserInput, User } from '../types/user';

export class UserService {
  constructor(private userRepo: UserRepository = userRepository) {}

  async createUser(input: CreateUserInput): Promise<User> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) {
      throw new Error(`User with email "${input.email}" already exists`);
    }
    return this.userRepo.create(input);
  }

  async getUserById(id: string): Promise<User> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new Error(`User with ID "${id}" not found`);
    }
    return user;
  }

  async listUsers(): Promise<User[]> {
    return this.userRepo.list();
  }
}

export const userService = new UserService();
