---
name: react-typescript
description: Build and structure React applications with TypeScript, Tailwind CSS, Recharts, and modern best practices. Use when creating React components, hooks, API layers, charts, dashboards, or when the user asks about React project structure, TypeScript patterns, or frontend architecture.
---

# React TypeScript Application

## Project Structure

```
src/
├── api/                    # API client and endpoint modules
│   ├── client.ts           # Base API client with error handling
│   ├── index.ts            # Re-exports all API functions
│   └── [feature].ts        # Feature-specific endpoints
├── features/               # Feature-based modules (optional)
│   └── [feature]/
│       ├── components/
│       ├── hooks/
│       └── index.ts
├── shared/                 # Shared utilities across features
│   ├── components/         # Reusable UI components
│   ├── hooks/              # Custom hooks
│   └── utils/              # Helper functions
├── types/                  # Centralized TypeScript definitions
│   └── index.ts            # All type exports
├── constants/              # App constants and config
├── App.tsx
└── index.tsx
```

## TypeScript Configuration

Essential `tsconfig.json` settings:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["DOM", "DOM.Iterable", "ES2021"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "baseUrl": "src",
    "types": ["jest", "node"],
    "paths": {
      "@/*": ["./*"],
      "@/components/*": ["./components/*"],
      "@/hooks/*": ["./hooks/*"],
      "@/types/*": ["./types/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "build"]
}
```

## Type Definitions Pattern

Centralize types in `types/index.ts`:

```typescript
// Core data types
export type DataRow = Record<string, unknown>;

// API response types
export interface ApiResponse<T = unknown> {
  message?: string;
  data?: T;
}

// Component prop types
export interface ModalProps {
  open: boolean;
  onClose: () => void;
}

// Domain types with all required fields
export interface Transformation {
  id: TransformationType;
  name: string;  // Always include display name
  params: TransformationParams;
}
```

## API Layer Pattern

**client.ts** - Base client with error handling:

```typescript
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw Object.assign(new ApiError('Request failed'), { status: response.status, error });
  }
  if (response.status === 204) return null as T;
  return response.json();
};

export const apiGet = <T>(path: string): Promise<T> => request(path);
export const apiPost = <T>(path: string, body?: unknown): Promise<T> =>
  request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
export const apiPut = <T>(path: string, body?: unknown): Promise<T> =>
  request(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
export const apiDelete = <T>(path: string): Promise<T> => request(path, { method: 'DELETE' });
```

**Feature endpoints** - Separate files per domain:

```typescript
// api/datasets.ts
import { apiGet, apiPost } from './client';
import type { Dataset, Transformation } from '../types';

export const fetchDatasets = (): Promise<Dataset[]> => apiGet('/datasets');

export const saveDataset = (name: string, transformations: Transformation[]) =>
  apiPost<{ message: string }>('/datasets/save', { datasetName: name, transformations });
```

## Custom Hooks Pattern

```typescript
import { useState, useCallback } from 'react';

interface UseErrorReturn {
  error: string | null;
  showError: (message: string) => void;
  clearError: () => void;
}

export function useError(): UseErrorReturn {
  const [error, setError] = useState<string | null>(null);

  const showError = useCallback((message: string) => {
    setError(message);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { error, showError, clearError };
}
```

## ESLint Best Practices

### Use Optional Chaining

```typescript
// ✅ Good
if (!transform?.params) return '';

// ❌ Avoid
if (!transform || !transform.params) return '';
```

### Use replaceAll() for Global Replacements

```typescript
// ✅ Good
const sanitized = name.replaceAll(/[\\/]/g, '_');

// ❌ Avoid
const sanitized = name.replace(/[\\/]/g, '_');
```

### Use Object Lookups Instead of Nested Ternaries

```typescript
// ✅ Good
const operatorSymbols: Record<string, string> = {
  equals: '=',
  not_equals: '≠',
  greater_than: '>',
  less_than: '<',
};
const symbol = operatorSymbols[operator] || '';

// ❌ Avoid
const symbol = operator === 'equals' ? '='
  : operator === 'not_equals' ? '≠'
  : operator === 'greater_than' ? '>'
  : operator === 'less_than' ? '<' : '';
```

### Accessibility - Form Elements Need Labels

```tsx
// Hidden file inputs still need accessible names
<input
  type="file"
  className="hidden"
  aria-label="Upload CSV, XLSX, or Parquet file"
  onChange={handleFileChange}
/>
```

## Tailwind CSS Styling

### tailwind.config.js — Dark Theme Tokens

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2b8cee',
        'background-dark': '#101922',
        'surface-dark': '#1c2632',
        'border-dark': '#233648',
      },
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
};
```

### Common Patterns

- **Page background**: `bg-background-dark`
- **Cards / panels**: `bg-surface-dark border border-border-dark rounded-2xl`
- **Primary actions**: `bg-primary hover:bg-primary/90 text-white`
- **Muted text**: `text-slate-400` or `text-[#92adc9]`
- **Subtle hover**: `hover:border-primary/20`, `hover:bg-white/5`
- **Dynamic styles** based on state — use inline `style` prop:

```tsx
<div style={{
  opacity: isLoading ? 0.7 : 1,
  pointerEvents: isLoading ? 'none' : 'auto',
}}>
```

### Global Styles (index.css)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #101922;
  color: white;
}

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: #101922; }
::-webkit-scrollbar-thumb { background: #233648; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #2b8cee; }
```

## Component Patterns

### Modal Component

```tsx
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ open, onClose, title, children }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-surface-dark border border-border-dark rounded-2xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
```

### Save Modal Example

```tsx
interface SaveModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
  defaultName?: string;
}

const SaveModal: React.FC<SaveModalProps> = ({ open, onClose, onSave, defaultName = '' }) => {
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setName(defaultName);
  }, [open, defaultName]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(name);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={() => !saving && onClose()} title="Save">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter a name..."
        className="w-full px-3 py-2 bg-background-dark border border-border-dark rounded-lg text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
      />
      <div className="flex justify-end gap-3 mt-4">
        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </Modal>
  );
};
```

## Testing Patterns

### Test File Structure

```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDataProfile } from '../useDataProfile';
import * as api from '../../api';
import type { DataProfile, ColumnStats } from '../../types';

