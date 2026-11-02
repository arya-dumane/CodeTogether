import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, Loader2, Plus, Users } from 'lucide-react';
import { RoomCard } from '../components/rooms/RoomCard';
import { RoomForm, type RoomFormValues } from '../components/rooms/RoomForm';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { FormField } from '../components/ui/FormField';
import { Notice } from '../components/ui/Notice';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { useLearningPaths } from '../hooks/useLearningPaths';
import { useProjects } from '../hooks/useProjects';
import { useRooms } from '../hooks/useRooms';
import { errorMessage } from '../lib/api/errors';
import { createRoom, joinRoom } from '../lib/api/rooms';

interface RoomsLocationState {
  flash?: string;
}

type PageMode = 'create' | 'join' | null;

export function RoomsPage() {
  const { rooms, error, isLoading, refetch } = useRooms();
  const { projects } = useProjects();
  const { paths } = useLearningPaths();
  const location = useLocation();
  const navigate = useNavigate();
  const flash = (location.state as RoomsLocationState | null)?.flash ?? null;

  const [mode, setMode] = useState<PageMode>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  const openCreate = () => {
    setMode('create');
    setJoinError(null);
  };

  const openJoin = () => {
    setMode('join');
    setJoinError(null);
  };

  const handleCreate = async (values: RoomFormValues) => {
    const room = await createRoom({
      name: values.name,
      description: values.description,
      projectId: values.projectId || null,
      learningPathId: values.learningPathId || null,
    });

    navigate(`/dashboard/rooms/${room.id}`, {
      state: { flash: `Created "${room.name}". Share the invite code to bring people in.` },
    });
  };

  const handleJoin = async () => {
    const code = inviteCode.trim();

    if (!code) {
      setJoinError('Enter an invite code.');
      return;
    }

    setJoinError(null);
    setIsJoining(true);

    try {
      const result = await joinRoom(code);
      navigate(`/dashboard/rooms/${result.room.id}`, {
        state: {
          flash: result.alreadyMember
            ? `You are already a member of "${result.room.name}".`
            : `Joined "${result.room.name}".`,
        },
      });
    } catch (joinFailure) {
      setJoinError(errorMessage(joinFailure, 'The invite code could not be used.'));
      setIsJoining(false);
    }
  };

  const showEmptyState = !isLoading && !error && rooms.length === 0 && mode === null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coding Rooms"
        description="Create a private room, invite people with a code, and keep a project or learning path in view while you work together."
        actions={
          <>
            <Badge tone="success">Phase 4A</Badge>
            <Button variant="secondary" onClick={openJoin}>
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Join room
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New room
            </Button>
          </>
        }
      />

      {flash ? <Notice tone="success">{flash}</Notice> : null}

      {mode === 'create' ? (
        <section
          className="rounded-lg border border-line bg-surface p-6"
          aria-labelledby="create-room-heading"
        >
          <h2 id="create-room-heading" className="text-base font-semibold text-ink">
            Create a room
          </h2>
          <p className="mt-1 text-sm text-muted">
            Name the room and, if you want, link work that everyone can see. You can change these
            later.
          </p>
          <div className="mt-5 max-w-2xl">
            <RoomForm
              projects={projects}
              learningPaths={paths}
              submitLabel="Create room"
              onSubmit={handleCreate}
              onCancel={() => setMode(null)}
            />
          </div>
        </section>
      ) : null}

      {mode === 'join' ? (
        <section
          className="rounded-lg border border-line bg-surface p-6"
          aria-labelledby="join-room-heading"
        >
          <h2 id="join-room-heading" className="text-base font-semibold text-ink">
            Join with an invite code
          </h2>
          <p className="mt-1 text-sm text-muted">
            Ask the room owner or an existing member for the current code.
          </p>
          <form
            className="mt-5 flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              void handleJoin();
            }}
          >
            <div className="flex-1">
              <FormField
                label="Invite code"
                name="inviteCode"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={inviteCode}
                disabled={isJoining}
                error={joinError ?? undefined}
                onChange={(event) => {
                  setInviteCode(event.target.value);
                  setJoinError(null);
                }}
              />
            </div>
            <Button type="submit" disabled={isJoining} className="sm:mb-0.5">
              {isJoining ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Joining...
                </>
              ) : (
                'Join room'
              )}
            </Button>
          </form>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setMode(null)}
            disabled={isJoining}
          >
            Cancel
          </Button>
        </section>
      ) : null}

      {isLoading ? (
        <div className="py-6">
          <Spinner label="Loading rooms..." />
        </div>
      ) : null}

      {error ? (
        <ErrorState title="Could not load rooms" message={error} onRetry={refetch} />
      ) : null}

      {!isLoading && !error && rooms.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <Badge tone="outline">
            {rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}
          </Badge>
        </div>
      ) : null}

      {showEmptyState ? (
        <EmptyState
          icon={Users}
          title="No rooms yet"
          description="Create a room to invite a peer or mentor, or join someone else's room with an invite code."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create a room
            </Button>
          }
        />
      ) : null}

      {!isLoading && !error && rooms.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => (
            <li key={room.id} className="min-w-0">
              <RoomCard room={room} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
