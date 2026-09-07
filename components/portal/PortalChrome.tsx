import { PORTAL_HOME, PORTAL_LOGIN } from "@/lib/portal";

export function PortalChrome({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="portal-chrome">
      <div className="colour-bar" aria-hidden="true" />
      <header className="portal-top">
        <a href={signedIn ? PORTAL_HOME : PORTAL_LOGIN} aria-label="Event Host home">
          <img
            className="portal-logo"
            src="/brand/logos/venturo-horizontal-light.svg"
            alt="Venturo"
          />
        </a>
        <div className="portal-top-actions">
          {signedIn && (
            <form action="/auth/sign-out" method="post">
              <input type="hidden" name="next" value={PORTAL_LOGIN} />
              <button className="btn btn-ghost" type="submit">
                Log Out
              </button>
            </form>
          )}
          <a className="btn btn-secondary" href="/">
            Leave Event Host
          </a>
        </div>
      </header>
    </div>
  );
}
