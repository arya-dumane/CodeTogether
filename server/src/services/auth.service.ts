import { isDuplicateKeyError } from '../db/mongoErrors.js';
import { AppError } from '../errors/AppError.js';
import { performDummyPasswordCheck, hashPassword, verifyPassword } from '../lib/password.js';
import { User, type UserDocument } from '../models/User.js';
import type { LoginInput, RegisterInput } from '../schemas/auth.js';

function invalidCredentials(): AppError {
  return new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
}

export async function registerUser(input: RegisterInput): Promise<UserDocument> {
  const passwordHash = await hashPassword(input.password);

  try {
    return await User.create({
      email: input.email,
      displayName: input.displayName,
      passwordHash,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError(
        409,
        'REGISTRATION_CONFLICT',
        'An account could not be created with those details',
      );
    }
    throw error;
  }
}

export async function authenticateUser(input: LoginInput): Promise<UserDocument> {
  const user = await User.findOne({ email: input.email }).select('+passwordHash');

  if (!user) {
    await performDummyPasswordCheck(input.password);
    throw invalidCredentials();
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);

  if (!passwordMatches) {
    throw invalidCredentials();
  }

  return user;
}

export async function findUserById(userId: string): Promise<UserDocument> {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  }

  return user;
}
