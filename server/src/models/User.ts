import { Schema, model, type HydratedDocument } from 'mongoose';

export interface UserShape {
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<UserShape>;

const userSchema = new Schema<UserShape>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
  },
  { timestamps: true },
);

userSchema.set('toJSON', {
  transform: (_document, value) => {
    const output = value as unknown as Record<string, unknown>;
    delete output.passwordHash;
    delete output.__v;
    return output;
  },
});

export const User = model<UserShape>('User', userSchema);

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export function serializeUser(user: UserDocument): PublicUser {
  return {
    id: user._id.toString(),
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
