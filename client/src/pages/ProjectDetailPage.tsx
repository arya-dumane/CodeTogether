import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Pencil, Trash2 } from 'lucide-react';
import { ProjectForm, type ProjectFormValues } from '../components/projects/ProjectForm';
import { Button } from '../components/ui/Button';
import { ErrorState } from '../components/ui/ErrorState';
import { Notice } from '../components/ui/Notice';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { useProject } from '../hooks/useProjects';
import { errorMessage } from '../lib/api/errors';
import { deleteProject, updateProject } from '../lib/api/projects';
import { formatDate, formatDateTime } from '../lib/format';

export function ProjectDetailPage() {
  const { projectId = '' } = useParams();
  const { project, error, isLoading, refetch, replaceProject } = useProject(projectId);
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleUpdate = async (values: ProjectFormValues) => {
    const updated = await updateProject(projectId, values);
    replaceProject(updated);
    setIsEditing(false);
    setSuccess('Project updated.');
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteProject(projectId);
      navigate('/dashboard/projects', {
        replace: true,
        state: { flash: 'Project deleted.' },
      });
    } catch (deleteFailure) {
      setDeleteError(errorMessage(deleteFailure, 'The project could not be deleted.'));
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-10">
        <Spinner label="Loading project..." />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="space-y-6">
        <Link
          to="/dashboard/projects"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All projects
        </Link>
        <ErrorState
          title="Project unavailable"
          message={error ?? 'This project could not be found.'}
          onRetry={refetch}
        />
      </div>
    );
  }

  const isBusy = isDeleting;

  return (
    <div className="space-y-6">
      <Link
        to="/dashboard/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All projects
      </Link>

      <PageHeader
        title={project.name}
        description="Project details are private to your account."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setSuccess(null);
                setIsConfirmingDelete(false);
                setIsEditing((current) => !current);
              }}
              disabled={isBusy}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              {isEditing ? 'Close editor' : 'Edit'}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setSuccess(null);
                setDeleteError(null);
                setIsEditing(false);
                setIsConfirmingDelete(true);
              }}
              disabled={isBusy || isConfirmingDelete}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete
            </Button>
          </>
        }
      />

      {success ? <Notice tone="success">{success}</Notice> : null}
      {deleteError ? <Notice tone="error">{deleteError}</Notice> : null}

      {isConfirmingDelete ? (
        <div className="rounded-md border border-[#E7C9BD] bg-accent-soft/50 px-4 py-3" role="alert">
          <p className="text-sm font-semibold text-ink">Delete this project?</p>
          <p className="mt-1 text-sm text-ink-soft">
            Deleting &ldquo;{project.name}&rdquo; cannot be undone.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="danger" size="sm" onClick={() => void handleDelete()} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Deleting...
                </>
              ) : (
                'Yes, delete project'
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsConfirmingDelete(false)}
              disabled={isDeleting}
            >
              Keep project
            </Button>
          </div>
        </div>
      ) : null}

      {isEditing ? (
        <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="edit-project-heading">
          <h2 id="edit-project-heading" className="text-base font-semibold text-ink">
            Edit project
          </h2>
          <p className="mt-1 text-sm text-muted">Update the name or description, then save.</p>
          <div className="mt-5 max-w-2xl">
            <ProjectForm
              initialValues={{ name: project.name, description: project.description }}
              submitLabel="Save changes"
              onSubmit={handleUpdate}
              onCancel={() => setIsEditing(false)}
            />
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section
          className="rounded-lg border border-line bg-surface p-6"
          aria-labelledby="project-description-heading"
        >
          <h2 id="project-description-heading" className="text-base font-semibold text-ink">
            Description
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
            {project.description || 'No description yet.'}
          </p>
        </section>

        <aside
          className="rounded-lg border border-line bg-surface p-6"
          aria-labelledby="project-meta-heading"
        >
          <h2 id="project-meta-heading" className="text-base font-semibold text-ink">
            Details
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted">Owner</dt>
              <dd className="mt-0.5 text-ink-soft">You</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Created</dt>
              <dd className="mt-0.5 text-ink-soft">{formatDate(project.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Last updated</dt>
              <dd className="mt-0.5 text-ink-soft">{formatDateTime(project.updatedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Project ID</dt>
              <dd className="mt-0.5 break-all font-mono text-xs text-ink-soft">{project.id}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
