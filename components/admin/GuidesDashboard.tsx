"use client";

import { useMemo, useState } from "react";
import { createCuratedEventGuide, duplicateCuratedEventGuide } from "@/app/admin/event-guide-actions";
import { createCuratedGuide, duplicateCuratedGuide } from "@/app/admin/guide-actions";
import { BulkForm } from "@/components/admin/BulkForm";
import { bulkGuideAction } from "@/app/admin/bulk-actions";
import type { GuideQueueRow } from "@/lib/control-room-guides";
import { formatBoardDay, formatClock } from "@/lib/control-room-shared";
import { guideAboutLabel, guideShapeLabel } from "@/lib/guide-shared";
import {
  guideBoardActionLabel,
  guideBoardStatus,
  guideBoardStatusLabel,
  type GuideBoardStatus,
} from "@/lib/guides-board";

const PAGE_SIZE = 6;

type Tab = "all" | GuideBoardStatus;
type SortKey = "newest" | "oldest" | "title";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All guides" },
  { id: "review", label: "Awaiting review" },
  { id: "published", label: "Published" },
  { id: "draft", label: "Drafts" },
  { id: "scheduled", label: "Scheduled" },
];

function hrefFor(guide: GuideQueueRow) {
  return guide.about === "events" ? `/admin/event-guides/${guide.id}` : `/admin/guides/${guide.id}`;
}

function authorInitial(name: string | null) {
  const clean = name?.trim();
  if (!clean) return "V";
  return clean.charAt(0).toUpperCase();
}

