import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../lib/api/errors';
import {
  fetchProject,
  fetchProjects,
  type Project,
} from '../lib/api/projects';

interface ProjectsState {
  projects: Project[];
  error: string | null;
  isLoading: boolean;
}

const initialProjectsState: ProjectsState = {
  projects: [],
  error: null,
  isLoading: true,
};

export function useProjects() {
  const [state, setState] = useState<ProjectsState>(initialProjectsState);

  const load = useCallback(async (isActive: () => boolean = () => true) => {
    setState((current) => ({ ...current, isLoading: true, error: null }));

    try {
      const projects = await fetchProjects();
      if (isActive()) {
        setState({ projects, error: null, isLoading: false });
      }
    } catch (error) {
      if (isActive()) {
        setState({
          projects: [],
          error: errorMessage(error, 'Projects could not be loaded.'),
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

interface ProjectState {
  project: Project | null;
  error: string | null;
  isLoading: boolean;
}

const initialProjectState: ProjectState = {
  project: null,
  error: null,
  isLoading: true,
};

export function useProject(projectId: string) {
  const [state, setState] = useState<ProjectState>(initialProjectState);

  const load = useCallback(
    async (isActive: () => boolean = () => true) => {
      setState((current) => ({ ...current, isLoading: true, error: null }));

      try {
        const project = await fetchProject(projectId);
        if (isActive()) {
          setState({ project, error: null, isLoading: false });
        }
      } catch (error) {
        if (isActive()) {
          setState({
            project: null,
            error: errorMessage(error, 'This project could not be loaded.'),
            isLoading: false,
          });
        }
      }
    },
    [projectId],
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

  const replaceProject = useCallback((project: Project) => {
    setState({ project, error: null, isLoading: false });
  }, []);

  return { ...state, refetch, replaceProject };
}
