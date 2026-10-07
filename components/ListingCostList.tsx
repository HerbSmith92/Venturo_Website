"use client";

import { useState } from "react";
import type { ListingCostGroup, ListingCostItem } from "@/lib/listing-costs";

function Chevron({ open }: { open: boolean }) {
  return <span className={open ? "listing-cost-chevron is-open" : "listing-cost-chevron"} aria-hidden="true" />;
}

function Figures({ item }: { item: ListingCostItem }) {
  if (item.wasLabel) {
    return (
      <span className="listing-cost-figures">
        <s className="listing-cost-was">{item.wasLabel}</s>
        <b>{item.priceLabel}</b>
      </span>
    );
  }
  return (
    <span className="listing-cost-figures">
      <span>{item.priceLabel}</span>
    </span>
  );
}

function CostLine({ item, title }: { item: ListingCostItem; title?: string }) {
  return (
    <>
      <span className="listing-cost-copy">
        <strong>{title ?? item.name}</strong>
        {item.saveLabel ? <span className="listing-cost-save">{item.saveLabel}</span> : null}
        {item.note ? <span className="listing-cost-note">{item.note}</span> : null}
      </span>
      <Figures item={item} />
    </>
  );
}

export function ListingCostList({ groups }: { groups: ListingCostGroup[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ul className="listing-cost-list">
      {groups.map((group) => {
        const open = openId === group.id;
        const single = group.items.length === 1 ? group.items[0] : null;
        const detailId = `cost-detail-${group.id}`;

        if (single) {
          const row = (
            <>
              <CostLine item={single} title={group.name} />
              {group.description ? <Chevron open={open} /> : null}
            </>
          );
          return (
            <li className="listing-cost-card" key={group.id}>
              {group.description ? (
                <button
                  type="button"
                  className="listing-cost-toggle"
                  aria-expanded={open}
                  aria-controls={detailId}
                  onClick={() => setOpenId(open ? null : group.id)}
                >
                  {row}
                </button>
              ) : (
                <div className="listing-cost-toggle">{row}</div>
              )}
              {open && group.description ? (
                <p className="listing-cost-detail" id={detailId}>
                  {group.description}
                </p>
              ) : null}
            </li>
          );
        }

        return (
          <li className="listing-cost-card listing-cost-group" key={group.id}>
            {group.description ? (
              <button
                type="button"
                className="listing-cost-toggle listing-cost-head"
                aria-expanded={open}
                aria-controls={detailId}
                onClick={() => setOpenId(open ? null : group.id)}
              >
                <strong>{group.name}</strong>
                <Chevron open={open} />
              </button>
            ) : (
              <div className="listing-cost-toggle listing-cost-head">
                <strong>{group.name}</strong>
              </div>
            )}
            <ul className="listing-cost-subs">
              {group.items.map((item) => (
                <li className="listing-cost-sub" key={item.id}>
                  <div className="listing-cost-toggle">
                    <CostLine item={item} />
                  </div>
                </li>
              ))}
            </ul>
            {open && group.description ? (
              <p className="listing-cost-detail" id={detailId}>
                {group.description}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
