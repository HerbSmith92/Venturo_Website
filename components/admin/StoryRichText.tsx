"use client";

import { useEffect, useRef, useState } from "react";

const BLOCK_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "DIV", "LI", "BLOCKQUOTE"]);

function editorBlock(node: Node, root: HTMLElement): HTMLElement | null {
  let found: HTMLElement | null = null;
  let current: Node | null = node;
  while (current && current !== root) {
    if (current instanceof HTMLElement && BLOCK_TAGS.has(current.tagName)) found = current;
    current = current.parentNode;
  }
  return found;
}

function unwrapInnerBlocks(target: HTMLElement) {
  const nested = [...target.querySelectorAll("h1,h2,h3,h4,h5,h6,p")];
  for (const node of nested) {
    if (node === target) continue;
    while (node.firstChild) target.insertBefore(node.firstChild, node);
    node.remove();
  }
}

function stripHeadingLooks(root: HTMLElement) {
  const nodes = [root, ...root.querySelectorAll<HTMLElement>("*")] ;
  for (const node of nodes) {
    if (node.tagName === "FONT") {
      const parent = node.parentNode;
      while (node.firstChild) parent?.insertBefore(node.firstChild, node);
      node.remove();
      continue;
    }
    node.style.removeProperty("font");
    node.style.removeProperty("font-family");
    node.style.removeProperty("font-size");
    node.style.removeProperty("font-weight");
    node.style.removeProperty("line-height");
    node.style.removeProperty("letter-spacing");
    if (!node.getAttribute("style")) node.removeAttribute("style");
    node.removeAttribute("face");
    node.removeAttribute("size");
  }
}

function blocksInSelection(root: HTMLElement): HTMLElement[] {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !root.contains(selection.anchorNode)) {
    return [];
  }
  const range = selection.getRangeAt(0);
  const seen = new Set<HTMLElement>();
  const found: HTMLElement[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!range.intersectsNode(node)) continue;
    const block = editorBlock(node, root);
    if (block && !seen.has(block)) {
      seen.add(block);
      found.push(block);
    }
  }
  if (found.length) return found;
  const fallback = editorBlock(selection.anchorNode ?? root, root);
  return fallback ? [fallback] : [];
}

function retag(block: HTMLElement, tag: "h2" | "p"): HTMLElement {
  unwrapInnerBlocks(block);
  const next = document.createElement(tag);
  while (block.firstChild) next.appendChild(block.firstChild);
  if (!next.childNodes.length) next.appendChild(document.createElement("br"));
  stripHeadingLooks(next);
  block.replaceWith(next);
  return next;
}

function htmlFromRange(range: Range) {
  const wrap = document.createElement("div");
  wrap.appendChild(range.cloneContents());
  return wrap.innerHTML;
}

function splitHtmlAtCaret(root: HTMLElement): { before: string; after: string } {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !root.contains(selection.anchorNode)) {
    return { before: root.innerHTML, after: "" };
  }
  const caret = selection.getRangeAt(0).cloneRange();
  if (!caret.collapsed) caret.collapse(true);

  const beforeRange = document.createRange();
  beforeRange.selectNodeContents(root);
  beforeRange.setEnd(caret.startContainer, caret.startOffset);

  const afterRange = document.createRange();
  afterRange.selectNodeContents(root);
  afterRange.setStart(caret.startContainer, caret.startOffset);

  return { before: tidyHtml(htmlFromRange(beforeRange)), after: tidyHtml(htmlFromRange(afterRange)) };
}

function tidyHtml(html: string) {
  return html.replace(/\sdata-cursor-ref="[^"]*"/g, "");
}

