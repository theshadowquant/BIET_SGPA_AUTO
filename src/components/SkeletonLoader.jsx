export function CardSkeleton({ className = '' }) {
  return (
    <div className={`glass-card p-6 ${className}`}>
      <div className="skeleton h-4 w-32 mb-3" />
      <div className="skeleton h-8 w-20 mb-2" />
      <div className="skeleton h-3 w-24" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="skeleton h-4 w-36" />
      </div>
      <div className="divide-y divide-gray-50">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-6 py-4 flex items-center gap-4">
            <div className="skeleton h-4 w-28" />
            <div className="skeleton h-4 w-20" />
            <div className="skeleton h-4 w-12" />
            <div className="skeleton h-4 w-24 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="glass-card p-6">
      <div className="skeleton h-4 w-40 mb-6" />
      <div className="flex items-end gap-3 h-48">
        {[60, 85, 45, 90, 70, 55, 80].map((h, i) => (
          <div key={i} className="skeleton flex-1" style={{ height: `${h}%`, borderRadius: '0.375rem 0.375rem 0 0' }} />
        ))}
      </div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="glass-card p-8 space-y-4">
      <div className="skeleton h-5 w-48 mb-6" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-2">
          <div className="skeleton h-4 w-36" />
          <div className="skeleton h-9 w-24" />
        </div>
      ))}
    </div>
  );
}
