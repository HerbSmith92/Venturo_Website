"use client";

import { useState } from "react";
import { saveClaimedCommunity } from "@/app/community-claim-actions";

type StepKey = "details" | "founder" | "contact";

export function CommunityForm({
  id,
  title: initialTitle,
  about: initialAbout,
  areas: initialAreas,
  founderName: initialFounder,
  founderEmail: initialFounderEmail,
  contactEmail: initialContactEmail,
  phone: initialPhone,
  websiteUrl: initialWebsite,
  instagramUrl: initialInstagram,
  facebookUrl: initialFacebook,
  tiktokUrl: initialTiktok,
}: {
  id: string;
  title: string;
  about: string;
  areas: string[];
  founderName: string;
  founderEmail: string;
  contactEmail: string;
  phone: string;
  websiteUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
}) {
  const [open, setOpen] = useState<StepKey | null>("details");
  const [title, setTitle] = useState(initialTitle);
  const [about, setAbout] = useState(initialAbout);
  const [areas, setAreas] = useState<string[]>(initialAreas.length > 0 ? initialAreas : [""]);
  const [founderName, setFounderName] = useState(initialFounder);
  const [founderEmail, setFounderEmail] = useState(initialFounderEmail);
  const [contactEmail, setContactEmail] = useState(initialContactEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsite);
  const [instagramUrl, setInstagramUrl] = useState(initialInstagram);
  const [facebookUrl, setFacebookUrl] = useState(initialFacebook);
  const [tiktokUrl, setTiktokUrl] = useState(initialTiktok);
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

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!detailsDone) {
      event.preventDefault();
      setError("Add the community name and what it is about.");
      show("details");
      return;
    }
    if (!founderDone) {
      event.preventDefault();
      setError("Add the founder's name.");
      show("founder");
      return;
    }
    if (!contactDone) {
      event.preventDefault();
      setError("Add a contact email or a contact number.");
      show("contact");
      return;
    }
    setError(null);
    setPending(true);
  }

  return (
    <form className="community-setup is-stack" action={saveClaimedCommunity} onSubmit={onSubmit}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="areas" value={areas.join("\n")} />
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
              name="title"
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
              name="about"
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
                name="founder_name"
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
                name="founder_email"
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
                name="contact_email"
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
                name="phone"
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
              name="website_url"
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
                name="instagram_url"
                value={instagramUrl}
                placeholder="@Instagram"
                aria-label="Instagram"
                onChange={(event) => setInstagramUrl(event.target.value)}
              />
            </label>
            <label className="field cr-quiet">
              <span className="sr-only">Facebook</span>
              <input
                name="facebook_url"
                value={facebookUrl}
                placeholder="Facebook"
                aria-label="Facebook"
                onChange={(event) => setFacebookUrl(event.target.value)}
              />
            </label>
            <label className="field cr-quiet">
              <span className="sr-only">TikTok</span>
              <input
                name="tiktok_url"
                value={tiktokUrl}
                placeholder="TikTok"
                aria-label="TikTok"
                onChange={(event) => setTiktokUrl(event.target.value)}
              />
            </label>
          </div>
          <div className="community-setup-actions">
            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending ? "Please Wait" : "Save"}
            </button>
          </div>
        </section>
      </div>
    </form>
  );
}
