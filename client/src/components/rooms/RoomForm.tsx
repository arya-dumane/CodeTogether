import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { FormField, inputClasses } from '../ui/FormField';
import { Notice } from '../ui/Notice';
import { TextareaField } from '../ui/TextareaField';
import { errorMessage, fieldError } from '../../lib/api/errors';
import type { LearningPathSummary } from '../../lib/api/learningPaths';
import type { Project } from '../../lib/api/projects';
import {
  ROOM_DESCRIPTION_MAX_LENGTH,
  ROOM_NAME_MAX_LENGTH,
} from '../../lib/api/rooms';
import { cn } from '../../lib/cn';

export interface RoomFormValues {
  name: string;
  description: string;
  projectId: string;
  learningPathId: string;
}

interface RoomFormErrors {
  name?: string;
  description?: string;
}

interface RoomFormProps {
  initialValues?: RoomFormValues;
  projects: Project[];
  learningPaths: LearningPathSummary[];
  submitLabel: string;
  onSubmit: (values: RoomFormValues) => Promise<void>;
  onCancel?: () => void;
}

const emptyValues: RoomFormValues = {
  name: '',
  description: '',
  projectId: '',
  learningPathId: '',
};

function validate(values: RoomFormValues): RoomFormErrors {
  const errors: RoomFormErrors = {};
  const name = values.name.trim();
  const description = values.description.trim();

  if (!name) {
    errors.name = 'Room name is required';
  } else if (name.length > ROOM_NAME_MAX_LENGTH) {
    errors.name = `Room name must be at most ${ROOM_NAME_MAX_LENGTH} characters`;
  }

  if (description.length > ROOM_DESCRIPTION_MAX_LENGTH) {
    errors.description = `Description must be at most ${ROOM_DESCRIPTION_MAX_LENGTH} characters`;
  }

  return errors;
}

export function RoomForm({
  initialValues = emptyValues,
  projects,
  learningPaths,
  submitLabel,
  onSubmit,
  onCancel,
}: RoomFormProps) {
  const [values, setValues] = useState<RoomFormValues>(initialValues);
  const [errors, setErrors] = useState<RoomFormErrors>({});
  const [requestError, setRequestError] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = validate(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setRequestError(null);
    setIsSubmitting(true);

    try {
      await onSubmit({
        name: values.name.trim(),
        description: values.description.trim(),
        projectId: values.projectId,
        learningPathId: values.learningPathId,
      });
    } catch (error) {
      setRequestError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      {requestError ? (
        <Notice tone="error">{errorMessage(requestError, 'The room could not be saved.')}</Notice>
      ) : null}

      <FormField
        label="Room name"
        name="name"
        type="text"
        required
        maxLength={ROOM_NAME_MAX_LENGTH}
        value={values.name}
        disabled={isSubmitting}
        error={errors.name ?? fieldError(requestError, 'name')}
        onChange={(event) => {
          setValues((current) => ({ ...current, name: event.target.value }));
          setErrors((current) => ({ ...current, name: undefined }));
          setRequestError(null);
        }}
      />

      <TextareaField
        label="Description"
        name="description"
        rows={3}
        maxLength={ROOM_DESCRIPTION_MAX_LENGTH}
        hint={`Optional. Up to ${ROOM_DESCRIPTION_MAX_LENGTH} characters.`}
        value={values.description}
        disabled={isSubmitting}
        error={errors.description ?? fieldError(requestError, 'description')}
        onChange={(event) => {
          setValues((current) => ({ ...current, description: event.target.value }));
          setErrors((current) => ({ ...current, description: undefined }));
          setRequestError(null);
        }}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="room-project" className="text-sm font-medium text-ink">
            Linked project
          </label>
          <select
            id="room-project"
            name="projectId"
            value={values.projectId}
            disabled={isSubmitting}
            className={cn(inputClasses, fieldError(requestError, 'projectId') && 'border-accent/70')}
            onChange={(event) => {
              setValues((current) => ({ ...current, projectId: event.target.value }));
              setRequestError(null);
            }}
          >
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Only projects you own can be linked.
          </p>
          {fieldError(requestError, 'projectId') ? (
            <p className="mt-1.5 text-xs font-medium text-accent">
              {fieldError(requestError, 'projectId')}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="room-learning-path" className="text-sm font-medium text-ink">
            Linked learning path
          </label>
          <select
            id="room-learning-path"
            name="learningPathId"
            value={values.learningPathId}
            disabled={isSubmitting}
            className={cn(
              inputClasses,
              fieldError(requestError, 'learningPathId') && 'border-accent/70',
            )}
            onChange={(event) => {
              setValues((current) => ({ ...current, learningPathId: event.target.value }));
              setRequestError(null);
            }}
          >
            <option value="">No learning path</option>
            {learningPaths.map((path) => (
              <option key={path.id} value={path.id}>
                {path.title}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Published paths are available to everyone in the room.
          </p>
          {fieldError(requestError, 'learningPathId') ? (
            <p className="mt-1.5 text-xs font-medium text-accent">
              {fieldError(requestError, 'learningPathId')}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Saving...
            </>
          ) : (
            submitLabel
          )}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
