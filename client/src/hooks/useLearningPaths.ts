import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../lib/api/errors';
import {
  fetchLearningPath,
  fetchLearningPaths,
  fetchLearningProgress,
  fetchMyLearningProgress,
  type LearningPath,
  type LearningPathSummary,
  type LearningProgress,
  type LearningProgressEntry,
} from '../lib/api/learningPaths';

interface LearningPathsState {
  paths: LearningPathSummary[];
  error: string | null;
  isLoading: boolean;
}

const initialPathsState: LearningPathsState = {
  paths: [],
  error: null,
  isLoading: true,
};

export function useLearningPaths() {
  const [state, setState] = useState<LearningPathsState>(initialPathsState);

  const load = useCallback(async (isActive: () => boolean = () => true) => {
    setState((current) => ({ ...current, isLoading: true, error: null }));

    try {
      const paths = await fetchLearningPaths();
      if (isActive()) {
        setState({ paths, error: null, isLoading: false });
      }
    } catch (error) {
      if (isActive()) {
        setState({
          paths: [],
          error: errorMessage(error, 'Learning paths could not be loaded.'),
          isLoading: false,
        });
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    void load(() => active);

    return () => {
      active = false;
    };
  }, [load]);

  const refetch = useCallback(() => {
    void load();
  }, [load]);

  return { ...state, refetch };
}

interface LearningPathState {
  path: LearningPath | null;
  progress: LearningProgress | null;
  error: string | null;
  isLoading: boolean;
}

const initialPathState: LearningPathState = {
  path: null,
  progress: null,
  error: null,
  isLoading: true,
};

export function useLearningPath(pathId: string) {
  const [state, setState] = useState<LearningPathState>(initialPathState);

  const load = useCallback(
    async (isActive: () => boolean = () => true) => {
      setState((current) => ({ ...current, isLoading: true, error: null }));

      try {
        const [path, progress] = await Promise.all([
          fetchLearningPath(pathId),
          fetchLearningProgress(pathId),
        ]);

        if (isActive()) {
          setState({ path, progress, error: null, isLoading: false });
        }
      } catch (error) {
        if (isActive()) {
          setState({
            path: null,
            progress: null,
            error: errorMessage(error, 'This learning path could not be loaded.'),
            isLoading: false,
          });
        }
      }
    },
    [pathId],
  );

  useEffect(() => {
    let active = true;
    void load(() => active);

    return () => {
      active = false;
    };
  }, [load]);

  const refetch = useCallback(() => {
    void load();
  }, [load]);

  const replaceProgress = useCallback((progress: LearningProgress) => {
    setState((current) => ({ ...current, progress }));
  }, []);

  return { ...state, refetch, replaceProgress };
}

interface MyProgressState {
  enrollments: LearningProgressEntry[];
  error: string | null;
  isLoading: boolean;
}

const initialMyProgressState: MyProgressState = {
  enrollments: [],
  error: null,
  isLoading: true,
};

export function useMyLearningProgress() {
  const [state, setState] = useState<MyProgressState>(initialMyProgressState);

  const load = useCallback(async (isActive: () => boolean = () => true) => {
    setState((current) => ({ ...current, isLoading: true, error: null }));

    try {
      const enrollments = await fetchMyLearningProgress();
      if (isActive()) {
        setState({ enrollments, error: null, isLoading: false });
      }
    } catch (error) {
      if (isActive()) {
        setState({
          enrollments: [],
          error: errorMessage(error, 'Your learning progress could not be loaded.'),
          isLoading: false,
        });
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    void load(() => active);

    return () => {
      active = false;
    };
  }, [load]);

  const refetch = useCallback(() => {
    void load();
  }, [load]);

  return { ...state, refetch };
}
