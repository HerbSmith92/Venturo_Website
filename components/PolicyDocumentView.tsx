import type { ReactNode } from "react";
import index from "@/content/policies/index.json";

export type PolicyBlock = { type: "h2" | "h3" | "p" | "li"; text: string };

export type PolicyDocument = {
  slug: string;
  href: string;
  title: string;
  summary: string;
  meta: string[];
  blocks: PolicyBlock[];
};

const linkPattern =
  /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})|(https?:\/\/[^\s)]+)|(\bwww\.[^\s)]+)/g;

function linkedText(text: string): ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(linkPattern)) {
    const value = match[0];
    const start = match.index ?? 0;
    if (start > last) nodes.push(text.slice(last, start));
    const href = match[1]
      ? `mailto:${match[1]}`
      : value.startsWith("http")
        ? value
        : `https://${value}`;
    nodes.push(
      <a key={`${start}-${value}`} href={href}>
        {value}
      </a>
    );
    last = start + value.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function blocks(policy: PolicyDocument): ReactNode[] {
  const nodes: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length === 0) return;
    const items = list;
    list = [];
    nodes.push(
      <ul key={`list-${nodes.length}`}>
        {items.map((item, itemIndex) => (
          <li key={itemIndex}>{linkedText(item)}</li>
        ))}
      </ul>
    );
  };

  policy.blocks.forEach((block, index) => {
    if (block.type === "li") {
      list.push(block.text);
      return;
    }
    flush();
    if (block.type === "h2") {
      nodes.push(<h2 key={index}>{block.text}</h2>);
    } else if (block.type === "h3") {
      nodes.push(<h3 key={index}>{block.text}</h3>);
    } else {
      nodes.push(<p key={index}>{linkedText(block.text)}</p>);
    }
  });
  flush();
  return nodes;
}

export function PolicyDocumentView({ policy }: { policy: PolicyDocument }) {
  return (
    <main>
      <section className="shell section">
        <p className="eyebrow">Policies</p>
        <h1>{policy.title}</h1>
        {policy.meta.length > 0 ? (
          <p className="lede muted">{policy.meta.join(" · ")}</p>
        ) : null}
        <div className="policy-doc">{blocks(policy)}</div>
        <p className="policy-back">
          <a href="/policies/">All policies</a>
        </p>
      </section>
    </main>
  );
}

export function PolicyIndex() {
  return (
    <main>
      <section className="shell section">
        <p className="eyebrow">Policies</p>
        <h1>Venturo policies</h1>
        <p className="lede muted">
          The same documents apply on venturo.co.za and in the Venturo app.
        </p>
        <div className="policy-index">
          {index.map((policy) => (
            <a key={policy.slug} href={policy.href} className="policy-index-card">
              <h2>{policy.title.replace(/^Venturo /, "")}</h2>
              <p>{policy.summary}</p>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
