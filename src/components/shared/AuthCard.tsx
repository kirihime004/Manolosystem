import type { ReactNode } from "react";

export function AuthCard({
  logo,
  title,
  subtitle,
  children,
  footer,
  backgroundImage,
}: {
  logo?: ReactNode;
  /** Omit when the logo graphic already carries the wordmark, to avoid repeating it. */
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Full-bleed page background (e.g. the Mindburst landing background). */
  backgroundImage?: string;
}) {
  return (
    <div
      className="flex min-h-screen w-full items-center justify-center bg-muted/40 bg-cover bg-center px-4"
      style={backgroundImage ? { backgroundImage: `url(${backgroundImage})` } : undefined}
    >
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          {logo}
          {title && (
            <div>
              <h1 className="text-lg font-semibold text-foreground">{title}</h1>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
          )}
          {!title && subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          {children}
        </div>
        {footer && <div className="mt-6 text-center text-xs text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}
