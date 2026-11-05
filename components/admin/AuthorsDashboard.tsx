"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createGuideAuthor, deleteGuideAuthor } from "@/app/admin/author-actions";
import { AuthorInvitePanel } from "@/components/admin/AuthorInvitePanel";
import type { GuideAuthorInviteRow, GuideAuthorRow } from "@/lib/control-room-authors";
import { formatClock } from "@/lib/control-room-shared";
import { instagramHandle } from "@/lib/guide-authors";

const PAGE_SIZE = 6;

type Screen = "authors" | "invitations";
type StatusFilter = "all" | "active" | "draft";
type Layout = "grid" | "list";

function isDraft(author: GuideAuthorRow) {
  return author.display_name === "Untitled Author";
}

function initials(name: string) {
  const parts = name
    .replace("Untitled Author", "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function inviteUrl(token: string) {
  if (typeof window === "undefined") return `/authors/join/${token}`;
  return `${window.location.origin}/authors/join/${token}`;
}

export function AuthorsDashboard({
  authors,
  invites,
}: {
  authors: GuideAuthorRow[];
  invites: GuideAuthorInviteRow[];
}) {
  const [screen, setScreen] = useState<Screen>("authors");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [layout, setLayout] = useState<Layout>("grid");
  const [page, setPage] = useState(1);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const activeCount = authors.filter((author) => !isDraft(author)).length;
  const draftCount = authors.length - activeCount;
  const openInvites = invites.filter((invite) => !invite.claimed_at && new Date(invite.expires_at) > new Date());

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return authors.filter((author) => {
      const draft = isDraft(author);
      if (status === "active" && draft) return false;
      if (status === "draft" && !draft) return false;
      if (!needle) return true;
      const handle = instagramHandle(author.instagram_url) ?? "";
      return [author.display_name, author.tagline, handle, author.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [authors, query, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function onDeleteAuthor(author: GuideAuthorRow) {
    const label = isDraft(author) ? "this draft author" : author.display_name;
    if (!window.confirm(`Delete ${label}? Guides stay live. The name comes off them. This cannot be undone.`)) {
      return;
    }
    setDeleteError(null);
    setDeletingId(author.id);
    startTransition(async () => {
      const result = await deleteGuideAuthor(author.id);
      setDeletingId(null);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      router.refresh();
    });
  }

  async function copyInvite(id: string, token: string) {
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      setCopiedId(id);
    } catch {
      setCopiedId(null);
    }
  }

  return (
    <section className="authors-board">
      <header className="authors-board-head">
        <div>
          <p className="authors-board-crumb">
            <a href="/admin/guides">Guides</a>
            <span> / </span>
            Authors
          </p>
          <h1>Authors</h1>
          <p className="lede muted">Meet the explorers behind your guides.</p>
        </div>
        <div className="authors-board-actions">
          <form action={createGuideAuthor}>
            <button className="btn btn-secondary" type="submit">
              + Create author
            </button>
          </form>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              setInviteOpen((open) => !open);
              setScreen("invitations");
            }}
          >
            + Invite author
          </button>
        </div>
      </header>

      {inviteOpen ? <AuthorInvitePanel /> : null}
      {deleteError ? <p className="error">{deleteError}</p> : null}

      <div className="authors-board-tabs">
        <button
          type="button"
          className={screen === "authors" ? "is-active" : undefined}
          onClick={() => setScreen("authors")}
        >
          Authors <span>{authors.length}</span>
        </button>
        <button
          type="button"
          className={screen === "invitations" ? "is-active" : undefined}
          onClick={() => setScreen("invitations")}
        >
          Invitations <span>{openInvites.length}</span>
        </button>
        <p className="authors-board-meta muted">
          {activeCount} active · {draftCount} drafts
        </p>
      </div>

      {screen === "authors" ? (
        <>
          <div className="authors-board-tools">
            <label className="authors-board-search">
              <span className="sr-only">Search authors</span>
              <input
                type="search"
                value={query}
                placeholder="Search authors"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="authors-board-status">
              <span className="sr-only">Filter status</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as StatusFilter);
                  setPage(1);
                }}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
            </label>
            <div className="authors-board-layout">
              <button
                type="button"
                className={layout === "grid" ? "is-active" : undefined}
                aria-label="Grid view"
                onClick={() => setLayout("grid")}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="3" width="8" height="8" rx="1.5" fill="currentColor" />
                  <rect x="13" y="3" width="8" height="8" rx="1.5" fill="currentColor" />
                  <rect x="3" y="13" width="8" height="8" rx="1.5" fill="currentColor" />
                  <rect x="13" y="13" width="8" height="8" rx="1.5" fill="currentColor" />
                </svg>
              </button>
              <button
                type="button"
                className={layout === "list" ? "is-active" : undefined}
                aria-label="List view"
                onClick={() => setLayout("list")}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="3" rx="1" fill="currentColor" />
                  <rect x="3" y="10.5" width="18" height="3" rx="1" fill="currentColor" />
                  <rect x="3" y="16" width="18" height="3" rx="1" fill="currentColor" />
                </svg>
              </button>
            </div>
          </div>

          {slice.length === 0 ? (
            <p className="muted">No authors in this view yet.</p>
          ) : (
            <div className={layout === "grid" ? "authors-board-grid" : "authors-board-list"}>
              {slice.map((author) => {
                const draft = isDraft(author);
                const handle = instagramHandle(author.instagram_url);
                const href = `/admin/authors/${author.id}`;
                return (
                  <article key={author.id} className="authors-board-card">
                    <div className="authors-board-cover">
                      {author.cover_url || author.photo_url ? (
                        <img src={author.cover_url || author.photo_url || ""} alt="" />
                      ) : null}
                    </div>
                    <details className="authors-board-menu">
                      <summary aria-label={`More for ${author.display_name}`}>···</summary>
                      <div>
                        <a href={href}>Edit profile</a>
                        {!draft ? <a href={`/authors/${author.slug}`}>Public profile</a> : null}
                        <button
                          type="button"
                          className="is-danger"
                          disabled={pending}
                          onClick={() => onDeleteAuthor(author)}
                        >
                          {deletingId === author.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </details>
                    {author.photo_url ? (
                      <img className="authors-board-avatar" src={author.photo_url} alt="" />
                    ) : (
                      <span className="authors-board-avatar is-fallback" aria-hidden="true">
                        {initials(author.display_name)}
                      </span>
                    )}
                    <div className="authors-board-body">
                      <div className="authors-board-name">
                        <h2>{author.display_name}</h2>
                        <span className={draft ? "is-draft" : "is-active"}>{draft ? "Draft" : "Active"}</span>
                      </div>
                      <p className="authors-board-tagline">{author.tagline || "No headline yet"}</p>
                      {handle ? <p className="authors-board-ig">{handle}</p> : null}
                      <p className="authors-board-guides">
                        {author.publishedCount > 0
                          ? `${author.publishedCount} published guide${author.publishedCount === 1 ? "" : "s"}`
                          : "No published guides yet"}
                      </p>
                      <a className="authors-board-cta" href={href}>
                        {draft ? "Complete profile" : "View profile"}
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <footer className="authors-board-foot">
            <p className="muted">
              Showing {slice.length} of {filtered.length} authors
            </p>
            <div className="authors-dash-pages">
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
        </>
      ) : (
        <div className="authors-board-invites">
          {invites.length === 0 ? (
            <p className="muted">No invitations yet. Send a link so a writer can fill their own Author card.</p>
          ) : (
            invites.map((invite) => {
              const expired = new Date(invite.expires_at) <= new Date();
              const claimed = Boolean(invite.claimed_at);
              const state = claimed ? "Claimed" : expired ? "Expired" : "Open";
              return (
                <article key={invite.id} className="authors-board-invite">
                  <div>
                    <h2>{invite.authorName || invite.email || "Invite link"}</h2>
                    <p className="muted">
                      {state}
                      {invite.authorName ? " · Takes over this card" : ""}
                      {invite.email && invite.authorName ? ` · ${invite.email}` : ""}
                      {claimed ? " · Used" : ` · Expires ${formatClock(invite.expires_at)}`}
                    </p>
                  </div>
                  {!claimed && !expired ? (
                    <button className="btn btn-secondary" type="button" onClick={() => void copyInvite(invite.id, invite.token)}>
                      {copiedId === invite.id ? "Copied" : "Copy link"}
                    </button>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
