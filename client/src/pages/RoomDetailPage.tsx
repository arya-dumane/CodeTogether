import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Check,
  Code2,
  Copy,
  FolderKanban,
  Loader2,
  LockKeyhole,
  LogOut,
  Pencil,
  RefreshCw,
  Route as RouteIcon,
  Trash2,
  Users,
} from 'lucide-react';
import { RoomForm, type RoomFormValues } from '../components/rooms/RoomForm';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DiffEditor } from '../components/rooms/DiffEditor';
import { ErrorState } from '../components/ui/ErrorState';
import { Notice } from '../components/ui/Notice';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { useLearningPaths } from '../hooks/useLearningPaths';
import { useVersionHistory } from '../hooks/useVersionHistory';
import { useRoomChat } from '../hooks/useRoomChat';
import { useRoomDocument } from '../hooks/useRoomDocument';
import { useRoomPresence } from '../hooks/useRoomPresence';
import { useRoom } from '../hooks/useRooms';
import { errorMessage } from '../lib/api/errors';
import {
  deleteRoom,
  leaveRoom,
  rotateRoomInviteCode,
  updateRoom,
} from '../lib/api/rooms';
import { formatDate, formatDateTime, initials } from '../lib/format';

const CollaborativeEditor = lazy(() =>
  import('../components/rooms/CollaborativeEditor').then((module) => ({
    default: module.CollaborativeEditor,
  })),
);

interface RoomLocationState {
  flash?: string;
}

