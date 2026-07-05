import React from "react";

const TIER_LABEL = {
  Legit: { color: "#79d79b" },
  "Semi-Legit": { color: "#e8ca75" },
  Blatant: { color: "#ff9d6c" },
  Rage: { color: "#ff7e7e" },
  Custom: { color: "#8ab3ff" },
};

export default function ConfigCard({ listing, owned, onBuy, onDownload }) {
  const tier = TIER_LABEL[listing.tier] || TIER_LABEL.Custom;
  const previewLines = (listing.preview || "").split("\n").slice(0, 5).join("\n");

  return (
    <div className="space-y-4 rounded-[22px] border border-white/10 bg-[#101927] p-5 transition-colors hover:border-[#2f4777]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wide text-white">{listing.name}</h3>
        <span
          className="rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{ color: tier.color, border: `1px solid ${tier.color}40`, background: `${tier.color}12` }}
        >
          {listing.tier}
        </span>
      </div>

      {listing.description && (
        <p className="line-clamp-2 text-sm leading-relaxed text-[#94a0bb]">{listing.description}</p>
      )}

      {previewLines && (
        <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#09101a] p-3">
          <pre className="overflow-hidden whitespace-pre font-mono text-[11px] leading-relaxed text-[#6e7f9e]" style={{ maxHeight: "72px" }}>
            {previewLines}
          </pre>
        </div>
      )}

      <div className="flex items-center justify-between pt-0.5">
        <span className="text-sm font-semibold text-[#dce4f5]">
          {Number(listing.price) > 0 ? `$${Number(listing.price).toFixed(2)}` : "Free"}
        </span>

        {owned ? (
          <button
            onClick={() => onDownload?.(listing)}
            className="rounded-md border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#b8c6e3] transition-colors hover:text-white"
          >
            Download
          </button>
        ) : (
          <button
            onClick={() => onBuy?.(listing)}
            className="rounded-md border border-[#39578f] bg-[#13203b] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#d7e6ff] transition-colors hover:bg-[#18284a]"
          >
            {Number(listing.price) > 0 ? "Buy" : "Claim"}
          </button>
        )}
      </div>

      {listing.ownerName && (
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#66728d]">By {listing.ownerName}</p>
      )}
    </div>
  );
}
