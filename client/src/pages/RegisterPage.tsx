import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { Notice } from '../components/ui/Notice';
import { useAuth } from '../hooks/useAuth';
import { errorMessage, fieldError } from '../lib/api/errors';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await register({ displayName: displayName.trim(), email: email.trim(), password });
      navigate('/dashboard', {
        replace: true,
        state: { flash: 'Account created. Welcome to your workspace.' },
      });
    } catch (registerError) {
      setError(registerError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <p className="font-mono text-xs text-muted">Create your account</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Start with an account.</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Create a secure account to open the protected CodeTogether workspace.
      </p>

      {error ? (
        <Notice tone="error" className="mt-6">
          {errorMessage(error, 'Account creation failed. Try again.')}
        </Notice>
      ) : null}

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <FormField
          label="Display name"
          name="displayName"
          type="text"
          autoComplete="name"
          required
          minLength={2}
          maxLength={50}
          value={displayName}
          error={fieldError(error, 'displayName')}
          onChange={(event) => {
            setDisplayName(event.target.value);
            setError(null);
          }}
        />

        <FormField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          error={fieldError(error, 'email')}
          onChange={(event) => {
            setEmail(event.target.value);
            setError(null);
          }}
        />

        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          value={password}
          hint="Use at least 12 characters. A passphrase works well."
          error={fieldError(error, 'password')}
          onChange={(event) => {
            setPassword(event.target.value);
            setError(null);
          }}
        />

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Creating account...
            </>
          ) : (
            'Create account'
          )}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-primary hover:text-primary-dark">
          Sign in
        </Link>
      </p>
    </div>
  );
}