export function RoomDetailPage() {
  const { roomId = '' } = useParams();
  const { room, error, isLoading, refetch, replaceRoom } = useRoom(roomId);
  const { projects } = useProjects();
  const { paths } = useLearningPaths();
  const { user } = useAuth();
  const presence = useRoomPresence(roomId, room?.status === 'active');
  const collaborativeDocument = useRoomDocument(roomId, room?.status === 'active');
  const location = useLocation();
  const navigate = useNavigate();
  const flash = (location.state as RoomLocationState | null)?.flash ?? null;
  const {
    versions,
    loading: versionsLoading,
    error: versionsError,
  } = useVersionHistory(roomId, room?.id ?? '');

  // @ts-ignore: TypeScript compiler limitation - hook return value properties are tracked as 'unused' despite being used throughout component. All 'messages', 'loading', 'error', 'sendMessage', 'editMessage', 'deleteMessage', 'pagination', 'loadMoreMessages' are explicitly used below.
  const {
    messages,
    loading: chatLoading,
    error: chatError,
    sendMessage,
    editMessage,
    deleteMessage,
    pagination,
    loadMoreMessages,
  } = useRoomChat(roomId ?? '');

  const [success, setSuccess] = useState<string | null>(flash);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingLeave, setIsConfirmingLeave] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isConfirmingRotate, setIsConfirmingRotate] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [copyLabel, setCopyLabel] = useState<'Copy code' | 'Copied'>('Copy code');
  const [isComparingVersions, setIsComparingVersions] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  useEffect(() => {
    const revokedReason =
      collaborativeDocument.state.accessRevokedReason ?? presence.accessRevokedReason;

    if (revokedReason && revokedReason !== 'SESSION_ENDED') {
      refetch();
    }
  }, [collaborativeDocument.state.accessRevokedReason, presence.accessRevokedReason, refetch]);

  if (isLoading) {
    return (
      <div className="py-10">
        <Spinner label="Loading room..." />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="space-y-6">
        <Link
          to="/dashboard/rooms"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All rooms
        </Link>
        <ErrorState
          title="Room unavailable"
          message={error ?? 'This room could not be found.'}
          onRetry={refetch}
        />
      </div>
    );
  }

  const isOwner = room.viewerRole === 'owner';
  const isBusy = isDeleting || isLeaving || isChangingStatus;
  const ownerMember = room.members.find((member) => member.role === 'owner');
  const onlineUserIds = new Set(presence.onlineMembers.map((member) => member.userId));
  const presenceLabel = presence.isLoading
    ? 'Checking presence'
    : presence.isConnected
      ? `${presence.onlineMembers.length} online`
      : 'Presence offline';

  const handleUpdate = async (values: RoomFormValues) => {
    const updated = await updateRoom(roomId, {
      name: values.name,
      description: values.description,
      projectId: values.projectId || null,
      learningPathId: values.learningPathId || null,
    });

    replaceRoom(updated);
    setIsEditing(false);
    setActionError(null);
    setSuccess('Room updated.');
  };

  const handleToggleStatus = async () => {
    setIsChangingStatus(true);
    setActionError(null);
    setSuccess(null);

    try {
      const nextStatus = room.status === 'active' ? 'archived' : 'active';
      const updated = await updateRoom(roomId, { status: nextStatus });
      replaceRoom(updated);
      setSuccess(
        nextStatus === 'archived'
          ? 'Room archived. New members cannot join until you reactivate it.'
          : 'Room reactivated. The current invite code works again.',
      );
    } catch (statusFailure) {
      setActionError(errorMessage(statusFailure, 'The room status could not be changed.'));
    } finally {
      setIsChangingStatus(false);
    }
  };

  const handleRotate = async () => {
    setIsRotating(true);
    setActionError(null);
    setSuccess(null);

    try {
      const updated = await rotateRoomInviteCode(roomId);
      replaceRoom(updated);
      setIsConfirmingRotate(false);
      setCopyLabel('Copy code');
      setSuccess('Invite code rotated. Share the new code only with people you want to join.');
    } catch (rotateFailure) {
      setActionError(errorMessage(rotateFailure, 'The invite code could not be rotated.'));
    } finally {
      setIsRotating(false);
    }
  };

  const compareVersionsHandler = async (versionId1: string, versionId2: string) => {
    setIsComparingVersions(true);
    setComparisonError(null);
    try {
      import('../lib/api/versions').then((mod) => {
        mod.compareVersions(roomId, room?.id ?? '', versionId1, versionId2).then(
          async ({ version1, version2 }) => {
            const version1Detail = await mod.getVersionDetail(
              roomId,
              room?.id ?? '',
              versionId1
            );
            const version2Detail = await mod.getVersionDetail(
              roomId,
              room?.id ?? '',
              versionId2
            );
            setVersion1Content({
              versionNumber: version1.versionNumber,
              description: version1.description,
              type: version1.type,
              createdAt: version1.createdAt,
              snapshot: version1Detail.snapshot,
            });
            setVersion2Content({
              versionNumber: version2.versionNumber,
              description: version2.description,
              type: version2.type,
              createdAt: version2.createdAt,
              snapshot: version2Detail.snapshot,
            });
            setIsComparingVersions(true);
          }
        );
      });
    } catch (err: any) {
      setComparisonError(err.message ?? 'Failed to compare versions');
    } finally {
      setIsComparingVersions(false);
    }
  };

  const handleCopy = async () => {
    setActionError(null);

    try {
      await navigator.clipboard.writeText(room.inviteCode);
      setCopyLabel('Copied');
    } catch {
      setActionError('The invite code could not be copied. Select it and copy it manually.');
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setActionError(null);

    try {
      await deleteRoom(roomId);
      navigate('/dashboard/rooms', {
        replace: true,
        state: { flash: `Deleted "${room.name}".` },
      });
    } catch (deleteFailure) {
      setActionError(errorMessage(deleteFailure, 'The room could not be deleted.'));
      setIsDeleting(false);
    }
  };

  const handleLeave = async () => {
    setIsLeaving(true);
    setActionError(null);

    try {
      await leaveRoom(roomId);
      navigate('/dashboard/rooms', {
        replace: true,
        state: { flash: `You left "${room.name}".` },
      });
    } catch (leaveFailure) {
      setActionError(errorMessage(leaveFailure, 'The room could not be left.'));
      setIsLeaving(false);
    }
  };

  const documentStatus =
    room.status === 'archived'
      ? ({ label: 'Paused', tone: 'outline' } as const)
      : collaborativeDocument.state.status === 'synced'
        ? ({ label: 'Live', tone: 'success' } as const)
        : collaborativeDocument.state.status === 'connecting'
          ? ({ label: 'Connecting', tone: 'warning' } as const)
          : collaborativeDocument.state.status === 'offline'
            ? ({ label: 'Offline', tone: 'warning' } as const)
            : collaborativeDocument.state.status === 'revoked'
              ? ({ label: 'Read only', tone: 'accent' } as const)
              : collaborativeDocument.state.status === 'error'
                ? ({ label: 'Unavailable', tone: 'accent' } as const)
                : ({ label: 'Starting', tone: 'outline' } as const);

  return (
    <div className="space-y-6">
      <Link
        to="/dashboard/rooms"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All rooms
      </Link>

      <PageHeader
        title={room.name}
        description={room.description || 'No description yet.'}
        actions={
          <>
            <Badge tone={room.status === 'active' ? 'success' : 'warning'}>
              {room.status === 'active' ? 'Active' : 'Archived'}
            </Badge>
            {isOwner ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSuccess(null);
                    setActionError(null);
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
                    setActionError(null);
                    setIsEditing(false);
                    setIsConfirmingDelete(true);
                  }}
                  disabled={isBusy || isConfirmingDelete}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete
                </Button>
              </>
            ) : (
              <Button
                variant="secondary"
                onClick={() => {
                  setSuccess(null);
                  setActionError(null);
                  setIsConfirmingLeave(true);
                }}
                disabled={isBusy || isConfirmingLeave}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Leave room
              </Button>
            )}
          </>
        }
      />

      {success ? <Notice tone="success">{success}</Notice> : null}
      {actionError ? <Notice tone="error">{actionError}</Notice> : null}

      <section
        className="rounded-lg border border-line bg-surface p-6"
        aria-labelledby="shared-code-heading"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-dark">
              <Code2 className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2 id="shared-code-heading" className="text-base font-semibold text-ink">
                Shared code
              </h2>
              <p className="mt-1 text-sm text-muted">
                Everyone in this room edits the same live TypeScript document.
              </p>
            </div>
          </div>
          <Badge tone={documentStatus.tone}>
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                documentStatus.tone === 'success'
                  ? 'bg-primary'
                  : documentStatus.tone === 'warning'
                    ? 'bg-[#A9781F]'
                    : documentStatus.tone === 'accent'
                      ? 'bg-accent'
                      : 'bg-muted'
              }`}
              aria-hidden="true"
            />
            {documentStatus.label}
          </Badge>
        </div>

        <Notice tone="info" className="mt-4">
          Changes sync live as you type, but are temporary. The document is not saved to the
          database yet, so restarting the server clears it.
        </Notice>

        {collaborativeDocument.state.error &&
        collaborativeDocument.state.status !== 'synced' ? (
          <Notice
            tone={
              collaborativeDocument.state.status === 'revoked' ||
              collaborativeDocument.state.status === 'error'
                ? 'error'
                : 'info'
            }
            className="mt-3"
          >
            {collaborativeDocument.state.error}
          </Notice>
        ) : null}

        <div className="mt-4">
          {room.status === 'archived' ? (
            <div className="rounded-md border border-line bg-paper px-4 py-6 text-sm text-muted">
              Editing is paused while the room is archived. Reactivate the room to continue.
            </div>
          ) : collaborativeDocument.doc ? (
            <Suspense
              fallback={
                <div className="grid h-[26rem] place-items-center rounded-md border border-line bg-paper md:h-[32rem]">
                  <Spinner label="Loading the editor..." />
                </div>
              }
            >
              <CollaborativeEditor
                doc={collaborativeDocument.doc}
                isReadOnly={collaborativeDocument.state.isReadOnly}
              />
            </Suspense>
          ) : (
            <div className="grid h-[26rem] place-items-center rounded-md border border-line bg-paper md:h-[32rem]">
              <Spinner label="Opening shared document..." />
            </div>
          )}
        </div>
      </section>

      {isConfirmingDelete ? (
        <div className="rounded-md border border-[#E7C9BD] bg-accent-soft/50 px-4 py-3" role="alert">
          <p className="text-sm font-semibold text-ink">Delete this room?</p>
          <p className="mt-1 text-sm text-ink-soft">
            Deleting &ldquo;{room.name}&rdquo; removes the room and its membership list. Linked
            projects and learning paths are not deleted.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="danger" size="sm" onClick={() => void handleDelete()} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Deleting...
                </>
              ) : (
                'Yes, delete room'
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsConfirmingDelete(false)}
              disabled={isDeleting}
            >
              Keep room
            </Button>
          </div>
        </div>
      ) : null}

      {isConfirmingLeave ? (
        <div className="rounded-md border border-[#E7C9BD] bg-accent-soft/50 px-4 py-3" role="alert">
          <p className="text-sm font-semibold text-ink">Leave this room?</p>
          <p className="mt-1 text-sm text-ink-soft">
            You will lose access until someone shares a current invite code with you.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="danger" size="sm" onClick={() => void handleLeave()} disabled={isLeaving}>
              {isLeaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Leaving...
                </>
              ) : (
                'Yes, leave room'
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsConfirmingLeave(false)}
              disabled={isLeaving}
            >
              Stay in room
            </Button>
          </div>
        </div>
      ) : null}

      {isEditing ? (
        <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="edit-room-heading">
          <h2 id="edit-room-heading" className="text-base font-semibold text-ink">
            Edit room
          </h2>
          <p className="mt-1 text-sm text-muted">
            Update the name, description, or linked work, then save.
          </p>
          <div className="mt-5 max-w-3xl">
            <RoomForm
              initialValues={{
                name: room.name,
                description: room.description,
                projectId: room.linkedProject?.id ?? '',
                learningPathId: room.linkedLearningPath?.id ?? '',
              }}
              projects={projects}
              learningPaths={paths}
              submitLabel="Save changes"
              onSubmit={handleUpdate}
              onCancel={() => setIsEditing(false)}
            />
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <section
            className="rounded-lg border border-line bg-surface p-6"
            aria-labelledby="invite-heading"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-dark">
                <Users className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h2 id="invite-heading" className="text-base font-semibold text-ink">
                  Invite people
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Anyone with an account and this code can join the room.
                </p>
              </div>
            </div>

            {room.status === 'archived' ? (
              <Notice tone="info" className="mt-4">
                This room is archived. New members cannot join until an owner reactivates it.
              </Notice>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 basis-56 break-all rounded-md border border-line bg-paper px-3 py-2.5 font-mono text-sm text-ink">
                {room.inviteCode}
              </code>
              <Button variant="secondary" onClick={() => void handleCopy()}>
                {copyLabel === 'Copied' ? (
                  <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
                {copyLabel}
              </Button>
              {isOwner ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setActionError(null);
                    setSuccess(null);
                    setIsConfirmingRotate(true);
                  }}
                  disabled={isRotating || isConfirmingRotate}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Rotate
                </Button>
              ) : null}
            </div>

            {isConfirmingRotate ? (
              <div className="mt-4 rounded-md border border-line bg-paper px-4 py-3">
                <p className="text-sm font-semibold text-ink">Rotate the invite code?</p>
                <p className="mt-1 text-sm text-ink-soft">
                  The current code stops working immediately. Existing members stay in the room.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void handleRotate()} disabled={isRotating}>
                    {isRotating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Rotating...
                      </>
                    ) : (
                      'Rotate code'
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsConfirmingRotate(false)}
                    disabled={isRotating}
                  >
                    Keep current code
                  </Button>
                </div>
              </div>
            ) : null}
          </section>

          <section
            className="rounded-lg border border-line bg-surface p-6"
            aria-labelledby="room-description-heading"
          >
            <h2 id="room-description-heading" className="text-base font-semibold text-ink">
              About this room
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
              {room.description || 'No description yet.'}
            </p>
          </section>

          <section
            className="rounded-lg border border-line bg-surface p-6"
            aria-labelledby="linked-work-heading"
          >
            <h2 id="linked-work-heading" className="text-base font-semibold text-ink">
              Linked work
            </h2>
            <p className="mt-1 text-sm text-muted">
              A shared reference point for the people in this room.
            </p>

            <ul className="mt-5 space-y-4">
              <li className="flex gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-dark">
                  <FolderKanban className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted">Project</p>
                  {room.linkedProject ? (
                    <Link
                      to={`/dashboard/projects/${room.linkedProject.id}`}
                      className="mt-0.5 inline-block text-sm font-medium text-ink underline-offset-2 hover:text-primary hover:underline"
                    >
                      {room.linkedProject.name}
                    </Link>
                  ) : room.hasLinkedProject ? (
                    <p className="mt-0.5 flex items-start gap-1.5 text-sm text-ink-soft">
                      <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      A project is linked, but only the room owner can open it.
                    </p>
                  ) : (
                    <p className="mt-0.5 text-sm text-muted">No project linked.</p>
                  )}
                </div>
              </li>

              <li className="flex gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-dark">
                  <RouteIcon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted">Learning path</p>
                  {room.linkedLearningPath ? (
                    <Link
                      to={`/dashboard/learning-paths/${room.linkedLearningPath.id}`}
                      className="mt-0.5 inline-block text-sm font-medium text-ink underline-offset-2 hover:text-primary hover:underline"
                    >
                      {room.linkedLearningPath.title}
                    </Link>
                  ) : room.hasLinkedLearningPath ? (
                    <p className="mt-0.5 text-sm text-muted">
                      The linked learning path is no longer published.
                    </p>
                  ) : (
                    <p className="mt-0.5 text-sm text-muted">No learning path linked.</p>
                  )}
                </div>
              </li>
            </ul>
          </section>
        </div>

        <div className="space-y-6">
          <section
            className="rounded-lg border border-line bg-surface p-6"
            aria-labelledby="members-heading"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="members-heading" className="text-base font-semibold text-ink">
                Members
              </h2>
              <div className="flex flex-wrap justify-end gap-1.5">
                <Badge tone={presence.isConnected ? 'success' : 'outline'}>
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      presence.isConnected ? 'bg-primary' : 'bg-muted'
                    }`}
                    aria-hidden="true"
                  />
                  {presenceLabel}
                </Badge>
                <Badge tone="outline">{room.memberCount} members</Badge>
              </div>
            </div>

            <ul className="mt-4 space-y-3">
              {room.members.map((member) => {
                const isOnline = onlineUserIds.has(member.userId);

                return (
                  <li key={member.userId} className="flex items-center gap-2.5">
                    <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary-dark">
                      {initials(member.displayName)}
                      {isOnline ? (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-primary"
                          aria-label="Online"
                        />
                      ) : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {member.displayName}
                        {member.userId === user?.id ? (
                          <span className="font-normal text-muted"> (you)</span>
                        ) : null}
                        {isOnline ? (
                          <span className="ml-1.5 text-xs font-normal text-primary-dark">
                            online
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted">Joined {formatDate(member.joinedAt)}</p>
                    </div>
                    <Badge tone={member.role === 'owner' ? 'success' : 'outline'}>
                      {member.role === 'owner' ? 'Owner' : 'Member'}
                    </Badge>
                  </li>
                );
              })}
            </ul>

            {presence.error ? (
              <p className="mt-4 text-xs leading-relaxed text-muted" role="status">
                {presence.error}
              </p>
            ) : null}

            {room.status === 'archived' ? (
              <p className="mt-4 text-xs leading-relaxed text-muted">
                Live presence is paused while the room is archived.
              </p>
            ) : null}

            {isOwner ? (
              <p className="mt-5 border-t border-line pt-3 text-xs leading-relaxed text-muted">
                Owners stay in the room until it is deleted. Delete the room to close it.
              </p>
            ) : null}
          </section>

          <aside
            className="rounded-lg border border-line bg-surface p-6"
            aria-labelledby="room-meta-heading"
          >
            <h2 id="room-meta-heading" className="text-base font-semibold text-ink">
              Details
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted">Owner</dt>
                <dd className="mt-0.5 text-ink-soft">
                  {ownerMember?.displayName ?? 'Room owner'}
                  {ownerMember?.userId === user?.id ? ' (you)' : ''}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Status</dt>
                <dd className="mt-1">
                  <Badge tone={room.status === 'active' ? 'success' : 'warning'}>
                    {room.status === 'active' ? 'Active' : 'Archived'}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Created</dt>
                <dd className="mt-0.5 text-ink-soft">{formatDate(room.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Last updated</dt>
                <dd className="mt-0.5 text-ink-soft">{formatDateTime(room.updatedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Room ID</dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-ink-soft">{room.id}</dd>
              </div>
            </dl>

{isOwner ? (
              <Button
                variant="secondary"
                size="sm"
                className="mt-5 w-full"
                onClick={() => void handleToggleStatus()}
                disabled={isBusy}
              >
                {isChangingStatus ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : room.status === 'active' ? (
                  <Archive className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
                )}
                {room.status === 'active' ? 'Archive room' : 'Reactivate room'}
              </Button>
            ) : null}
          </aside>
          {room.id && (
            <div className="mt-6 p-4 bg-surface rounded-lg">
              <h3 className="text-sm font-medium text-ink">
                Version History
              </h3>
              {room.status !== 'active' ? (
                <p className="text-sm text-muted">
                  Version history is only available for active rooms.
                </p>
              ) : versionsLoading ? (
                <Spinner label="Loading versions..." />
              ) : versionsError ? (
                <p className="text-sm text-error">{versionsError}</p>
              ) : versions.length === 0 ? (
                <p className="text-sm text-muted">
                  No versions found. Make changes to create automatic snapshots, or click "Save Version" below.
                </p>
              ) : (
                <div className="mt-3">
                  <p className="text-xs text-muted">Automatic versions:</p>
                  <ul className="list-disc list-inside text-sm text-muted">
                    {versions
                      .filter((v) => v.type === 'automatic')
                      .map((v) => (
                        <li key={v.id}>
                          v{v.versionNumber} – {v.description} – {new Date(v.createdAt).toLocaleDateString()}
                        </li>
                      ))}
                  </ul>
                  <p className="text-xs text-muted mt-2">Manual versions:</p>
                  <ul className="list-disc list-inside text-sm text-muted">
                    {versions
                      .filter((v) => v.type === 'manual')
                      .map((v) => (
                        <li key={v.id}>
                          v{v.versionNumber} – {v.description} – {new Date(v.createdAt).toLocaleDateString()}
                        </li>
                      ))}
                  </ul>
                  <p className="text-xs text-muted mt-2">Restore versions:</p>
                  <ul className="list-disc list-inside text-sm text-muted">
                    {versions
                      .filter((v) => v.type === 'restore')
                      .map((v) => (
                        <li key={v.id}>
                          v{v.versionNumber} – {v.description} – {new Date(v.createdAt).toLocaleDateString()}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
