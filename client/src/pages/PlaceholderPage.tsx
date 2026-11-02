import { Check, Construction } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { PageHeader } from '../components/ui/PageHeader';

interface PlaceholderPageProps {
  title: string;
  description: string;
  items: string[];
}

export function PlaceholderPage({ title, description, items }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={<Badge tone="warning">Planned</Badge>}
      />

      <div className="rounded-lg border border-dashed border-line bg-surface/60 p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-dark">
            <Construction className="h-5 w-5" aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">Not built yet</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
              This route exists so the navigation is honest about where the product is going. Nothing
              here saves data or performs work yet.
            </p>

            <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {items.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
