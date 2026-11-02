import { Link } from 'react-router-dom';
import { ArrowUpRight, FolderKanban } from 'lucide-react';
import type { Project } from '../../lib/api/projects';
import { formatDateTime } from '../../lib/format';

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      to={`/dashboard/projects/${project.id}`}
      className="group flex h-full flex-col rounded-lg border border-line bg-surface p-5 transition-colors hover:border-primary/40 hover:bg-primary-soft/20"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-dark">
          <FolderKanban className="h-4 w-4" aria-hidden="true" />
        </span>
        <ArrowUpRight
          className="h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-primary"
          aria-hidden="true"
        />
      </div>

      <h2 className="mt-4 truncate text-base font-semibold text-ink">{project.name}</h2>
      <p className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-muted">
        {project.description || 'No description yet.'}
      </p>

      <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
        Updated {formatDateTime(project.updatedAt)}
      </p>
    </Link>
  );
}
