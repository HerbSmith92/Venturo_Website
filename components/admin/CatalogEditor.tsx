"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CatalogAdmin } from "@/lib/catalog-admin";

export function CatalogEditor({ catalog }: { catalog: CatalogAdmin }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [personaTitle, setPersonaTitle] = useState("");
  const [personaSubtitle, setPersonaSubtitle] = useState("");
  const [interestTitle, setInterestTitle] = useState("");
  const [interestKind, setInterestKind] = useState(catalog.kinds[0]?.id ?? "");

  async function post(body: Record<string, unknown>, key: string) {
    setError(null);
    setPending(key);
    const response = await fetch("/api/admin/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as { error?: string };
    setPending(null);
    if (!response.ok) {
      setError(payload.error ?? "Could not save.");
      return false;
    }
    router.refresh();
    return true;
  }

  return (
    <div className="stack-list">
      {error && <p className="error">{error}</p>}

      <article className="plan">
        <p className="eyebrow">How You Go Out</p>
        <h2>Personas</h2>
        <p className="muted">Shown on sign-up & profile. Hide a row to remove it from new members.</p>
        <ul className="catalog-admin-list">
          {catalog.personas.map((persona) => (
            <li key={persona.id} className={persona.is_active ? "" : "is-hidden"}>
              <form
                className="catalog-admin-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  void post(
                    {
                      entity: "persona",
                      action: "save",
                      id: persona.id,
                      title: (form.elements.namedItem("title") as HTMLInputElement).value,
                      subtitle: (form.elements.namedItem("subtitle") as HTMLInputElement).value,
                      isActive: persona.is_active,
                    },
                    `p-${persona.id}`,
                  );
                }}
              >
                <input name="title" defaultValue={persona.title} aria-label="Persona title" />
                <input name="subtitle" defaultValue={persona.subtitle} aria-label="Persona subtitle" />
                <button className="btn btn-secondary" type="submit" disabled={pending === `p-${persona.id}`}>
                  Save
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={Boolean(pending)}
                  onClick={() =>
                    void post(
                      {
                        entity: "persona",
                        action: "save",
                        id: persona.id,
                        title: persona.title,
                        subtitle: persona.subtitle,
                        isActive: !persona.is_active,
                      },
                      `p-${persona.id}`,
                    )
                  }
                >
                  {persona.is_active ? "Hide" : "Show"}
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form
          className="catalog-admin-add"
          onSubmit={(event) => {
            event.preventDefault();
            void post(
              {
                entity: "persona",
                action: "save",
                title: personaTitle,
                subtitle: personaSubtitle,
                isActive: true,
              },
              "p-new",
            ).then((ok) => {
              if (ok) {
                setPersonaTitle("");
                setPersonaSubtitle("");
              }
            });
          }}
        >
          <input
            value={personaTitle}
            onChange={(event) => setPersonaTitle(event.target.value)}
            placeholder="New persona, e.g. With Kids"
            aria-label="New persona title"
          />
          <input
            value={personaSubtitle}
            onChange={(event) => setPersonaSubtitle(event.target.value)}
            placeholder="Short example"
            aria-label="New persona subtitle"
          />
          <button className="btn btn-primary" type="submit" disabled={pending === "p-new"}>
            Add
          </button>
        </form>
      </article>

      <article className="plan">
        <p className="eyebrow">Activities You Enjoy</p>
        <h2>Interests</h2>
        <p className="muted">Everyday examples work best. Hide a row to take it off sign-up.</p>
        <ul className="catalog-admin-list">
          {catalog.interests.map((item) => (
            <li key={item.id} className={item.is_active ? "" : "is-hidden"}>
              <form
                className="catalog-admin-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  void post(
                    {
                      entity: "interest",
                      action: "save",
                      id: item.id,
                      title: (form.elements.namedItem("title") as HTMLInputElement).value,
                      kindId: (form.elements.namedItem("kindId") as HTMLSelectElement).value,
                      isActive: item.is_active,
                    },
                    `i-${item.id}`,
                  );
                }}
              >
                <input name="title" defaultValue={item.title} aria-label="Interest title" />
                <select name="kindId" defaultValue={item.activity_kind_id} aria-label="Category">
                  {catalog.kinds.map((kind) => (
                    <option key={kind.id} value={kind.id}>
                      {kind.title}
                    </option>
                  ))}
                </select>
                <button className="btn btn-secondary" type="submit" disabled={pending === `i-${item.id}`}>
                  Save
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={Boolean(pending)}
                  onClick={() =>
                    void post(
                      {
                        entity: "interest",
                        action: "save",
                        id: item.id,
                        title: item.title,
                        kindId: item.activity_kind_id,
                        isActive: !item.is_active,
                      },
                      `i-${item.id}`,
                    )
                  }
                >
                  {item.is_active ? "Hide" : "Show"}
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form
          className="catalog-admin-add"
          onSubmit={(event) => {
            event.preventDefault();
            void post(
              {
                entity: "interest",
                action: "save",
                title: interestTitle,
                kindId: interestKind,
                isActive: true,
              },
              "i-new",
            ).then((ok) => {
              if (ok) setInterestTitle("");
            });
          }}
        >
          <input
            value={interestTitle}
            onChange={(event) => setInterestTitle(event.target.value)}
            placeholder="New interest, e.g. Braais"
            aria-label="New interest title"
          />
          <select
            value={interestKind}
            onChange={(event) => setInterestKind(event.target.value)}
            aria-label="New interest category"
          >
            {catalog.kinds.map((kind) => (
              <option key={kind.id} value={kind.id}>
                {kind.title}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" type="submit" disabled={pending === "i-new"}>
            Add
          </button>
        </form>
      </article>
    </div>
  );
}
