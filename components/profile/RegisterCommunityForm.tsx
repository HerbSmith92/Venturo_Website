"use client";

import { useState } from "react";
import { registerCommunity } from "@/app/community-claim-actions";
import { PolicyConsent, PolicyLinks } from "@/components/PolicyConsent";
import { CONSENT_REQUIRED } from "@/lib/policy-consent";

type StepKey = "details" | "founder" | "contact";

export function RegisterCommunityForm({
  founderName: initialFounder,
  founderEmail: initialFounderEmail,
  contactEmail: initialContactEmail,
  phone: initialPhone,
  initialArea,
}: {
  founderName: string;
  founderEmail: string;
  contactEmail: string;
  phone: string;
  initialArea: string;
}) {
  const [open, setOpen] = useState<StepKey | null>("details");
  const [title, setTitle] = useState("");
  const [about, setAbout] = useState("");
  const [areas, setAreas] = useState<string[]>([initialArea]);
  const [founderName, setFounderName] = useState(initialFounder);
  const [founderEmail, setFounderEmail] = useState(initialFounderEmail);
  const [contactEmail, setContactEmail] = useState(initialContactEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const detailsDone = Boolean(title.trim() && about.trim());
  const founderDone = Boolean(founderName.trim());
  const contactDone = Boolean(contactEmail.trim() || phone.trim());
  const done: Record<StepKey, boolean> = {
    details: detailsDone,
    founder: founderDone,
    contact: contactDone,
  };

  function show(step: StepKey) {
    setOpen(step);
    document.getElementById(`step-${step}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggle(step: StepKey) {
    setOpen((current) => (current === step ? null : step));
  }

  function nextIncomplete(from: StepKey) {
    const order: StepKey[] = ["details", "founder", "contact"];
    const start = order.indexOf(from);
    return order.slice(start + 1).find((step) => !done[step]) ?? order[Math.min(start + 1, order.length - 1)];
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detailsDone) {
      setError("Add the community name and what it is about.");
      show("details");
      return;
    }
    if (!founderDone) {
      setError("Add the founder's name.");
      show("founder");
      return;
    }
    if (!contactDone) {
      setError("Add a contact email or a contact number.");
      show("contact");
      return;
    }
    if (!acceptTerms || !acceptPrivacy) {
      setError(CONSENT_REQUIRED);
      show("contact");
      return;
    }

    setError(null);
    setPending(true);
    try {
      const result = await registerCommunity({
        title,
        about,
        areas,
        phone,
        contactEmail,
        founderName,
        founderEmail,
        websiteUrl,
        instagramUrl,
        facebookUrl,
        tiktokUrl,
        acceptTerms,
        acceptPrivacy,
      });
      if ("error" in result) throw new Error(result.error);
      window.location.assign("/account/communities");
    } catch (caught) {
      setPending(false);
      setError(caught instanceof Error ? caught.message : "Could not register that community.");
    }
  }

  return (
    <form className="community-setup is-stack" onSubmit={(event) => void onSubmit(event)}>
      {error ? <p className="error">{error}</p> : null}
      <div className="cr-paper">
        <section className={open === "details" ? "cr-step is-open" : "cr-step"} id="step-details">
          <h2>
            <button type="button" className="cr-step-toggle" aria-expanded={open === "details"} onClick={() => toggle("details")}>
              <em>Community Details</em>
              <i className="cr-step-caret" aria-hidden="true" />
            </button>
          </h2>
          <label className="field cr-quiet">
            <span className="sr-only">Community Name</span>
            <input
              value={title}
              placeholder="Community Name"
              aria-label="Community Name"
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <p className="cr-about-label">About</p>
          <label className="field cr-quiet cr-long">
            <textarea
              rows={6}
              maxLength={4000}
              value={about}
              placeholder="Who it is for, and what you do together."
              aria-label="About"
              onChange={(event) => setAbout(event.target.value)}
            />
          </label>
          <p className="cr-about-label">Areas</p>
          {areas.map((area, index) => (
            <div className="cr-known-row" key={index}>
              <label className="field cr-quiet">
                <span className="sr-only">Area {index + 1}</span>
                <input
                  value={area}
                  placeholder="Area"
                  aria-label={`Area ${index + 1}`}
                  onChange={(event) => {
                    const next = [...areas];
                    next[index] = event.target.value;
                    setAreas(next);
                  }}
                />
              </label>
              {areas.length > 1 ? (
                <button
                  type="button"
                  className="cr-text-remove"
                  onClick={() => setAreas(areas.filter((_, item) => item !== index))}
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
          <button className="cr-outline-btn" type="button" onClick={() => setAreas([...areas, ""])}>
            Add area
          </button>
          <div className="community-setup-actions">
            <button className="btn btn-primary" type="button" onClick={() => show(nextIncomplete("details"))}>
              Next
            </button>
          </div>
        </section>

        <section className={open === "founder" ? "cr-step is-open" : "cr-step"} id="step-founder">
          <h2>
            <button type="button" className="cr-step-toggle" aria-expanded={open === "founder"} onClick={() => toggle("founder")}>
              <em>Founder Details</em>
              <i className="cr-step-caret" aria-hidden="true" />
            </button>
          </h2>
          <div className="cr-grid-2">
            <label className="field cr-quiet">
              <span className="sr-only">Founder Name</span>
              <input
                value={founderName}
                placeholder="Founder Name"
                aria-label="Founder Name"
                maxLength={120}
                onChange={(event) => setFounderName(event.target.value)}
              />
            </label>
            <label className="field cr-quiet">
              <span className="sr-only">Founder Email</span>
              <input
                type="email"
                value={founderEmail}
                placeholder="Founder Email"
                aria-label="Founder Email"
                onChange={(event) => setFounderEmail(event.target.value)}
              />
            </label>
          </div>
          <div className="community-setup-actions">
            <button className="btn btn-primary" type="button" onClick={() => show(nextIncomplete("founder"))}>
              Next
            </button>
          </div>
        </section>

        <section className={open === "contact" ? "cr-step is-open" : "cr-step"} id="step-contact">
          <h2>
            <button type="button" className="cr-step-toggle" aria-expanded={open === "contact"} onClick={() => toggle("contact")}>
              <em>Contact &amp; Socials</em>
              <i className="cr-step-caret" aria-hidden="true" />
            </button>
          </h2>
          <div className="cr-grid-2">
            <label className="field cr-quiet">
              <span className="sr-only">Email Address</span>
              <input
                type="email"
                value={contactEmail}
                placeholder="Email Address"
                aria-label="Email Address"
                onChange={(event) => setContactEmail(event.target.value)}
              />
            </label>
            <label className="field cr-quiet">
              <span className="sr-only">Contact Number</span>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                placeholder="Contact Number"
                aria-label="Contact Number"
                onChange={(event) => setPhone(event.target.value)}
              />
            </label>
          </div>
          <label className="field cr-quiet">
            <span className="sr-only">Website</span>
            <input
              value={websiteUrl}
              placeholder="Website"
              aria-label="Website"
              onChange={(event) => setWebsiteUrl(event.target.value)}
            />
          </label>
          <p className="cr-about-label">Social Handles</p>
          <div className="cr-grid-3">
            <label className="field cr-quiet">
              <span className="sr-only">Instagram</span>
              <input
                value={instagramUrl}
                placeholder="@Instagram"
                aria-label="Instagram"
                onChange={(event) => setInstagramUrl(event.target.value)}
              />
            </label>
            <label className="field cr-quiet">
              <span className="sr-only">Facebook</span>
              <input
                value={facebookUrl}
                placeholder="Facebook"
                aria-label="Facebook"
                onChange={(event) => setFacebookUrl(event.target.value)}
              />
            </label>
            <label className="field cr-quiet">
              <span className="sr-only">TikTok</span>
              <input
                value={tiktokUrl}
                placeholder="TikTok"
                aria-label="TikTok"
                onChange={(event) => setTiktokUrl(event.target.value)}
              />
            </label>
          </div>
          <PolicyConsent
            acceptTerms={acceptTerms}
            acceptPrivacy={acceptPrivacy}
            onTerms={setAcceptTerms}
            onPrivacy={setAcceptPrivacy}
          />
          <PolicyLinks />
          <div className="community-setup-actions">
            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending ? "Please Wait" : "Submit"}
            </button>
          </div>
        </section>
      </div>
    </form>
  );
}
