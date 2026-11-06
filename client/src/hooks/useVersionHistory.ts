import { useEffect, useState } from 'react';
import {
  fetchVersions,
  fetchVersion,
  compareVersions,
  createManualVersion,
  restoreVersion,
  getVersionDetail,
} from '../lib/api/versions';

interface VersionSummary {
  id: string;
  versionNumber: number;
  description: string;
  type: 'automatic' | 'manual' | 'restore';
  createdAt: string;
}

interface VersionContent {
  versionId: string;
  versionNumber: number;
  description: string;
  type: 'automatic' | 'manual' | 'restore';
  createdAt: string;
  snapshot: Buffer;
}

interface VersionHistoryHookReturn {
  versions: VersionSummary[];
  loading: boolean;
  error: string | null;
  currentVersion: VersionSummary | null;
  selectedVersion: VersionSummary | null;
  isRestoreConfirming: boolean;
  isSavingVersion: boolean;
  success: string | null;
  versionError: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  loadVersions: (page?: number, limit?: number) => Promise<void>;
  loadVersion: (versionId: string) => Promise<VersionSummary | null>;
  createNewVersion: (description: string) => Promise<void>;
  restoreSelectedVersion: () => Promise<void>;
  selectVersion: (version: VersionSummary) => void;
  deleteVersion: (versionId: string) => Promise<void>;
  compareVersions: (versionId1: string, versionId2: string) => Promise<{
    version1Content: VersionContent;
    version2Content: VersionContent;
  }>;
}

function useVersionHistory(roomId: string, documentId: string): VersionHistoryHookReturn {
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState<VersionSummary | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<VersionSummary | null>(null);
  const [isRestoreConfirming, setIsRestoreConfirming] = useState<boolean>(false);
  const [isSavingVersion, setIsSavingVersion] = useState<boolean>(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    pages: number;
  }>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  const loadVersions = async (page = 1, limit = 20) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVersions(roomId, documentId, page, limit);
      setVersions(data.versions);
      setLoading(false);
      setPagination({
        page: data.pagination.page,
        limit: data.pagination.limit,
        total: data.pagination.total,
        pages: data.pagination.pages,
      });
    } catch (err: any) {
      setError(err.message ?? 'Failed to load versions');
      setLoading(false);
    }
  };

  const loadVersion = async (versionId: string): Promise<VersionSummary | null> => {
    setLoading(true);
    try {
      const data = await fetchVersion(roomId, documentId, versionId);
      setCurrentVersion(data);
      return data;
    } catch (err: any) {
      setError(err.message ?? 'Failed to load version');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const createNewVersion = async (description: string) => {
    if (!description.trim()) {
      setVersionError('Description is required');
      return;
    }
    setIsSavingVersion(true);
    setSuccess(null);
    setVersionError(null);
    try {
      await createManualVersion({ roomId, documentId, description });
      setIsSavingVersion(false);
      setSuccess('Version saved.');
      await loadVersions();
    } catch (err: any) {
      setIsSavingVersion(false);
      setVersionError(err.message ?? 'Failed to save version');
    }
  };

  const restoreSelectedVersion = async () => {
    if (!selectedVersion) return;
    setIsRestoreConfirming(true);
    try {
      await restoreVersion({ roomId, documentId, versionId: selectedVersion.id });
      setSuccess('Version restored.');
      await loadVersions();
      setSelectedVersion(null);
    } catch (err: any) {
      setVersionError(err.message ?? 'Failed to restore version');
    } finally {
      setIsRestoreConfirming(false);
    }
  };

  const selectVersion = (version: VersionSummary) => {
    setSelectedVersion(version);
  };

  const deleteVersion = async () => {
    await loadVersions();
  };

  const compareVersions = async (versionId1: string, versionId2: string) => {
    setLoading(true);
    setError(null);
    try {
      const { version1, version2 } = await compareVersions(
        roomId,
        documentId,
        versionId1,
        versionId2
      );
      const version1Detail = await getVersionDetail(roomId, documentId, versionId1);
      const version2Detail = await getVersionDetail(roomId, documentId, versionId2);
      return {
        version1Content: {
          versionId: versionId1,
          versionNumber: version1.versionNumber,
          description: version1.description,
          type: version1.type,
          createdAt: version1.createdAt,
          snapshot: version1Detail.snapshot,
        },
        version2Content: {
          versionId: versionId2,
          versionNumber: version2.versionNumber,
          description: version2.description,
          type: version2.type,
          createdAt: version2.createdAt,
          snapshot: version2Detail.snapshot,
        },
      };
    } catch (err: any) {
      setError(err.message ?? 'Failed to compare versions');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVersions();
  }, [roomId, documentId]);

  return {
    versions,
    loading,
    error,
    currentVersion,
    selectedVersion,
    isRestoreConfirming,
    isSavingVersion,
    success,
    versionError,
    pagination,
    loadVersions,
    loadVersion,
    createNewVersion,
    restoreSelectedVersion,
    selectVersion,
    deleteVersion,
    compareVersions,
  };
}

export { useVersionHistory };