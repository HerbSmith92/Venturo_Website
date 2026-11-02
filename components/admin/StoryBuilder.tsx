"use client";

import { useState } from "react";
import { StorySectionModal } from "@/components/admin/StorySectionModal";
import { SpotlightSectionView } from "@/components/spotlight/SpotlightSectionView";
import {
  cloneSection,
  emptySection,
  htmlToPlainText,
  moveItem,
  newSpotlightId,
  storySectionLabel,
  type SpotlightCover,
  type SpotlightPhoto,
  type SpotlightSection,
  type StorySectionType,
} from "@/lib/spotlight";

const SECTION_TYPES: { type: StorySectionType; help: string }[] = [
  { type: "story", help: "Optional heading, formatted text & optional photos." },
  { type: "photos", help: "Place images between writing, or as a gallery." },
  { type: "tip", help: "Highlighted advice." },
  { type: "quote", help: "Quote text & attribution." },
];

export function StoryBuilder({
  story,
  photos,
  cover,
  guideId,
  authorName,
  saveState,
  saveError,
  onStoryChange,
  onPhotosChange,
  onPersist,
  onPreviewFull,
}: {
  story: SpotlightSection[];
  photos: SpotlightPhoto[];
  cover: SpotlightCover;
  guideId: string;
  authorName?: string | null;
  saveState: "idle" | "saving" | "saved" | "failed";
  saveError: string | null;
  onStoryChange: (story: SpotlightSection[]) => void;
  onPhotosChange: (photos: SpotlightPhoto[]) => void;
  onPersist: (story: SpotlightSection[]) => Promise<boolean> | boolean;
  onPreviewFull: () => void;
}) {
  const [menuAt, setMenuAt] = useState<number | null>(null);
  const [editor, setEditor] = useState<{ mode: "add" | "edit"; index: number; type: StorySectionType; section: SpotlightSection | null } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  function openAdd(index: number, type: StorySectionType) {
    setMenuAt(null);
    setEditor({ mode: "add", index, type, section: emptySection(type) });
  }

  function openEdit(index: number) {
    const section = story[index];
    if (!section) return;
    setEditor({ mode: "edit", index, type: section.type, section: cloneSection(section) });
  }

  async function insertPhotoBreak(writing: SpotlightSection, afterHtml: string) {
    const photoSection = emptySection("photos");
    photoSection.layout = "two";
    const follow = emptySection("story");
    follow.heading = "";
    follow.bodyHtml = afterHtml;
    const hasFollow = Boolean(htmlToPlainText(afterHtml) || afterHtml.replace(/<[^>]+>/g, "").length);
    const extra = hasFollow ? [photoSection, follow] : [photoSection];
    const insertAt = editor?.index ?? story.length;
    const next =
      editor?.mode === "add"
        ? [...story.slice(0, insertAt), writing, ...extra, ...story.slice(insertAt)]
        : [...story.slice(0, insertAt), writing, ...extra, ...story.slice((editor?.index ?? insertAt) + 1)];
    onStoryChange(next);
    setEditor({
      mode: "edit",
      index: insertAt + 1,
      type: "photos",
      section: cloneSection(photoSection),
    });
    await onPersist(next);
  }

  async function saveSection(section: SpotlightSection) {
    let next = story;
    if (editor?.mode === "add") {
      const insertAt = editor.index;
      next = [...story.slice(0, insertAt), section, ...story.slice(insertAt)];
    } else if (editor) {
      next = story.map((item, index) => (index === editor.index ? section : item));
    }
    onStoryChange(next);
    const ok = await onPersist(next);
    if (ok) setEditor(null);
  }

  function commit(next: SpotlightSection[]) {
    onStoryChange(next);
    void onPersist(next);
  }

  function duplicate(index: number) {
    const section = story[index];
    if (!section) return;
    const copy = cloneSection(section);
    copy.id = newSpotlightId();
    commit([...story.slice(0, index + 1), copy, ...story.slice(index + 1)]);
  }

  function remove(index: number) {
    commit(story.filter((_, itemIndex) => itemIndex !== index));
  }

  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const from = story.findIndex((section) => section.id === dragId);
    const to = story.findIndex((section) => section.id === targetId);
    commit(moveItem(story, from, to));
    setDragId(null);
  }

  return (
    <section className="guide-desk-card story-builder" id="step-story">
      <header className="guide-desk-card-head">
        <h2>
          <span>03</span> Story builder
        </h2>
        <button type="button" className="btn btn-secondary" onClick={onPreviewFull}>
          Preview full guide
        </button>
      </header>
      <p className="muted cr-step-help">
        Assemble the article as cards in order. Put a Photos card between Story cards to land images mid-article, like writing then a pair of photos then more writing. Hero, intro, author &amp; the linked activity stay in the other sections.
      </p>

      <AddSection open={menuAt === 0} onToggle={() => setMenuAt((current) => (current === 0 ? null : 0))} onChoose={(type) => openAdd(0, type)} />

      {story.length === 0 ? <p className="muted">No story sections yet. Add the first one to start the article.</p> : null}

      {story.map((section, index) => (
        <div key={section.id}>
          <article
            className="story-card"
            draggable
            onDragStart={() => setDragId(section.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => dropOn(section.id)}
          >
            <div className="story-card-tools">
              <button type="button" className="story-card-handle" aria-label="Drag to reorder">
                ⋮⋮
              </button>
              <span className="eyebrow">{storySectionLabel(section.type)}</span>
              <div>
                <button type="button" onClick={() => openEdit(index)}>
                  Edit
                </button>
                <button type="button" onClick={() => duplicate(index)}>
                  Duplicate
                </button>
                <button type="button" disabled={index === 0} onClick={() => commit(moveItem(story, index, index - 1))}>
                  Move up
                </button>
                <button type="button" disabled={index === story.length - 1} onClick={() => commit(moveItem(story, index, index + 1))}>
                  Move down
                </button>
                <button type="button" onClick={() => remove(index)}>
                  Delete
                </button>
              </div>
            </div>
            <div className="story-card-preview spotlight-page">
              <div className="spotlight-story">
                <SpotlightSectionView section={section} photos={photos} authorName={authorName} />
              </div>
            </div>
          </article>
          <AddSection
            open={menuAt === index + 1}
            onToggle={() => setMenuAt((current) => (current === index + 1 ? null : index + 1))}
            onChoose={(type) => openAdd(index + 1, type)}
          />
        </div>
      ))}

      {editor ? (
        <StorySectionModal
          key={`${editor.mode}-${editor.index}-${editor.section?.id ?? editor.type}`}
          open
          mode={editor.mode}
          sectionType={editor.type}
          initial={editor.section}
          photos={photos}
          sections={story}
          cover={cover}
          guideId={guideId}
          authorName={authorName}
          saveState={saveState}
          saveError={saveError}
          onPhotosChange={onPhotosChange}
          onClose={() => setEditor(null)}
          onDiscard={() => setEditor(null)}
          onSave={(section) => void saveSection(section)}
          onInsertPhotoBreak={(writing, afterHtml) => void insertPhotoBreak(writing, afterHtml)}
        />
      ) : null}
    </section>
  );
}

function AddSection({
  open,
  onToggle,
  onChoose,
}: {
  open: boolean;
  onToggle: () => void;
  onChoose: (type: StorySectionType) => void;
}) {
  return (
    <div className="story-add">
      <button type="button" onClick={onToggle}>
        + Add section
      </button>
      {open ? (
        <div className="story-add-menu">
          {SECTION_TYPES.map((item) => (
            <button key={item.type} type="button" onClick={() => onChoose(item.type)}>
              <strong>{storySectionLabel(item.type)}</strong>
              <span>{item.help}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
