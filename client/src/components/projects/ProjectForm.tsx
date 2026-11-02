import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { FormField } from '../ui/FormField';
import { Notice } from '../ui/Notice';
import { TextareaField } from '../ui/TextareaField';
import { errorMessage, fieldError } from '../../lib/api/errors';
import {
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_NAME_MAX_LENGTH,
} from '../../lib/api/projects';

export interface ProjectFormValues {
  name: string;
  description: string;
}

interface ProjectFormErrors {
  name?: string;
  description?: string;
}

interface ProjectFormProps {
  initialValues?: ProjectFormValues;
  submitLabel: string;
  onSubmit: (values: ProjectFormValues) => Promise<void>;
  onCancel?: () => void;
}

const emptyValues: ProjectFormValues = { name: '', description: '' };

function validate(values: ProjectFormValues): ProjectFormErrors {
  const errors: ProjectFormErrors = {};
  const name = values.name.trim();
  const description = values.description.trim();

  if (!name) {
    errors.name = 'Project name is required';
  } else if (name.length > PROJECT_NAME_MAX_LENGTH) {
    errors.name = `Project name must be at most ${PROJECT_NAME_MAX_LENGTH} characters`;
  }

  if (description.length > PROJECT_DESCRIPTION_MAX_LENGTH) {
    errors.description = `Description must be at most ${PROJECT_DESCRIPTION_MAX_LENGTH} characters`;
  }

  return errors;
}

export function ProjectForm({
  initialValues = emptyValues,
  submitLabel,
  onSubmit,
  onCancel,
}: ProjectFormProps) {
  const [values, setValues] = useState<ProjectFormValues>(initialValues);
  const [errors, setErrors] = useState<ProjectFormErrors>({});
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
        <Notice tone="error">{errorMessage(requestError, 'The project could not be saved.')}</Notice>
      ) : null}

      <FormField
        label="Project name"
        name="name"
        type="text"
        required
        maxLength={PROJECT_NAME_MAX_LENGTH}
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
        rows={4}
        maxLength={PROJECT_DESCRIPTION_MAX_LENGTH}
        hint={`Optional. Up to ${PROJECT_DESCRIPTION_MAX_LENGTH} characters.`}
        value={values.description}
        disabled={isSubmitting}
        error={errors.description ?? fieldError(requestError, 'description')}
        onChange={(event) => {
          setValues((current) => ({ ...current, description: event.target.value }));
          setErrors((current) => ({ ...current, description: undefined }));
          setRequestError(null);
        }}
      />

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