export function GuidesDashboard({
  guides,
  canAdmin,
  error,
}: {
  guides: GuideQueueRow[];
  canAdmin: boolean;
  error?: string;
}) {
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [author, setAuthor] = useState("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);

  const counts = useMemo(() => {
    const next = { all: guides.length, published: 0, review: 0, changes: 0, draft: 0, scheduled: 0, archived: 0 };
    for (const guide of guides) next[guideBoardStatus(guide)] += 1;
    return next;
  }, [guides]);

  const authors = useMemo(() => {
    const names = [...new Set(guides.map((guide) => guide.author_name).filter(Boolean))] as string[];
    return names.sort((a, b) => a.localeCompare(b, "en-ZA"));
  }, [guides]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = guides.filter((guide) => {
      const status = guideBoardStatus(guide);
      if (tab !== "all" && status !== tab) return false;
      if (author !== "all" && guide.author_name !== author) return false;
      if (category !== "all" && guide.about !== category) return false;
      if (!needle) return true;
      return [guide.title, guide.author_name, guideAboutLabel(guide.about), guideShapeLabel(guide.shape)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
    rows.sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title, "en-ZA");
      const diff = a.updated_at.localeCompare(b.updated_at);
      return sort === "oldest" ? diff : -diff;
    });
    return rows;
  }, [author, category, guides, query, sort, tab]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const returnTo = "/admin/guides";

  function setFilter(next: Tab) {
    setTab(next);
    setPage(1);
  }

  const table = (
    <div className="guides-board-table">
      <table>
        <thead>
          <tr>
            {canAdmin ? <th className="guides-board-check" /> : null}
            <th>Guide</th>
            <th>Author</th>
            <th>Status</th>
            <th>Updated</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {slice.length === 0 ? (
            <tr>
              <td colSpan={canAdmin ? 6 : 5} className="muted">
                No guides in this view yet.
              </td>
            </tr>
          ) : (
            slice.map((guide) => {
              const status = guideBoardStatus(guide);
              const href = hrefFor(guide);
              const subtitle = `${guideAboutLabel(guide.about)} · ${guideShapeLabel(guide.shape)}`;
              return (
                <tr key={`${guide.about}-${guide.id}`}>
                  {canAdmin ? (
                    <td className="guides-board-check">
                      {guide.about === "activities" ? (
                        <input
                          type="checkbox"
                          name="id"
                          value={guide.id}
                          form="bulk-guides"
                          aria-label={`Select ${guide.title}`}
                        />
                      ) : null}
                    </td>
                  ) : null}
                  <td>
                    <a className="guides-board-guide" href={href}>
                      {guide.cover ? (
                        <img src={guide.cover} alt="" />
                      ) : (
                        <span className="guides-board-thumb" aria-hidden="true" />
                      )}
                      <span>
                        <strong>{guide.title}</strong>
                        <small>{subtitle}</small>
                      </span>
                    </a>
                  </td>
                  <td>
                    <div className="guides-board-author">
                      {guide.author_photo ? (
                        <img src={guide.author_photo} alt="" />
                      ) : (
                        <span aria-hidden="true">{authorInitial(guide.author_name)}</span>
                      )}
                      <em>{guide.author_name || "Venturo"}</em>
                    </div>
                  </td>
                  <td>
                    <span className={`guides-board-status is-${status}`}>{guideBoardStatusLabel(status)}</span>
                    {status === "scheduled" && guide.publish_at ? (
                      <small className="guides-board-when">{formatClock(guide.publish_at)}</small>
                    ) : null}
                  </td>
                  <td>{formatBoardDay(guide.updated_at)}</td>
                  <td>
                    <div className="guides-board-actions">
                      <a className="guides-board-edit" href={href}>
                        {guideBoardActionLabel(status, canAdmin)}
                      </a>
                      <details>
                        <summary aria-label={`More for ${guide.title}`}>···</summary>
                        <div>
                          <form action={guide.about === "events" ? duplicateCuratedEventGuide : duplicateCuratedGuide}>
                            <input type="hidden" name="id" value={guide.id} />
                            <button type="submit">Duplicate</button>
                          </form>
                          {status === "published" ? <a href={`/guides/${guide.slug}`}>Public page</a> : null}
                        </div>
                      </details>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <section className="guides-board">
      <header className="guides-board-head">
        <div>
          <p className="guides-board-crumb">
            Content <span>/</span> Guides
          </p>
          <h1>Guides</h1>
          <p className="lede">Create, review &amp; publish your next great discovery.</p>
        </div>
        <div className="guides-board-head-actions">
          {canAdmin ? (
            <a className="guides-board-ghost" href="/admin/authors">
              Manage authors
            </a>
          ) : null}
          <details className="guides-board-create">
            <summary>+ Create guide</summary>
            <div>
              <form action={createCuratedGuide}>
                <input type="hidden" name="shape" value="spotlight" />
                <button type="submit">Spotlight Guide</button>
              </form>
              <form action={createCuratedGuide}>
                <input type="hidden" name="shape" value="roundup" />
                <button type="submit">Collection Guide</button>
              </form>
              <form action={createCuratedEventGuide}>
                <button type="submit">Event Guide</button>
              </form>
            </div>
          </details>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <div className="guides-board-stats">
        <button type="button" className={tab === "published" ? "is-active" : undefined} onClick={() => setFilter("published")}>
          <span>Published</span>
          <strong>{counts.published}</strong>
        </button>
        <button type="button" className={tab === "review" ? "is-active" : undefined} onClick={() => setFilter("review")}>
          <span>Awaiting review</span>
          <strong>{counts.review}</strong>
        </button>
        <button type="button" className={tab === "draft" ? "is-active" : undefined} onClick={() => setFilter("draft")}>
          <span>Drafts</span>
          <strong>{counts.draft}</strong>
        </button>
        <button type="button" className={tab === "scheduled" ? "is-active" : undefined} onClick={() => setFilter("scheduled")}>
          <span>Scheduled</span>
          <strong>{counts.scheduled}</strong>
        </button>
      </div>

      <div className="guides-board-tabs">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? "is-active" : undefined}
            onClick={() => setFilter(item.id)}
          >
            {item.label} <span>{item.id === "all" ? counts.all : counts[item.id]}</span>
          </button>
        ))}
      </div>

      <div className="guides-board-tools">
        <label>
          <span className="sr-only">Search guides</span>
          <input
            type="search"
            value={query}
            placeholder="Search guides..."
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <select
          value={author}
          onChange={(event) => {
            setAuthor(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">All authors</option>
          {authors.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">All categories</option>
          <option value="activities">Activities</option>
          <option value="events">Events</option>
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="title">Title</option>
        </select>
      </div>

      {canAdmin ? (
        <BulkForm formId="bulk-guides" noun="Guide" nouns="Guides" action={bulkGuideAction} returnTo={returnTo}>
          {table}
        </BulkForm>
      ) : (
        table
      )}

      <footer className="guides-board-foot">
        <p>
          Showing {slice.length} of {filtered.length} guides
        </p>
        <div className="guides-board-pages">
          <button type="button" disabled={safePage <= 1} onClick={() => setPage((current) => current - 1)}>
            ‹
          </button>
          {Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
            <button
              key={number}
              type="button"
              className={number === safePage ? "is-current" : undefined}
              onClick={() => setPage(number)}
            >
              {number}
            </button>
          ))}
          <button type="button" disabled={safePage >= pages} onClick={() => setPage((current) => current + 1)}>
            ›
          </button>
        </div>
      </footer>

      {canAdmin && counts.review > 0 ? (
        <div className="guides-board-banner">
          <p>
            {counts.review} {counts.review === 1 ? "guide is" : "guides are"} ready for review. Check the content
            &amp; author credit before publishing.
          </p>
          <button type="button" onClick={() => setFilter("review")}>
            View review queue
          </button>
        </div>
      ) : null}
    </section>
  );
}
