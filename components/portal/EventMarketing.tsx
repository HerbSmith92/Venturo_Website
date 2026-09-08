"use client";

import { useMemo, useState } from "react";
import type { EventMarketingData } from "@/lib/event-marketing";
import { campaignPublicUrl, inviteMailto, invitePublicUrl } from "@/lib/event-links";
import { portalEventSectionHref } from "@/lib/portal";
import type { VenturoEvent } from "@/lib/event-types";

const TABS = [
  { id: "codes", label: "Ambassador Codes" },
  { id: "networks", label: "Ambassador Networks" },
  { id: "promoters", label: "Ambassadors" },
  { id: "campaigns", label: "Campaigns" },
  { id: "invites", label: "Invite Guests" },
] as const;

type Tab = (typeof TABS)[number]["id"];

function asTab(raw: string): Tab {
  if (raw === "ambassadors") return "promoters";
  if (TABS.some((tab) => tab.id === raw)) return raw as Tab;
  return "codes";
}

function inviteStatusLabel(status: string) {
  if (status === "opened") return "Opened";
  if (status === "booked") return "Booked";
  if (status === "claimed" || status === "accepted") return "On the list";
  if (status === "revoked") return "Revoked";
  return "Waiting";
}

export function EventMarketing({
  event,
  data,
  tab,
}: {
  event: VenturoEvent;
  data: EventMarketingData;
  tab: string;
}) {
  const current = asTab(tab);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");

  const origin = useMemo(
    () => (typeof window === "undefined" ? "" : window.location.origin),
    [],
  );

  async function post(kind: string, payload: Record<string, unknown>) {
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/host/events/${event.id}/marketing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: kind, ...payload }),
      });
      const body = (await response.json()) as { error?: string; notice?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not save.");
      setNotice(body.notice ?? "Saved.");
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save.");
      setPending(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied.");
    } catch {
      setError("Could not copy.");
    }
  }

  return (
    <section>
      <p className="eyebrow">Marketing</p>
      <h2>Get People In The Door</h2>
      <div className="chips host-settings-tabs" role="tablist" aria-label="Marketing">
        {TABS.map((item) => (
          <a
            key={item.id}
            className={`chip${current === item.id ? " on" : ""}`}
            href={`${portalEventSectionHref(event.id, "marketing")}?tab=${item.id}`}
            role="tab"
            aria-selected={current === item.id}
          >
            {item.label}
          </a>
        ))}
      </div>

      {current === "codes" ? (
        <div className="studio-card">
          <h3>Ambassador Codes</h3>
          <p className="muted">
            Start here. Percent off, rand off, or unlock a hidden ticket. Hang it on a network next.
          </p>
          <ul className="stack-list">
            {data.codes.length === 0 ? (
              <li className="muted">No codes yet.</li>
            ) : (
              data.codes.map((code) => {
                const network = data.networks.find((item) => item.id === code.networkId);
                return (
                  <li key={code.id}>
                    <strong>{code.code}</strong> · {code.kind}
                    {code.value != null ? ` · ${code.value}` : ""}
                    {network ? ` · ${network.name}` : ""}
                  </li>
                );
              })
            )}
          </ul>
          <form
            onSubmit={(submit) => {
              submit.preventDefault();
              const payload = Object.fromEntries(new FormData(submit.currentTarget).entries());
              void post("code", {
                code: String(payload.code ?? ""),
                kind: String(payload.kind ?? "percent"),
                value: payload.value ? Number(payload.value) : null,
                hiddenTicketTypeId: String(payload.hiddenTicketTypeId ?? "") || null,
              });
            }}
          >
            <div className="field-row">
              <label className="field">
                <span>Code</span>
                <input name="code" required placeholder="SUNRISE10" />
              </label>
              <label className="field">
                <span>Kind</span>
                <select name="kind" defaultValue="percent">
                  <option value="percent">Percent off</option>
                  <option value="amount">Rand off</option>
                  <option value="hidden_ticket">Hidden ticket</option>
                </select>
              </label>
            </div>
            <div className="field-row">
              <label className="field">
                <span>Value</span>
                <input name="value" inputMode="decimal" placeholder="10" />
              </label>
              <label className="field">
                <span>Hidden Ticket Type</span>
                <select name="hiddenTicketTypeId" defaultValue="">
                  <option value="">None</option>
                  {event.ticketTypes.map((ticket) => (
                    <option key={ticket.id} value={ticket.id}>
                      {ticket.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button className="btn btn-primary" type="submit" disabled={pending}>
              Add Code
            </button>
          </form>
        </div>
      ) : null}

      {current === "networks" ? (
        <div className="studio-card">
          <h3>Ambassador Networks</h3>
          <p className="muted">
            Name the group, then hang codes on it. Ambassadors join this network after.
          </p>
          <ul className="stack-list">
            {data.networks.length === 0 ? (
              <li className="muted">No networks yet.</li>
            ) : (
              data.networks.map((network) => {
                const hanging = data.codes.filter((code) => code.networkId === network.id);
                return (
                  <li key={network.id}>
                    {network.name}
                    {hanging.length
                      ? ` · ${hanging.map((code) => code.code).join(", ")}`
                      : ""}
                  </li>
                );
              })
            )}
          </ul>
          <form
            onSubmit={(submit) => {
              submit.preventDefault();
              const form = submit.currentTarget;
              const payload = new FormData(form);
              const codeIds = payload.getAll("codeId").map(String);
              void post("network", {
                name: String(payload.get("name") ?? ""),
                codeIds,
              });
            }}
          >
            <label className="field">
              <span>Network Name</span>
              <input name="name" required />
            </label>
            {data.codes.length > 0 ? (
              <fieldset className="field">
                <legend>Hang Codes</legend>
                {data.codes.map((code) => (
                  <label key={code.id} className="check-row">
                    <input type="checkbox" name="codeId" value={code.id} />
                    {code.code}
                    {code.networkId ? " (already on a network)" : ""}
                  </label>
                ))}
              </fieldset>
            ) : (
              <p className="muted">Make a code first, then hang it here.</p>
            )}
            <button className="btn btn-primary" type="submit" disabled={pending}>
              Add Network
            </button>
          </form>
        </div>
      ) : null}

      {current === "promoters" ? (
        <div className="studio-card">
          <h3>Ambassadors</h3>
          <p className="muted">
            People who share the code. Attach them to a network. Incentive payout comes later.
          </p>
          <ul className="stack-list">
            {data.promoters.length === 0 ? (
              <li className="muted">No Ambassadors yet.</li>
            ) : (
              data.promoters.map((person) => {
                const network = data.networks.find((item) => item.id === person.networkId);
                return (
                  <li key={person.id}>
                    {person.name} · {person.email} · {person.incentivePct}%
                    {network ? ` · ${network.name}` : ""}
                  </li>
                );
              })
            )}
          </ul>
          <form
            onSubmit={(submit) => {
              submit.preventDefault();
              const form = submit.currentTarget;
              const payload = Object.fromEntries(new FormData(form).entries());
              void post("promoter", {
                name: String(payload.name ?? ""),
                email: String(payload.email ?? ""),
                incentivePct: Number(payload.incentivePct ?? 0),
                networkId: String(payload.networkId ?? "") || null,
              });
            }}
          >
            <div className="field-row">
              <label className="field">
                <span>Name</span>
                <input name="name" required />
              </label>
              <label className="field">
                <span>Email</span>
                <input name="email" type="email" required />
              </label>
            </div>
            <div className="field-row">
              <label className="field">
                <span>Incentive %</span>
                <input name="incentivePct" inputMode="decimal" defaultValue="10" />
              </label>
              <label className="field">
                <span>Network</span>
                <select name="networkId" defaultValue="">
                  <option value="">None</option>
                  {data.networks.map((network) => (
                    <option key={network.id} value={network.id}>
                      {network.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button className="btn btn-primary" type="submit" disabled={pending}>
              Add Ambassador
            </button>
          </form>
        </div>
      ) : null}

      {current === "campaigns" ? (
        <div className="studio-card">
          <h3>Campaigns</h3>
          <p className="muted">
            One unique link per advert. Paste it on Instagram, Meta Ads, or TikTok. Visits show
            which advert to keep &amp; which to scrap. Your own clicks do not count.
          </p>
          {data.campaigns.length === 0 ? (
            <p className="muted">No campaign links yet.</p>
          ) : (
            <ul className="campaign-list">
              {[...data.campaigns]
                .sort((a, b) => b.views - a.views || a.name.localeCompare(b.name))
                .map((campaign, _, ranked) => {
                  const url = campaignPublicUrl(event.slug, campaign.slug, origin);
                  const total = ranked.reduce((sum, item) => sum + item.views, 0);
                  const share = total ? Math.round((campaign.views / total) * 100) : 0;
                  const best = ranked[0]?.views ?? 0;
                  return (
                    <li key={campaign.id} className="campaign-row">
                      <div>
                        <strong>{campaign.name}</strong>
                        <p className="muted campaign-url">{url}</p>
                        {campaign.views > 0 && campaign.views === best ? (
                          <p className="eyebrow">Best so far</p>
                        ) : campaign.views === 0 ? (
                          <p className="muted">No clicks yet.</p>
                        ) : (
                          <p className="muted">{share}% of campaign visits</p>
                        )}
                      </div>
                      <div className="campaign-stat">
                        <p className="eyebrow">Visits</p>
                        <strong>{campaign.views}</strong>
                      </div>
                      <button className="btn btn-secondary" type="button" onClick={() => void copy(url)}>
                        Copy Link
                      </button>
                    </li>
                  );
                })}
            </ul>
          )}
          <form
            onSubmit={(submit) => {
              submit.preventDefault();
              const name = String(new FormData(submit.currentTarget).get("name") ?? "");
              void post("campaign", { name });
            }}
          >
            <label className="field">
              <span>Advert Name</span>
              <input name="name" required placeholder="TikTok ads" />
            </label>
            <button className="btn btn-primary" type="submit" disabled={pending}>
              Add Campaign Link
            </button>
          </form>
        </div>
      ) : null}

      {current === "invites" ? (
        <div className="studio-card">
          <h3>Invite Guests</h3>
          <p className="muted">
            One unique link per person. Copy it or open a mail—we do not send email yet. Opened
            means they clicked. Booked means they bought a ticket.
          </p>
          {(() => {
            const rows = data.invites.filter((invite) => invite.kind === "invite");
            if (rows.length === 0) {
              return <p className="muted">No invites yet.</p>;
            }
            return (
              <ul className="campaign-list">
                {rows.map((invite) => {
                  const url = invitePublicUrl(invite.token, origin);
                  const mail = inviteMailto(invite.email, event.title, url);
                  return (
                    <li key={invite.id} className="campaign-row">
                      <div>
                        <strong>{invite.name || invite.email}</strong>
                        {invite.name ? <p className="muted">{invite.email}</p> : null}
                        <p className="muted campaign-url">{url}</p>
                      </div>
                      <div className="campaign-stat">
                        <p className="eyebrow">Status</p>
                        <strong className="invite-status">{inviteStatusLabel(invite.status)}</strong>
                      </div>
                      <div className="invite-actions">
                        <button className="btn btn-secondary" type="button" onClick={() => void copy(url)}>
                          Copy Link
                        </button>
                        <a className="btn btn-ghost" href={mail}>
                          Open Mail
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            );
          })()}
          {data.pastAttendees.length > 0 ? (
            <div className="invite-past">
              <p className="eyebrow">On This Door List</p>
              <div className="chips">
                {data.pastAttendees.slice(0, 12).map((person) => (
                  <button
                    key={person.email}
                    className="chip"
                    type="button"
                    onClick={() => {
                      setGuestName(person.name);
                      setGuestEmail(person.email);
                    }}
                  >
                    {person.name || person.email}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <form
            onSubmit={(submit) => {
              submit.preventDefault();
              void post("invite", {
                email: guestEmail,
                name: guestName,
                inviteKind: "invite",
              });
            }}
          >
            <div className="field-row">
              <label className="field">
                <span>Name</span>
                <input
                  name="name"
                  value={guestName}
                  onChange={(change) => setGuestName(change.target.value)}
                  placeholder="Thabo"
                />
              </label>
              <label className="field">
                <span>Email</span>
                <input
                  name="email"
                  type="email"
                  required
                  value={guestEmail}
                  onChange={(change) => setGuestEmail(change.target.value)}
                  placeholder="thabo@email.com"
                />
              </label>
            </div>
            <button className="btn btn-primary" type="submit" disabled={pending}>
              Create Invite Link
            </button>
          </form>
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}
    </section>
  );
}