jest.mock('../../api');
const mockedApi = api as jest.Mocked<typeof api>;

describe('useDataProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should fetch profile data', async () => {
    const mockProfile: DataProfile = {
      totalRows: 100,
      totalColumns: 5,
      columns: [
        { name: 'id', declaredType: 'integer', inferredType: 'integer' }
      ]
    };
    mockedApi.getProfile.mockResolvedValueOnce(mockProfile);

    const { result } = renderHook(() => useDataProfile([], mockShowError));
    // ... assertions
  });
});
```

### Key Testing Rules

1. **Import types from centralized location** - not local interfaces
2. **Mock data must match full type definitions** - include all required properties
3. **Use `jest.Mocked<typeof module>`** for typed mocks

## Dependencies

```json
{
  "dependencies": {
    "react": "^19.x",
    "react-router-dom": "^7.x",
    "@tanstack/react-query": "^5.x",
    "recharts": "^2.x"
  },
  "devDependencies": {
    "tailwindcss": "^3.x",
    "@tailwindcss/forms": "^0.5.x",
    "@tailwindcss/typography": "^0.5.x",
    "postcss": "^8.x",
    "autoprefixer": "^10.x",
    "vite": "^6.x",
    "typescript": "^5.x",
    "@types/react": "^19.x",
    "@testing-library/react": "^14.x",
    "@testing-library/jest-dom": "^6.x"
  }
}
```

## Recharts Chart Patterns

Use **Recharts** for data visualization. Always wrap charts in `ResponsiveContainer`.

### Chart Color Palette

Define a shared palette constant for consistent chart colors:

```typescript
const CHART_COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
```

### Dark-Theme Chart Styling

Apply these consistently to all Recharts components for a polished dark UI:

```typescript
// Tooltip — light popup for readability against dark background
const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: '#f1f5f9',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    color: '#0f172a',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  },
  labelStyle: { color: '#0f172a', fontWeight: 'bold' },
  itemStyle: { color: '#0f172a' },
};

// Axis — muted ticks that don't compete with data
const CHART_AXIS_STYLE = {
  stroke: '#94a3b8',
  tick: { fill: '#94a3b8', fontSize: 12 },
  tickLine: { stroke: '#475569' },
};

// Grid — subtle dashed lines
const CHART_GRID_STYLE = {
  strokeDasharray: '3 3',
  stroke: '#334155',
};
```

### Donut Chart

```tsx
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

<ResponsiveContainer width="100%" height={200}>
  <PieChart>
    <Pie
      data={chartData}
      cx="50%"
      cy="50%"
      innerRadius={50}
      outerRadius={80}
      paddingAngle={2}
      dataKey="value"
    >
      {chartData.map((entry, index) => (
        <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
      ))}
    </Pie>
    <Tooltip {...CHART_TOOLTIP_STYLE} />
  </PieChart>
