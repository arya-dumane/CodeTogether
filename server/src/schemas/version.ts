import z from 'zod';

// Schema for creating a manual version
export const createManualVersionSchema = z.object({
  roomId: z.string().nonempty('Room ID is required'),
  documentId: z.string().nonempty('Document ID is required'),
  description: z.string().nonempty('Description is required').min(1),
  type: z.enum(['manual']).default('manual'),
});

// Schema for listing versions with pagination
export const listVersionsSchema = z.object({
  roomId: z.string().nonempty('Room ID is required'),
  documentId: z.string().nonempty('Document ID is required'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

// Schema for viewing a specific version
export const getVersionSchema = z.object({
  roomId: z.string().nonempty('Room ID is required'),
  documentId: z.string().nonempty('Document ID is required'),
  versionId: z.string().nonempty('Version ID is required'),
});

// Schema for comparing two versions
export const compareVersionsSchema = z.object({
  roomId: z.string().nonempty('Room ID is required'),
  documentId: z.string().nonempty('Document ID is required'),
  versionId1: z.string().nonempty('First version ID is required'),
  versionId2: z.string().nonempty('Second version ID is required'),
});

// Schema for restoring a version
export const restoreVersionSchema = z.object({
  roomId: z.string().nonempty('Room ID is required'),
  documentId: z.string().nonempty('Document ID is required'),
  versionId: z.string().nonempty('Version ID is required'),
});

// Export all schemas
export type CreateManualVersionInput = z.infer<typeof createManualVersionSchema>;
export type ListVersionsInput = z.infer<typeof listVersionsSchema>;
export type GetVersionInput = z.infer<typeof getVersionSchema>;
export type CompareVersionsInput = z.infer<typeof compareVersionsSchema>;
export type RestoreVersionInput = z.infer<typeof restoreVersionSchema>;