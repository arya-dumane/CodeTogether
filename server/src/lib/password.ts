import bcrypt from 'bcryptjs';

const PASSWORD_ROUNDS = 12;
const DUMMY_PASSWORD_HASH = '$2b$12$oalwssIE7iD/N67I0ls3iO2bx4fvtcD66IpF2kugDWc/c.Cy9U056';

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_ROUNDS);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export async function performDummyPasswordCheck(password: string): Promise<void> {
  await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
}
