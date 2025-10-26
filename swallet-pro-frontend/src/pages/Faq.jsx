import React from "react";

const faqs = [
  {
    q: "How do I invite people into a group?",
    a: "Head to the People tab or inside a group detail page and send an invite via email. Members receive instant access along with ledger history.",
  },
  {
    q: "Can I use different currencies in one group?",
    a: "Yes. Swallet converts every entry to the group’s base currency using live FX rates so balances stay fair for everyone.",
  },
  {
    q: "What happens after I close a group?",
    a: "We lock the ledger, export a PDF snapshot, and keep it searchable so you can audit or reopen it later.",
  },
];

export default function Faq() {
  return (
    <div className="page-stack">
      <section className="card">
        <p className="eyebrow">Need help?</p>
        <h2 style={{ margin: "0 0 1rem" }}>Frequently asked</h2>
        <div className="faq-list">
          {faqs.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p className="muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