</ResponsiveContainer>
```

### Line Chart (Trend)

```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={300}>
  <LineChart data={trendData}>
    <CartesianGrid {...CHART_GRID_STYLE} />
    <XAxis dataKey="period" {...CHART_AXIS_STYLE} />
    <YAxis {...CHART_AXIS_STYLE} />
    <Tooltip {...CHART_TOOLTIP_STYLE} />
    <Legend />
    <Line type="monotone" dataKey="primary" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
    <Line type="monotone" dataKey="secondary" stroke="#94a3b8" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
  </LineChart>
</ResponsiveContainer>
```

### Bar Chart

```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={300}>
  <BarChart data={barData} layout="vertical">
    <CartesianGrid {...CHART_GRID_STYLE} />
    <XAxis type="number" {...CHART_AXIS_STYLE} />
    <YAxis type="category" dataKey="name" {...CHART_AXIS_STYLE} width={100} />
    <Tooltip {...CHART_TOOLTIP_STYLE} />
    <Bar dataKey="value" fill="#8b5cf6" radius={[0, 8, 8, 0]} />
  </BarChart>
</ResponsiveContainer>
```

For vertical bars use `radius={[8, 8, 0, 0]}` (rounded top). For horizontal bars use `radius={[0, 8, 8, 0]}` (rounded right).

### Interactive Chart Drill-Down

Charts can navigate to detail pages with pre-applied filters via React Router state:

```tsx
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();

<Pie
  data={roleData}
  dataKey="value"
  onClick={(data) => navigate('/people', { state: { role: data.name } })}
  cursor="pointer"
/>
```

The target page reads the filter from `useLocation().state`:

```tsx
const location = useLocation();
const initialFilter = location.state?.role || '';
```

## Dashboard Cards

### MetricCard Component

A reusable card for displaying key metrics in a dashboard grid:

```tsx
interface MetricCardProps {
  label: string;
  value: number | string;
  subtitle: string;
  color: string;       // Tailwind text color class, e.g. 'text-sky-400'
  icon: string;        // Material Symbols icon name
  loading?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, subtitle, color, icon, loading }) => (
  <div className="bg-surface-dark border border-border-dark p-6 rounded-2xl shadow-sm hover:border-primary/20 transition-all group">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-2 rounded-lg bg-white/5 ${color} group-hover:scale-110 transition-transform`}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
    </div>
    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">{label}</p>
    <h2 className={`text-4xl font-black ${color}`}>{loading ? '—' : value}</h2>
    <p className="text-[#92adc9] text-xs mt-2 opacity-60 italic">{subtitle}</p>
  </div>
);
```

Usage in a dashboard grid:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <MetricCard label="Total Users" value={1234} subtitle="Active this month" color="text-sky-400" icon="group" />
  <MetricCard label="Revenue" value="$45K" subtitle="vs $38K last month" color="text-emerald-400" icon="payments" />
  <MetricCard label="Errors" value={12} subtitle="3 critical" color="text-red-400" icon="error" />
</div>
```

## React Query (TanStack Query)

Use **@tanstack/react-query** for server state management. It handles caching, refetching, loading/error states, and cache invalidation.

### Setup

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </QueryClientProvider>
);
```

### Queries (reading data)

```tsx
import { useQuery } from '@tanstack/react-query';
import { fetchPeople } from '../api/people';

const { data: people, isLoading, error } = useQuery({
  queryKey: ['people'],
  queryFn: () => fetchPeople(''),
});
```

### Mutations (creating/updating/deleting)

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPerson } from '../api/people';

const queryClient = useQueryClient();

const createMutation = useMutation({
  mutationFn: createPerson,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['people'] });
    handleCloseModal();
  },
});

// Trigger: createMutation.mutate({ name: 'Alice', role: 'Engineer' });
// Status: createMutation.isPending, createMutation.isError
```

### Query Key Conventions

- Use arrays: `['people']`, `['people', personId]`, `['people', { role: 'engineer' }]`
- Invalidating `['people']` also invalidates `['people', personId]` (hierarchical)

## Toast Notifications

Lightweight toast pattern using CSS animations — no library needed.

### CSS (add to index.css)

```css
@keyframes slide-in {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

.animate-slide-in { animation: slide-in 0.3s ease-out; }
.animate-fade-out { animation: fade-out 0.3s ease-out forwards; }
```

### Hook

```tsx
function useToast(duration = 3000) {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [fading, setFading] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setFading(false);
    setTimeout(() => setFading(true), duration - 300);
    setTimeout(() => setToast(null), duration);
  }, [duration]);

  return { toast, fading, showToast };
}
```

### Render

```tsx
{toast && (
  <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm
    ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}
    ${fading ? 'animate-fade-out' : 'animate-slide-in'}`}
  >
    {toast.message}
  </div>
)}
```