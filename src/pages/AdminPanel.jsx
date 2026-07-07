import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, Copy, FileCode2, KeyRound, Save, Shield, ShoppingBag, Users } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/api/client";

const TABS = [
  { id: "users", label: "Users", icon: Users },
  { id: "keys", label: "Keys", icon: KeyRound },
  { id: "marketplace", label: "Marketplace", icon: ShoppingBag },
  { id: "update-table", label: "Update Table", icon: FileCode2 },
  { id: "stats", label: "Stats", icon: BarChart3 },
];

export default function AdminPanel() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("users");
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState({ users: [], licenseKeys: [], configs: [], purchases: [], auditLogs: [], panelDefaults: null });
  const [manualKey, setManualKey] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [rotateDrafts, setRotateDrafts] = useState({});
  const [defaultTitle, setDefaultTitle] = useState("");
  const [defaultTier, setDefaultTier] = useState("Blatant");
  const [defaultDescription, setDefaultDescription] = useState("");
  const [defaultLuaContent, setDefaultLuaContent] = useState("");
  const [savingDefaults, setSavingDefaults] = useState(false);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const payload = await api.get("/admin/overview");
      setOverview(payload);
      setDefaultTitle(payload.panelDefaults?.dashboardTitle || "");
      setDefaultTier(payload.panelDefaults?.dashboardTier || "Blatant");
      setDefaultDescription(payload.panelDefaults?.dashboardDescription || "");
      setDefaultLuaContent(payload.panelDefaults?.dashboardLuaContent || "");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const createKey = async () => {
    if (!manualKey.trim()) return;
    await api.post("/admin/license-keys", { key: manualKey.toUpperCase(), note: manualNote });
    toast({ title: "License created", description: `${manualKey.toUpperCase()} is ready to distribute.` });
    setManualKey("");
    setManualNote("");
    await loadOverview();
  };

  const rotateKey = async (key) => {
    const draft = (rotateDrafts[key.id] || "").trim();
    if (!draft) return;
    await api.put(`/admin/license-keys/${key.id}`, { key: draft.toUpperCase() });
    toast({ title: "License changed", description: `${key.keyPreview} is now ${draft.toUpperCase()}.` });
    setRotateDrafts((prev) => ({ ...prev, [key.id]: "" }));
    await loadOverview();
  };

  const toggleBan = async (user) => {
    await api.put(`/admin/users/${user.id}`, { isBanned: !user.isBanned });
    toast({ title: user.isBanned ? "User restored" : "User banned", description: user.email });
    await loadOverview();
  };

  const togglePublish = async (config) => {
    await api.put(`/admin/configs/${config.id}`, { isPublished: !config.isPublished });
    toast({ title: config.isPublished ? "Listing hidden" : "Listing published", description: config.name });
    await loadOverview();
  };

  const cycleVisibility = async (config) => {
    const order = ["private", "public", "premium"];
    const next = order[(order.indexOf(config.visibility) + 1) % order.length];
    await api.put(`/admin/configs/${config.id}`, { visibility: next });
    toast({ title: "Visibility updated", description: `${config.name} is now ${next}.` });
    await loadOverview();
  };

  const savePanelDefaults = async () => {
    setSavingDefaults(true);
    try {
      await api.put("/admin/panel-defaults", {
        dashboardTitle: defaultTitle,
        dashboardTier: defaultTier,
        dashboardDescription: defaultDescription,
        dashboardLuaContent: defaultLuaContent,
      });
      toast({ title: "Update table saved", description: "Dashboard default table has been updated." });
      await loadOverview();
    } finally {
      setSavingDefaults(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#8ab3ff]" />
      </div>
    );
  }

  const stats = [
    { label: "Users", value: overview.users.length },
    { label: "Active Keys", value: overview.licenseKeys.filter((key) => key.status === "active").length },
    { label: "Configs", value: overview.configs.length },
    { label: "Purchases", value: overview.purchases.length },
  ];

  return (
    <div className="space-y-5">
      <section className="luxx-surface px-6 py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[#8ebfff]">Admin Panel</p>
            <h1 className="mt-3 text-3xl font-black uppercase tracking-[0.08em] text-white">Users, license keys, and listings from one place.</h1>
          </div>
          <div className="flex w-full max-w-xl gap-3 border border-white/[0.06] bg-[#101520] p-3">
            <input
              value={manualKey}
              onChange={(event) => setManualKey(event.target.value)}
              placeholder="Manual license key"
              className="luxx-input min-w-0 flex-1"
            />
            <input
              value={manualNote}
              onChange={(event) => setManualNote(event.target.value)}
              placeholder="Optional note"
              className="luxx-input min-w-0 flex-1"
            />
            <button onClick={createKey} className="luxx-button luxx-button-primary">
              Add Key
            </button>
          </div>
        </div>
      </section>

      <div className="flex w-fit gap-2 border border-white/[0.06] bg-[#131925] p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] ${
                activeTab === tab.id ? "bg-[#18243b] text-[#8ebfff]" : "text-[#8190ab]"
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "users" && (
          <motion.div key="users" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
            <DataTable
              headers={["Display", "Username", "Discord", "Role", "Status", "Action"]}
              rows={overview.users.map((user) => [
                user.displayName || "Unnamed",
                user.email,
                user.discordUsername || "Not linked",
                user.role,
                user.isBanned ? "Banned" : "Active",
                <ActionText key={user.id} onClick={() => toggleBan(user)}>
                  {user.isBanned ? "Unban" : "Ban"}
                </ActionText>,
              ])}
            />
          </motion.div>
        )}

        {activeTab === "keys" && (
          <motion.div key="keys" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
            <DataTable
              headers={["Key", "Status", "Claimed By", "Created", "Copy", "Change Key"]}
              rows={overview.licenseKeys.map((key) => [
                <span key={`${key.id}-preview`} className="font-mono text-[#d7e6ff]">{key.keyPreview}</span>,
                key.status,
                key.claimedByUserId || "-",
                new Date(key.createdAt).toLocaleDateString(),
                <button
                  key={key.id}
                  onClick={async () => {
                    await navigator.clipboard.writeText(key.keyPreview);
                    toast({ title: "Copied", description: `${key.keyPreview} copied.` });
                  }}
                  className="inline-flex rounded-md border border-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#c3d1ea]"
                >
                  <Copy size={12} />
                </button>,
                <div key={`${key.id}-rotate`} className="flex gap-2">
                  <input
                    value={rotateDrafts[key.id] || ""}
                    onChange={(event) => setRotateDrafts((prev) => ({ ...prev, [key.id]: event.target.value }))}
                    placeholder="New key value"
                    className="luxx-input w-40"
                  />
                  <ActionText onClick={() => rotateKey(key)}>Change</ActionText>
                </div>,
              ])}
            />
          </motion.div>
        )}

        {activeTab === "marketplace" && (
          <motion.div key="marketplace" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
            <DataTable
              headers={["Config", "Owner", "Price", "Visibility", "Actions"]}
              rows={overview.configs.map((config) => [
                config.name,
                config.ownerName,
                Number(config.price) > 0 ? `$${Number(config.price).toFixed(2)}` : "Free",
                config.visibility,
                <div key={config.id} className="flex gap-2">
                  <ActionText onClick={() => togglePublish(config)}>{config.isPublished ? "Hide" : "Publish"}</ActionText>
                  <ActionText onClick={() => cycleVisibility(config)}>Cycle</ActionText>
                </div>,
              ])}
            />
          </motion.div>
        )}

        {activeTab === "update-table" && (
          <motion.div key="update-table" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="space-y-4">
            <section className="luxx-surface px-6 py-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-2xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#8ebfff]">Update Table</p>
                  <h2 className="mt-3 text-2xl font-black uppercase tracking-[0.06em] text-white">Default dashboard table</h2>
                  <p className="mt-3 text-sm leading-7 text-[#8d9ab4]">
                    Update the shared Lua table the dashboard falls back to when no active user config is loaded.
                  </p>
                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <Field label="Title" value={defaultTitle} onChange={setDefaultTitle} />
                    <Field label="Tier" value={defaultTier} onChange={setDefaultTier} />
                    <Field label="Updated" value={overview.panelDefaults?.updatedAt ? new Date(overview.panelDefaults.updatedAt).toLocaleString() : "Never"} readOnly />
                  </div>
                  <div className="mt-4">
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7f8ba6]">Description</label>
                    <input
                      value={defaultDescription}
                      onChange={(event) => setDefaultDescription(event.target.value)}
                      className="luxx-input"
                      placeholder="Short note about this default table"
                    />
                  </div>
                </div>

                <button onClick={savePanelDefaults} disabled={savingDefaults} className="luxx-button luxx-button-primary min-w-[180px] justify-center disabled:opacity-50">
                  <Save size={14} />
                  {savingDefaults ? "Saving..." : "Save Table"}
                </button>
              </div>
            </section>

            <section className="luxx-surface overflow-hidden">
              <div className="luxx-strip px-5 py-3">
                <p className="luxx-section-title">Lua Table</p>
              </div>
              <div className="p-5">
                <textarea
                  value={defaultLuaContent}
                  onChange={(event) => setDefaultLuaContent(event.target.value)}
                  rows={24}
                  className="luxx-input min-h-[560px] resize-y font-mono text-[12px] leading-6"
                  placeholder='shared.luxx = { ["Example"] = { ["Enabled"] = true } }'
                />
              </div>
            </section>
          </motion.div>
        )}

        {activeTab === "stats" && (
          <motion.div key="stats" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {stats.map((card) => (
                <div key={card.label} className="luxx-surface px-5 py-5">
                  <p className="text-3xl font-black text-white">{card.value}</p>
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7f8ba6]">{card.label}</p>
                </div>
              ))}
            </div>

            <div className="luxx-surface px-5 py-5">
              <div className="flex items-center gap-3">
                <Shield className="text-[#8ab3ff]" size={18} />
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white">Audit Log</p>
              </div>
              <div className="mt-4 space-y-3">
                {overview.auditLogs.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="border border-white/[0.06] bg-[#0a121d] px-4 py-3">
                    <p className="text-sm font-semibold text-white">{entry.action}</p>
                    <p className="mt-1 text-sm text-[#90a0bc]">{entry.details}</p>
                    <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-[#6f7d99]">{new Date(entry.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DataTable({ headers, rows }) {
  return (
    <div className="luxx-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-white/10">
              {headers.map((header) => (
                <th key={header} className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7f8ba6]">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-white/5 last:border-b-0">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-4 text-sm text-[#d0dbef]">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionText({ children, onClick }) {
  return (
    <button onClick={onClick} className="luxx-button px-3 py-1.5">
      {children}
    </button>
  );
}

function Field({ label, value, onChange, readOnly = false }) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7f8ba6]">{label}</label>
      <input
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        readOnly={readOnly}
        className={`luxx-input ${readOnly ? "cursor-default text-[#9ba9c4]" : ""}`}
      />
    </div>
  );
}
