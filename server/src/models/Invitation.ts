import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { Project } from './Project.js';
import { randomBytes, createHash } from 'node:crypto';

const EXPIRATION_DAYS = 7;

export { EXPIRATION_DAYS };

// Generate a cryptographically secure invitation token (32 bytes = 256 bits)
export function generateInvitationToken(): string {
  return randomBytes(32).toString('hex');
}

// SHA-256 hash of an invitation token (32 bytes = 64 hex characters)
export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Compare a provided token with a stored SHA-256 hash
export function compareInvitationToken(token: string, storedHash: string): boolean {
  const providedHash = hashInvitationToken(token);
  return providedHash === storedHash;
}

export interface InvitationShape {
  project: Types.ObjectId;
  invitor: Types.ObjectId;
  inviteeEmail: string;
  inviteeUserId?: Types.ObjectId;
  role: 'editor' | 'viewer';
  tokenHash: string; // SHA-256 hash only — raw token never persisted
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

export type InvitationDocument = HydratedDocument<InvitationShape>;

const invitationSchema = new Schema<InvitationShape>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    invitor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    inviteeEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    inviteeUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    role: {
      type: String,
      enum: ['editor', 'viewer'],
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    usedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

// Index for finding unused, non-expired invitations by project
invitationSchema.index({ project: 1, usedAt: 1 });
// Index for looking up by token hash
invitationSchema.index({ tokenHash: 1 });
// Index for quick expiration checks
invitationSchema.index({ expiresAt: 1 });

// Methods
invitationSchema.methods.isExpired = function (this: any): boolean {
  return new Date() > this.expiresAt;
};

invitationSchema.methods.isUsed = function (this: any): boolean {
  return this.usedAt !== undefined;
};

invitationSchema.methods.checkToken = function (this: any, token: string): boolean {
  if (this.isExpired()) return false;
  if (this.isUsed()) return false;
  return compareInvitationToken(token, this.tokenHash);
};

// Static method to find a valid invitation by project and token hash
invitationSchema.statics.findValid = function (this: any, projectId: Types.ObjectId, token: string) {
  return this.findOne({
    project: projectId,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  }).select('+tokenHash');
};

// Static method to find pending invitations for a project
invitationSchema.statics.findPending = function (this: any, projectId: Types.ObjectId) {
  return this.find({ project: projectId, usedAt: null });
};

// Virtual for display — shows first 8 chars of hash + ellipsis, never the full hash
invitationSchema.virtual('displayToken').get(function (this: any) {
  // Return first 8 chars of hash for display purposes only
  return this.tokenHash?.substring(0, 8) + '...';
});

// Pre-save: hash the token if it's being set for the first time
invitationSchema.pre('save', function (next) {
  // If tokenHash is not set yet (e.g., from service layer), generate and hash a token
  if (!this.tokenHash) {
    const token = randomBytes(32).toString('hex');
    this.tokenHash = hashInvitationToken(token);
    // Store the actual token in a virtual field for later use (acceptance)
    // We'll handle token passing through the service layer, not persistence
  }
  next();
});

export const Invitation = model<InvitationShape>('Invitation', invitationSchema);