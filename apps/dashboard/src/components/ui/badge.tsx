import { cn } from '@/lib/utils';

export function Badge({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'success' | 'warn' | 'danger' | 'muted' | 'secondary' | 'outline';
}) {
  const styles = {
    default: 'bg-navy/10 text-navy',
    success: 'bg-brand-50 text-brand-700',
    warn: 'bg-amber-50 text-amber-800',
    danger: 'bg-red-50 text-red-700',
    muted: 'bg-muted text-muted-foreground',
    secondary: 'bg-brand/10 text-brand',
    outline: 'border border-border bg-white text-navy',
  } as const;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}
