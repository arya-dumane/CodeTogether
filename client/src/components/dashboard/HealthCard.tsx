import { RefreshCw } from 'lucide-react';
import { useHealth } from '../../hooks/useHealth';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ErrorState } from '../ui/ErrorState';
import { Spinner } from '../ui/Spinner';

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function HealthCard() {
  const { data, error, isLoading, refetch } = useHealth();

  return (
    <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="api-health-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="api-health-heading" className="text-base font-semibold text-ink">
            API health
          </h2>
          <p className="mt-1 text-sm text-muted">Live status from the Express API.</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={refetch}
          disabled={isLoading}
          aria-label="Refresh API health"
        >
          <RefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-6">
          <Spinner label="Checking the API..." />
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="mt-5">
          <ErrorState title="API unavailable" message={error} onRetry={refetch} />
        </div>
      ) : null}

      {!isLoading && data ? (
        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={data.status === 'ok' ? 'success' : 'warning'}>
              {data.status === 'ok' ? 'API healthy' : 'API degraded'}
            </Badge>
            <span className="text-xs text-muted">
              {data.database.status === 'connected' ? 'MongoDB connected' : 'MongoDB not connected'}
            </span>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm">
            <div>
              <dt className="text-xs text-muted">Service</dt>
              <dd className="mt-1 font-mono text-xs text-ink">{data.service}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Version</dt>
              <dd className="mt-1 font-mono text-xs text-ink">{data.version}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Uptime</dt>
              <dd className="mt-1 text-ink-soft">{formatUptime(data.uptimeSeconds)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Checked</dt>
              <dd className="mt-1 text-ink-soft">{new Date(data.timestamp).toLocaleTimeString()}</dd>
            </div>
          </dl>

          {data.status === 'degraded' ? (
            <p className="mt-4 text-xs leading-relaxed text-muted">
              The API is running, but MongoDB is not connected. Start MongoDB and refresh to see a
              healthy status.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
