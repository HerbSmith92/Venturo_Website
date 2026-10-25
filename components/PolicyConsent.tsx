export function PolicyConsent({
  acceptTerms,
  acceptPrivacy,
  onTerms,
  onPrivacy,
}: {
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  onTerms: (value: boolean) => void;
  onPrivacy: (value: boolean) => void;
}) {
  return (
    <fieldset className="policy-consent">
      <legend className="sr-only">Policies</legend>
      <label>
        <input
          type="checkbox"
          name="acceptTerms"
          checked={acceptTerms}
          onChange={(event) => onTerms(event.target.checked)}
          required
        />
        <span>
          I accept the <a href="/terms" target="_blank" rel="noreferrer">Terms &amp; Conditions</a>.
        </span>
      </label>
      <label>
        <input
          type="checkbox"
          name="acceptPrivacy"
          checked={acceptPrivacy}
          onChange={(event) => onPrivacy(event.target.checked)}
          required
        />
        <span>
          I acknowledge the <a href="/privacy_policy" target="_blank" rel="noreferrer">Privacy Policy</a>.
        </span>
      </label>
    </fieldset>
  );
}

export function PolicyLinks() {
  return (
    <p className="policy-links">
      <a href="/terms">Terms &amp; Conditions</a>
      <a href="/privacy_policy">Privacy Policy</a>
      <a href="/refunds">Refunds &amp; Cancellations</a>
      <a href="/support">Support</a>
    </p>
  );
}
