import { COMPANION_HOME, COMPANION_LOGIN } from "@/lib/companion";

export function CompanionShell({
  signedIn,
  title,
  children,
  backHref,
  backLabel,
}: {
  signedIn: boolean;
  title?: string;
  children: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="companion-app">
      <div className="colour-bar" aria-hidden="true" />
      <header className={`companion-top${title && !backHref ? " companion-top-title" : ""}`}>
        {backHref ? (
          <a className="btn btn-ghost companion-back" href={backHref}>
            {backLabel ?? "Back"}
          </a>
        ) : title ? (
          <h1 className="companion-large-title">{title}</h1>
        ) : (
          <a className="companion-brand" href={signedIn ? COMPANION_HOME : COMPANION_LOGIN}>
            <img src="/brand/logos/venturo-stacked-light.svg" alt="Venturo" />
          </a>
        )}
        <div className="companion-top-actions">
          {signedIn && (
            <form action="/auth/sign-out" method="post">
              <input type="hidden" name="next" value={COMPANION_LOGIN} />
              <button className="btn btn-ghost" type="submit">
                Log Out
              </button>
            </form>
          )}
        </div>
      </header>
      {backHref && title ? <h1 className="companion-page-title">{title}</h1> : null}
      <div className="companion-main">{children}</div>
    </div>
  );
}
