import { Link } from 'react-router-dom';
import { ArrowUpRight, FolderKanban, Route, Users } from 'lucide-react';
import { Badge } from '../ui/Badge';
import type { RoomSummary } from '../../lib/api/rooms';
import { formatDateTime } from '../../lib/format';

interface RoomCardProps {
  room: RoomSummary;
}

export function RoomCard({ room }: RoomCardProps) {
  return (
    <Link
      to={`/dashboard/rooms/${room.id}`}
      className="group flex h-full flex-col rounded-lg border border-line bg-surface p-5 transition-colors hover:border-primary/40 hover:bg-primary-soft/20"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-dark">
          <Users className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Badge tone={room.status === 'active' ? 'success' : 'warning'}>
            {room.status === 'active' ? 'Active' : 'Archived'}
          </Badge>
          <Badge tone="outline">{room.viewerRole === 'owner' ? 'Owner' : 'Member'}</Badge>
          <ArrowUpRight
            className="h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-primary"
            aria-hidden="true"
          />
        </div>
      </div>

      <h2 className="mt-4 truncate text-base font-semibold text-ink">{room.name}</h2>
      <p className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-muted">
        {room.description || 'No description yet.'}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          {room.memberCount} {room.memberCount === 1 ? 'member' : 'members'}
        </span>
        {room.hasLinkedProject ? (
          <span className="inline-flex items-center gap-1.5">
            <FolderKanban className="h-3.5 w-3.5" aria-hidden="true" />
            Project
          </span>
        ) : null}
        {room.hasLinkedLearningPath ? (
          <span className="inline-flex items-center gap-1.5">
            <Route className="h-3.5 w-3.5" aria-hidden="true" />
            Path
          </span>
        ) : null}
      </div>

      <p className="mt-2 text-xs text-muted">Updated {formatDateTime(room.updatedAt)}</p>
    </Link>
  );
}
