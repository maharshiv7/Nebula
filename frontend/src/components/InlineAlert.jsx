import { AlertTriangle, AlertCircle } from 'lucide-react';

export default function InlineAlert({ severity = 'warning', children, title, action, className = '' }) {
  const isError = severity === 'error';
  const Icon = isError ? AlertCircle : AlertTriangle;

  const bgStyle = isError
    ? 'bg-red-950/60 border-red-900/80 text-red-200'
    : 'bg-amber-950/60 border-amber-900/80 text-amber-200';

  const iconStyle = isError ? 'text-red-400' : 'text-amber-400';

  return (
    <div className={`p-3.5 border rounded-xl flex items-start gap-3 backdrop-blur-md transition-all duration-200 ${bgStyle} ${className}`}>
      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${iconStyle}`} />
      <div className="flex-1 text-xs sm:text-sm leading-relaxed">
        {title && <div className="font-semibold mb-0.5 text-white">{title}</div>}
        <div>{children}</div>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}
