"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

const STATUSES = [
  { id: "all", label: "All" },
  { id: "approved", label: "Live" },
  { id: "review", label: "New Listings Requested" },
  { id: "draft", label: "Changes Requested" },
  { id: "scheduled", label: "Scheduled" },
  { id: "suspended", label: "Suspended" },
  { id: "archived", label: "Archived" },
];

type QueryState = {
  status: string;
  interest: string;
  author: string;
  query: string;
  sort: string;
  dir: string;
  group: string;
};

export function DirectoryColumnHead({
  status,
  interest,
  author,
  query,
  sort,
  dir,
  group,
  interests,
  authors,
}: QueryState & {
  interests: { key: string; title: string }[];
  authors: string[];
}) {
  const router = useRouter();
  const current: QueryState = {
    status: status || "approved",
    interest,
    author,
    query,
    sort: sort || "updated",
    dir: dir || (sort && sort !== "updated" ? "asc" : "desc"),
    group,
  };

  function hrefFor(patch: Partial<QueryState>) {
    const next = { ...current, ...patch };
    const params = new URLSearchParams();
    if (next.status) params.set("status", next.status);
    if (next.interest) params.set("interest", next.interest);
    if (next.author) params.set("author", next.author);
    if (next.query.trim()) params.set("q", next.query.trim());
    const defaultDir = next.sort === "updated" ? "desc" : "asc";
    if (next.sort !== "updated" || next.dir !== "desc") {
      params.set("sort", next.sort);
      params.set("dir", next.dir || defaultDir);
    }
    if (next.group === "interest") params.set("group", "interest");
    const search = params.toString();
    return search ? `/admin/listings?${search}` : "/admin/listings";
  }

  function go(patch: Partial<QueryState>) {
    router.push(hrefFor(patch));
  }

  return (
    <thead>
      <tr>
        <ColumnMenu
          label="Listing"
          active={current.sort === "name" || Boolean(current.query)}
        >
          <MenuSection label="Sort">
            <a className={current.sort === "name" && current.dir !== "desc" ? "is-on" : undefined} href={hrefFor({ sort: "name", dir: "asc" })}>
              A–Z
            </a>
            <a className={current.sort === "name" && current.dir === "desc" ? "is-on" : undefined} href={hrefFor({ sort: "name", dir: "desc" })}>
              Z–A
            </a>
          </MenuSection>
          <MenuSection label="Search">
            <NameSearch query={current.query} onSearch={(value) => go({ query: value })} />
          </MenuSection>
        </ColumnMenu>
        <ColumnMenu label="Status" active={current.status !== "all"}>
          <MenuSection label="Filter">
            {STATUSES.map((item) => (
              <a key={item.id} className={current.status === item.id ? "is-on" : undefined} href={hrefFor({ status: item.id })}>
                {item.label}
              </a>
            ))}
          </MenuSection>
        </ColumnMenu>
        <ColumnMenu
          label="Interest"
          active={Boolean(current.interest) || current.sort === "interest" || current.group === "interest"}
        >
          <MenuSection label="Sort">
            <a className={current.sort === "interest" && current.dir !== "desc" ? "is-on" : undefined} href={hrefFor({ sort: "interest", dir: "asc" })}>
              A–Z
            </a>
            <a className={current.sort === "interest" && current.dir === "desc" ? "is-on" : undefined} href={hrefFor({ sort: "interest", dir: "desc" })}>
              Z–A
            </a>
          </MenuSection>
          <MenuSection label="Group">
            <a className={current.group === "interest" ? "is-on" : undefined} href={hrefFor({ group: current.group === "interest" ? "" : "interest" })}>
              Group by interest
            </a>
          </MenuSection>
          <MenuSection label="Interests">
            <a className={!current.interest ? "is-on" : undefined} href={hrefFor({ interest: "" })}>
              All interests
            </a>
            {interests.map((item) => (
              <a key={item.key} className={current.interest === item.key ? "is-on" : undefined} href={hrefFor({ interest: item.key })}>
                {item.title}
              </a>
            ))}
          </MenuSection>
        </ColumnMenu>
        <ColumnMenu label="Author" active={Boolean(current.author) || current.sort === "author"}>
          <MenuSection label="Sort">
            <a className={current.sort === "author" && current.dir !== "desc" ? "is-on" : undefined} href={hrefFor({ sort: "author", dir: "asc" })}>
              A–Z
            </a>
            <a className={current.sort === "author" && current.dir === "desc" ? "is-on" : undefined} href={hrefFor({ sort: "author", dir: "desc" })}>
              Z–A
            </a>
          </MenuSection>
          <MenuSection label="Authors">
            <a className={!current.author ? "is-on" : undefined} href={hrefFor({ author: "" })}>
              All authors
            </a>
            {authors.map((name) => (
              <a key={name} className={current.author === name ? "is-on" : undefined} href={hrefFor({ author: name })}>
                {name}
              </a>
            ))}
          </MenuSection>
        </ColumnMenu>
        <ColumnMenu label="Last Update" active={current.sort === "updated" && current.dir === "asc"}>
          <MenuSection label="Sort">
            <a className={current.sort === "updated" && current.dir !== "asc" ? "is-on" : undefined} href={hrefFor({ sort: "updated", dir: "desc" })}>
              Newest
            </a>
            <a className={current.sort === "updated" && current.dir === "asc" ? "is-on" : undefined} href={hrefFor({ sort: "updated", dir: "asc" })}>
              Oldest
            </a>
          </MenuSection>
        </ColumnMenu>
        <th />
      </tr>
    </thead>
  );
}

function MenuSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <span>{label}</span>
      {children}
    </section>
  );
}

function NameSearch({ query, onSearch }: { query: string; onSearch: (value: string) => void }) {
  return (
    <form
      className="cr-col-search"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSearch(String(data.get("q") ?? ""));
      }}
    >
      <input name="q" type="search" defaultValue={query} placeholder="Search by name" aria-label="Search by name" />
      <button type="submit">Search</button>
    </form>
  );
}

function ColumnMenu({
  label,
  active,
  children,
}: {
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function placeMenu() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 240;
      const left = Math.min(rect.left, window.innerWidth - width - 12);
      setPlace({ top: rect.bottom + 6, left: Math.max(12, left) });
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    placeMenu();
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <th className={active ? "is-active" : undefined}>
      <button
        ref={buttonRef}
        type="button"
        className="cr-col-btn"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{label}</span>
        <span className="cr-col-caret" aria-hidden="true" />
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          className="cr-col-menu"
          style={{ top: place.top, left: place.left }}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("button") && !(event.target as HTMLElement).closest("form")) {
              setOpen(false);
            }
          }}
        >
          {children}
        </div>
      ) : null}
    </th>
  );
}
