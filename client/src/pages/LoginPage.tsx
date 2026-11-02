import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { Notice } from '../components/ui/Notice';
import { useAuth } from '../hooks/useAuth';
import { errorMessage, fieldError } from '../lib/api/errors';

interface LoginLocationState {
  from?: { pathname?: string };
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const state = location.state as LoginLocationState | null;
  const destination = state?.from?.pathname ?? '/dashboard';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ email: email.trim(), password });
      navigate(destination, {
        replace: true,
        state: { flash: 'Signed in successfully.' },
      });
    } catch (loginError) {
      setError(loginError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <p className="font-mono text-xs text-muted">Account access</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Welcome back.</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Sign in to open your protected workspace.
      </p>

      {error ? (
        <Notice tone="error" className="mt-6">
          {errorMessage(error, 'Sign-in failed. Try again.')}
        </Notice>
      ) : null}

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
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
          autoComplete="current-password"
          required
          maxLength={128}
          value={password}
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
              Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted">
        New to CodeTogether?{' '}
        <Link to="/register" className="font-medium text-primary hover:text-primary-dark">
          Create an account
        </Link>
      </p>
    </div>
  );
}
