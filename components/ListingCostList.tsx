"use client";

import { useState } from "react";

export type ListingCostRow = {
  id: string;
  name: string;
  priceLabel: string;
  memberLabel: string | null;
  saveLabel: string | null;
  inclusions: string | null;
};

export function ListingCostList({ rows }: { rows: ListingCostRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ul className="listing-cost-list">
      {rows.map((row) => {
        const extra = Boolean(row.inclusions || row.saveLabel || row.memberLabel);
        const open = openId === row.id;
        return (
          <li className="listing-cost-card" key={row.id}>
            {extra ? (
              <button
                type="button"
                className="listing-cost-toggle"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : row.id)}
              >
                <strong>{row.name}</strong>
                <span className="listing-cost-figures">
                  <span>
                    {row.priceLabel}
                    <span
                      className={open ? "listing-cost-chevron is-open" : "listing-cost-chevron"}
                      aria-hidden="true"
                    />
                  </span>
                </span>
              </button>
            ) : (
              <div className="listing-cost-toggle">
                <strong>{row.name}</strong>
                <span className="listing-cost-figures">
                  <span>{row.priceLabel}</span>
                </span>
              </div>
            )}
            {open ? (
              <div className="listing-cost-detail">
                {row.saveLabel ? <p>{row.saveLabel}</p> : null}
                {row.inclusions ? <p className="muted">{row.inclusions}</p> : null}
                {row.memberLabel ? <p className="listing-cost-member">{row.memberLabel}</p> : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
