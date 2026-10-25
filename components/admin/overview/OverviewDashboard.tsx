import { OverviewFilters } from "@/components/admin/overview/OverviewFilters";
import { saveOverviewThresholds } from "@/app/admin/overview-actions";
import type { AttentionItem, ContentCard, OverviewModel } from "@/lib/overview/load";
import { formatWhen } from "@/lib/overview/metrics";

export function OverviewDashboard({ model, notice }: { model: OverviewModel; notice?: string | null }) {
  const queueParams = new URLSearchParams({
    range: model.range.key,
    platform: model.platform,
  });
  if (model.range.key === "custom") {
    queueParams.set("from", model.from);
    queueParams.set("to", model.to);
  }
  const queueHref = `/admin/attention?${queueParams.toString()}`;
  const preview = model.attention.slice(0, 4);

  return (
    <section className="ops">
      <header className="ops-head">
        <div>
          <p className="eyebrow">Your adventure HQ</p>
          <h1>Control Room</h1>
          <p className="lede">Here is what needs attention across the website, iOS, and Android.</p>
        </div>
        <OverviewFilters
          range={model.range.key}
          platform={model.platform}
          from={model.from}
          to={model.to}
          loadedAt={model.loadedAt}
        />
      </header>

      {notice ? <p className="notice">{notice}</p> : null}
      {model.banner ? <p className="notice">{model.banner}</p> : null}

      <section className="ops-section" aria-labelledby="ops-attention">
        <div className="ops-section-head">
          <h2 id="ops-attention">
            Needs attention <span>{model.attentionTotal}</span>
          </h2>
          <a href={queueHref}>View queue</a>
        </div>
        {preview.length === 0 ? (
          <p className="ops-empty">Nothing in this queue. Customer access, money, and event deadlines show here when a check finds them.</p>
        ) : (
          <div className="ops-attention">
            {preview.map((item) => (
              <AttentionCard key={item.id} item={item} />
            ))}
          </div>
        )}
        {model.attentionTotal > preview.length ? (
          <p className="ops-more">
            <a href={queueHref}>{model.attentionTotal - preview.length} more in the queue</a>
          </p>
        ) : null}
      </section>

      <section className="ops-section" aria-labelledby="ops-snapshot">
        <div className="ops-section-head">
          <h2 id="ops-snapshot">Business snapshot</h2>
          <p>{model.range.label} · {model.platformName}</p>
        </div>
        <div className="ops-metrics">
          {model.headlines.map((card) => (
            <article key={card.label} className="ops-metric">
              {card.href ? (
                <a href={card.href}>
                  <MetricBody card={card} />
                </a>
              ) : (
                <MetricBody card={card} />
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="ops-section" aria-labelledby="ops-upcoming">
        <div className="ops-section-head">
          <h2 id="ops-upcoming">Coming up next</h2>
          <a href="/admin/events?status=approved">View calendar</a>
        </div>
        <p className="ops-kicker">Published events · next 7 days · Johannesburg time</p>
        {model.upcomingState === "unavailable" ? <p className="ops-empty">Data unavailable</p> : null}
        {model.upcomingState === "empty" ? <p className="ops-empty">No published events in the next 7 days.</p> : null}
        {model.upcomingState === "ready" ? (
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Date & time</th>
                  <th>Host</th>
                  <th>Paid</th>
                  <th>RSVPs</th>
                  <th>Capacity</th>
                  <th>Sales</th>
                  <th>Readiness</th>
                  <th>Check-ins</th>
                </tr>
              </thead>
              <tbody>
                {model.upcoming.map((row) => (
                  <tr key={row.id} className={row.warn ? "is-warn" : undefined}>
                    <td data-label="Event">
                      <a href={row.href}>{row.title}</a>
                      <span className="ops-status">{row.status}</span>
                    </td>
                    <td data-label="Date & time">{row.when}</td>
                    <td data-label="Host">{row.host}</td>
                    <td data-label="Paid">{row.paid}</td>
                    <td data-label="RSVPs">{row.rsvps}</td>
                    <td data-label="Capacity">{row.capacity}</td>
                    <td data-label="Sales">{row.sales}</td>
                    <td data-label="Readiness">{row.readiness}</td>
                    <td data-label="Check-ins">{row.checkIns}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="ops-section" aria-labelledby="ops-content">
        <div className="ops-section-head">
          <h2 id="ops-content">Your content, at a glance</h2>
        </div>
        <div className="ops-content">
          {model.content.map((card) => (
            <ContentBlock key={card.title} card={card} />
          ))}
        </div>
      </section>

      <div className="ops-split">
        <section className="ops-section" aria-labelledby="ops-money">
          <div className="ops-section-head">
            <h2 id="ops-money">Money overview</h2>
          </div>
          <p className="ops-kicker">{model.range.label} · whole platform when a platform filter is on</p>
          <div className="ops-money">
            {model.money.map((line) => (
              <article key={line.label}>
                <h3>{line.label}</h3>
                {line.href && line.display !== "Data unavailable" ? (
                  <a href={line.href}>{line.display}</a>
                ) : (
                  <strong>{line.display}</strong>
                )}
                <p>{line.hint}</p>
              </article>
            ))}
          </div>
          <p className="ops-kicker">{model.moneyNote}</p>
        </section>

        <section className="ops-section" aria-labelledby="ops-growth">
          <div className="ops-section-head">
            <h2 id="ops-growth">Discovery opportunities</h2>
          </div>
          <ul className="ops-insights">
            {model.insights.map((insight) => (
              <li key={insight.title}>
                <h3>{insight.title}</h3>
                <p>{insight.body}</p>
                {insight.href ? <a href={insight.href}>View the list</a> : null}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="ops-section" aria-labelledby="ops-health">
        <div className="ops-section-head">
          <h2 id="ops-health">Platform health</h2>
        </div>
        <ul className="ops-health">
          {model.health.map((row) => (
            <li key={row.name} className={`is-${row.tone}`}>
              <span className="ops-dot" aria-hidden="true" />
              <strong>{row.name}</strong>
              <em>{row.label}</em>
              <small>{row.checked}</small>
            </li>
          ))}
        </ul>
      </section>

      <details className="ops-details">
        <summary>How these figures are counted</summary>
        <dl>
          {model.definitions.map((item) => (
            <div key={item.title}>
              <dt>{item.title}</dt>
              <dd>{item.body}</dd>
            </div>
          ))}
        </dl>
      </details>

      {model.canEditThresholds ? (
        <form className="ops-thresholds" action={saveOverviewThresholds}>
          <h2>Thresholds</h2>
          <p>These apply to overdue queues, low sales, membership endings, payouts, listing checks, and ticket emails.</p>
          <div>
            <Threshold name="overdue_hours" label="Overdue hours" value={model.settings.overdueHours} />
            <Threshold name="low_sales_percent" label="Low sales %" value={model.settings.lowSalesPercent} />
            <Threshold name="low_sales_within_days" label="Low sales within days" value={model.settings.lowSalesWithinDays} />
            <Threshold name="membership_ending_days" label="Membership ending days" value={model.settings.membershipEndingDays} />
            <Threshold name="payout_due_days" label="Payout due days" value={model.settings.payoutDueDays} />
            <Threshold name="listing_check_days" label="Listing check days" value={model.settings.listingCheckDays} />
            <Threshold name="ticket_email_grace_minutes" label="Ticket email grace minutes" value={model.settings.ticketEmailGraceMinutes} />
          </div>
          <button className="btn btn-primary" type="submit">Save thresholds</button>
        </form>
      ) : null}

      <p className="ops-kicker">Loaded {formatWhen(model.loadedAt)} SAST. Stock totals for this Johannesburg day are stored so later changes do not erase them.</p>
    </section>
  );
}

function MetricBody({ card }: { card: OverviewModel["headlines"][number] }) {
  return (
    <>
      <span>{card.label}</span>
      <strong>{card.display}</strong>
      <small>{card.scope}</small>
      <em>{card.comparison}</em>
      {card.hint ? <p>{card.hint}</p> : null}
    </>
  );
}

function AttentionCard({ item }: { item: AttentionItem }) {
  return (
    <a className={`ops-alert is-${item.severity}`} href={item.href}>
      <span>{item.type}</span>
      <strong>{item.item}</strong>
      <small>
        {item.severity} · {item.age}
        {item.owner ? ` · ${item.owner}` : ""}
      </small>
    </a>
  );
}

function ContentBlock({ card }: { card: ContentCard }) {
  return (
    <article className="ops-area">
      <h3>
        <a href={card.href}>{card.title}</a>
      </h3>
      <ul>
        {card.summary.map((item) => (
          <li key={item.label}>
            <span>{item.label}</span>
            {item.href && item.display !== "Data unavailable" ? <a href={item.href}>{item.display}</a> : <strong>{item.display}</strong>}
          </li>
        ))}
      </ul>
      <h4>Attention</h4>
      <ul>
        {card.attention.map((item) => (
          <li key={item.label}>
            <span>{item.label}</span>
            {item.href && item.display !== "Data unavailable" ? <a href={item.href}>{item.display}</a> : <strong>{item.display}</strong>}
          </li>
        ))}
      </ul>
      <h4>Performance</h4>
      <ul>
        {card.performance.map((item) => (
          <li key={item.label}>
            <span>{item.label}</span>
            <strong>{item.display}</strong>
          </li>
        ))}
      </ul>
      {card.archived ? (
        <p>
          <a href={card.archived.href}>
            {card.archived.label} {card.archived.display}
          </a>
        </p>
      ) : null}
      {card.note ? <p className="ops-kicker">{card.note}</p> : null}
    </article>
  );
}

function Threshold({ name, label, value }: { name: string; label: string; value: number }) {
  return (
    <label>
      <span>{label}</span>
      <input name={name} type="number" min={0} defaultValue={value} />
    </label>
  );
}
