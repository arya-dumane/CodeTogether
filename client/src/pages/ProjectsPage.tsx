import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FolderKanban, Plus } from 'lucide-react';
import { ProjectCard } from '../components/projects/ProjectCard';
import { ProjectForm, type ProjectFormValues } from '../components/projects/ProjectForm';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Notice } from '../components/ui/Notice';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { useProjects } from '../hooks/useProjects';
import { createProject } from '../lib/api/projects';

interface ProjectsLocationState {
  flash?: string;
}

export function ProjectsPage() {
  const { projects, error, isLoading, refetch } = useProjects();
  const location = useLocation();
  const flash = (location.state as ProjectsLocationState | null)?.flash ?? null;
  const [isCreating, setIsCreating] = useState(false);
  const [success, setSuccess] = useState<string | null>(flash);

  const openCreateForm = () => {
    setSuccess(null);
    setIsCreating(true);
  };

  const handleCreate = async (values: ProjectFormValues) => {
    const project = await createProject(values);
    setSuccess(`Created "${project.name}".`);
    setIsCreating(false);
    refetch();
  };

  const showEmptyState = !isLoading && !error && projects.length === 0 && !isCreating;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Create and manage the projects tied to your account. Every project is private to you until sharing arrives."
        actions={
          <>
            <Badge tone="success">Phase 3</Badge>
            <Button onClick={openCreateForm} disabled={isCreating}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New project
            </Button>
          </>
        }
      />

      {success ? <Notice tone="success">{success}</Notice> : null}

      {isCreating ? (
        <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="create-project-heading">
          <h2 id="create-project-heading" className="text-base font-semibold text-ink">
            Create a project
          </h2>
          <p className="mt-1 text-sm text-muted">
            Give the project a clear name. You can add or change the description later.
          </p>
          <div className="mt-5 max-w-2xl">
            <ProjectForm
              submitLabel="Create project"
              onSubmit={handleCreate}
              onCancel={() => setIsCreating(false)}
            />
          </div>
        </section>
      ) : null}

      {isLoading ? (
        <div className="py-6">
          <Spinner label="Loading projects..." />
        </div>
      ) : null}

      {error ? (
        <ErrorState title="Could not load projects" message={error} onRetry={refetch} />
      ) : null}

      {showEmptyState ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Projects are your home for the work you build. Create the first one to get started."
          action={
            <Button onClick={openCreateForm}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create a project
            </Button>
          }
        />
      ) : null}

      {!isLoading && !error && projects.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id} className="min-w-0">
              <ProjectCard project={project} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