function isBlankHtml(html: string) {
  return !html.replace(/<br\s*\/?>/gi, "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
}

function currentBlock(root: HTMLElement | null): "heading" | "paragraph" {
  const selection = window.getSelection();
  if (!root || !selection || !selection.anchorNode || !root.contains(selection.anchorNode)) {
    return "paragraph";
  }
  const block = editorBlock(selection.anchorNode, root);
  if (block && /^H[1-6]$/.test(block.tagName)) return "heading";
  return "paragraph";
}

export function StoryRichText({
  value,
  onChange,
  placeholder,
  onInsertPhotos,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onInsertPhotos?: (split: { before: string; after: string }) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("https://");
  const [block, setBlock] = useState<"heading" | "paragraph">("paragraph");
  const [marks, setMarks] = useState({ bold: false, italic: false });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (node.contains(document.activeElement)) return;
    if (node.innerHTML !== value) node.innerHTML = value || "";
  }, [value]);

  function syncFormat() {
    setBlock(currentBlock(ref.current));
    setMarks({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
    });
  }

  function emit() {
    const node = ref.current;
    if (!node) return;
    onChange(tidyHtml(node.innerHTML));
    syncFormat();
  }

  function command(name: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(name, false, arg);
    emit();
  }

  function applyBlock(tag: "h2" | "p") {
    const root = ref.current;
    if (!root) return;
    root.focus();
    const scroll = root.scrollTop;
    let targets = blocksInSelection(root);
    if (!targets.length) {
      if (!root.innerHTML.trim() || root.innerHTML === "<br>") {
        const fresh = document.createElement(tag);
        fresh.appendChild(document.createElement("br"));
        root.replaceChildren(fresh);
        targets = [fresh];
      } else {
        const fresh = document.createElement(tag);
        while (root.firstChild) fresh.appendChild(root.firstChild);
        root.appendChild(fresh);
        unwrapInnerBlocks(fresh);
        stripHeadingLooks(fresh);
        targets = [fresh];
      }
    } else {
      targets = targets.map((item) => retag(item, tag));
    }
    const selection = window.getSelection();
    const last = targets[targets.length - 1];
    if (selection && last) {
      const range = document.createRange();
      range.selectNodeContents(last);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    root.scrollTop = scroll;
    emit();
  }

  function applyLink() {
    if (!linkValue.trim()) return;
    command("createLink", linkValue.trim());
    setLinkOpen(false);
  }

  return (
    <div className="story-rich">
      <div className="story-rich-bar" role="toolbar" aria-label="Text formatting">
        <button
          type="button"
          className={block === "heading" ? "is-on" : undefined}
          aria-pressed={block === "heading"}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyBlock("h2")}
        >
          Heading
        </button>
        <button
          type="button"
          className={block === "paragraph" ? "is-on" : undefined}
          aria-pressed={block === "paragraph"}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyBlock("p")}
        >
          Paragraph
        </button>
        <button
          type="button"
          className={marks.bold ? "is-on" : undefined}
          aria-pressed={marks.bold}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => command("bold")}
          aria-label="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={marks.italic ? "is-on" : undefined}
          aria-pressed={marks.italic}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => command("italic")}
          aria-label="Italic"
        >
          <em>I</em>
        </button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setLinkOpen((current) => !current)} aria-label="Link">
          Link
        </button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("insertUnorderedList")} aria-label="Bulleted list">
          • List
        </button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("insertOrderedList")} aria-label="Numbered list">
          1. List
        </button>
        {onInsertPhotos ? (
          <button
            type="button"
            title="Split the writing at the cursor and add a photo card"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              const root = ref.current;
              if (!root) return;
              onInsertPhotos(splitHtmlAtCaret(root));
            }}
          >
            Insert photos
          </button>
        ) : null}
        <span />
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("undo")} aria-label="Undo">
          Undo
        </button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("redo")} aria-label="Redo">
          Redo
        </button>
      </div>
      {linkOpen ? (
        <div className="story-rich-link">
          <input
            value={linkValue}
            onChange={(event) => setLinkValue(event.target.value)}
            placeholder="https://"
            aria-label="Link address"
          />
          <button type="button" className="btn btn-secondary" onClick={applyLink}>
            Apply
          </button>
        </div>
      ) : null}
      <div
        ref={ref}
        className={`story-rich-editor${isBlankHtml(value) ? " is-empty" : ""}`}
        contentEditable
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder ?? "Write this section…"}
        onInput={emit}
        onBlur={emit}
        onKeyUp={syncFormat}
        onMouseUp={syncFormat}
      />
    </div>
  );
}
