import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
  /** Full-bleed page background (e.g. the Mindburst landing background). When
   *  set, the card switches to a dark glass style to match instead of the
   *  plain light card used on ordinary login screens, and the logo block is
   *  allowed to run wider than the card itself. */
  backgroundImage?: string;
}) {
  return (
    <div
      className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-muted/40 bg-cover bg-center px-4 py-12"
      style={backgroundImage ? { backgroundImage: `url(${backgroundImage})` } : undefined}
    >
      {/* Scoping `dark` here flips every shadcn token (input, button, text
          colors) to the dark palette for just this subtree, so the card
          reads correctly against the photographic background without
          touching the site's actual light/dark theme setting. */}
      <div className={cn("flex flex-col items-center gap-3 text-center", backgroundImage && "dark")}>
        {logo}
        {title && (
          <div>
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        )}
        {!title && subtitle && (
          <p className={cn("text-sm", backgroundImage ? "text-white/70" : "text-muted-foreground")}>
            {subtitle}
          </p>
        )}
      </div>

      <div className={cn("w-full max-w-sm", backgroundImage && "dark")}>
        <div
          className={cn(
            "rounded-xl border p-6",
            backgroundImage
              ? "border-white/20 bg-slate-950/70 shadow-[0_0_60px_-12px_rgba(99,102,241,0.6)] backdrop-blur-xl"
              : "border-border bg-card shadow-sm",
          )}
        >
          {children}
        </div>
        {footer && (
          <div className={cn("mt-6 text-center text-xs", backgroundImage ? "text-white/60" : "text-muted-foreground")}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
