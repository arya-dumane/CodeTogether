import { api } from './client';

export interface VersionSummary {
  id: string;
  versionNumber: number;
  description: string;
  type: 'automatic' | 'manual' | 'restore';
  createdAt: string;
}

export interface VersionDetail extends VersionSummary {
  snapshot: Buffer;
}

export interface ListVersionsResponse {
  versions: VersionSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface CreateManualVersionInput {
  roomId: string;
  documentId: string;
  description: string;
}

export interface RestoreVersionInput {
  roomId: string;
  documentId: string;
  versionId: string;
}

export async function fetchVersions(
  roomId: string,
  documentId: string,
  page = 1,
  limit = 20,
): Promise<ListVersionsResponse> {
  const data = await api.get<ListVersionsResponse>(
    `/api/v1/versions/${roomId}/${documentId}?page=${page}&limit=${limit}`,
  );
  return data;
}

export async function fetchVersion(
  roomId: string,
  documentId: string,
  versionId: string,
): Promise<VersionDetail> {
  const data = await api.get<VersionDetail>(
    `/api/v1/versions/${roomId}/${documentId}/${versionId}`,
  );
  return data;
}

export async function compareVersions(
  roomId: string,
  documentId: string,
  versionId1: string,
  versionId2: string,
): Promise<{
  version1: VersionSummary;
  version2: VersionSummary;
}> {
  const data = await api.get<{
    version1: VersionSummary;
    version2: VersionSummary;
  }>(`/api/v1/versions/compare?roomId=${roomId}&documentId=${documentId}&versionId1=${versionId1}&versionId2=${versionId2}`);
  return data;
}

export async function getVersionDetail(
  roomId: string,
  documentId: string,
  versionId: string,
): Promise<VersionDetail> {
  const data = await api.get<VersionDetail>(
    `/api/v1/versions/${roomId}/${documentId}/${versionId}`,
  );
  return data;
}

export async function createManualVersion(
  input: CreateManualVersionInput,
): Promise<VersionSummary> {
  const data = await api.post<VersionSummary>(
    `/api/v1/versions/${input.roomId}/${input.documentId}`,
    input,
  );
  return data;
}

export async function restoreVersion(
  input: RestoreVersionInput,
): Promise<{ message: string; newVersionNumber: number; restoredVersion: number }> {
  const data = await api.post<
    { message: string; newVersionNumber: number; restoredVersion: number }
  >(`/api/v1/versions/${input.roomId}/${input.documentId}/restore`, input);
  return data;
}