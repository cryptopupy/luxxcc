import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Search, Settings2, Trash2, Upload } from "lucide-react";
import ConfigCard from "@/components/ConfigCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/api/client";

const TIERS = ["All", "Legit", "Semi-Legit", "Blatant", "Rage", "Custom"];
const VISIBILITY = ["private", "public", "premium"];

export default function Configs() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [marketplace, setMarketplace] = useState([]);
  const [myConfigs, setMyConfigs] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [search, setSearch] = useState("");
  const [activeTier, setActiveTier] = useState("All");
  const [tab, setTab] = useState("marketplace");
  const [showCreate, setShowCreate] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const payload = await api.get("/configs");
      setMarketplace(payload.marketplace || []);
      setMyConfigs(payload.myConfigs || []);
      setPurchases(payload.purchases || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const ownedConfigIds = new Set(purchases.map((purchase) => purchase.configId));
  const filteredListings = marketplace.filter((listing) => {
    const matchesSearch = `${listing.name} ${listing.description || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchesTier = activeTier === "All" || listing.tier === activeTier;
    return matchesSearch && matchesTier;
  });

  const handleBuy = async (listing) => {
    await api.post("/marketplace/purchase", { configId: listing.id });
    toast({ title: "Listing claimed", description: `${listing.name} is now in your library.` });
    await loadData();
  };

  const handleDownload = async (listing) => {
    await navigator.clipboard.writeText(listing.luaContent || "");
    toast({ title: "Copied", description: "Lua config copied to your clipboard." });
  };

  const handleSaveConfig = async (configData) => {
    if (editingConfig) {
      await api.put(`/configs/${editingConfig.id}`, configData);
      toast({ title: "Config updated", description: `${configData.name} was saved.` });
    } else {
      await api.post("/configs", configData);
      toast({ title: "Config created", description: `${configData.name} is ready.` });
    }

    setShowCreate(false);
    setEditingConfig(null);
    await loadData();
  };

  const handlePublish = async (config) => {
    await api.put(`/configs/${config.id}`, { isPublished: true });
    toast({ title: "Config published", description: `${config.name} is now in the marketplace.` });
    await loadData();
  };

  const handleDeleteConfig = async (config) => {
    await api.delete(`/configs/${config.id}`);
    toast({ title: "Config deleted", description: `${config.name} was removed.` });
    await loadData();
  };

  const handleActivate = async (config) => {
    await api.post("/configs/activate", { configId: config.id });
    toast({ title: "Config active", description: `${config.name} is now loaded for the script.` });
    await loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#8ab3ff]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex w-fit gap-2 rounded-xl border border-white/10 bg-[#101927] p-1">
        {["marketplace", "my"].map((tabId) => (
          <button
            key={tabId}
            onClick={() => setTab(tabId)}
            className={`rounded-lg px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] ${
              tab === tabId ? "bg-[#16233d] text-[#8ebfff]" : "text-[#8190ab]"
            }`}
          >
            {tabId === "marketplace" ? "Marketplace" : "My Configs"}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === "marketplace" ? (
          <motion.div key="marketplace" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="space-y-4">
            <div className="rounded-[26px] border border-white/10 bg-[#101927] p-5">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#51617f]" />
                <input
                  type="text"
                  placeholder="Search configs, sellers, or descriptions"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#09101a] py-3 pl-11 pr-4 text-sm text-white placeholder:text-[#41506d] focus:border-[#3e5f98] focus:outline-none"
                />
              </div>
              <div className="mt-4 flex gap-2 overflow-x-auto">
                {TIERS.map((tier) => (
                  <button
                    key={tier}
                    onClick={() => setActiveTier(tier)}
                    className={`rounded-md px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] ${
                      activeTier === tier ? "border border-[#355287] bg-[#13203b] text-[#d7e6ff]" : "border border-white/10 text-[#7e8ba8]"
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>

            {filteredListings.length === 0 ? (
              <EmptyState title="No listings found" description="Adjust your search or publish one of your own configs." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredListings.map((listing) => (
                  <ConfigCard
                    key={listing.id}
                    listing={listing}
                    owned={ownedConfigIds.has(listing.id) || myConfigs.some((config) => config.id === listing.id)}
                    onBuy={handleBuy}
                    onDownload={handleDownload}
                  />
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="my" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="space-y-4">
            <div className="flex items-center justify-between rounded-[26px] border border-white/10 bg-[#101927] p-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#7f8ba6]">My Configs</p>
                <p className="mt-2 text-sm text-[#93a1bf]">Save, activate, publish, and price your presets here.</p>
              </div>
              <button
                onClick={() => {
                  setEditingConfig(null);
                  setShowCreate(true);
                }}
                className="flex items-center gap-2 rounded-md border border-[#355287] bg-[#13203b] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#d7e6ff]"
              >
                <Plus size={14} />
                New Config
              </button>
            </div>

            {myConfigs.length === 0 ? (
              <EmptyState title="No configs yet" description="Create a config and it will appear here for activation or publishing." />
            ) : (
              <div className="space-y-3">
                {myConfigs.map((config) => (
                  <div key={config.id} className="rounded-[24px] border border-white/10 bg-[#101927] p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-white">{config.name}</h3>
                          <Tag>{config.tier}</Tag>
                          {config.isActive && <Tag tone="green">Active</Tag>}
                          {config.isPublished && <Tag tone="blue">{config.visibility}</Tag>}
                          {Number(config.price) > 0 && <Tag tone="gold">${Number(config.price).toFixed(2)}</Tag>}
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[#91a0be]">{config.description || "No description yet."}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!config.isActive && (
                          <SmallAction icon={Settings2} label="Activate" onClick={() => handleActivate(config)} />
                        )}
                        {!config.isPublished && (
                          <SmallAction icon={Upload} label="Publish" onClick={() => handlePublish(config)} />
                        )}
                        <SmallAction
                          icon={Plus}
                          label="Edit"
                          onClick={() => {
                            setEditingConfig(config);
                            setShowCreate(true);
                          }}
                        />
                        <SmallAction icon={Trash2} label="Delete" onClick={() => handleDeleteConfig(config)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <ConfigFormDialog
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          setEditingConfig(null);
        }}
        onSave={handleSaveConfig}
        initial={editingConfig}
      />
    </div>
  );
}

function ConfigFormDialog({ open, onClose, onSave, initial }) {
  const [name, setName] = useState("");
  const [tier, setTier] = useState("Legit");
  const [visibility, setVisibility] = useState("private");
  const [price, setPrice] = useState("0");
  const [description, setDescription] = useState("");
  const [luaContent, setLuaContent] = useState("");

  useEffect(() => {
    if (initial) {
      setName(initial.name || "");
      setTier(initial.tier || "Legit");
      setVisibility(initial.visibility || "private");
      setPrice(String(initial.price || 0));
      setDescription(initial.description || "");
      setLuaContent(initial.luaContent || "");
      return;
    }

    setName("");
    setTier("Legit");
    setVisibility("private");
    setPrice("0");
    setDescription("");
    setLuaContent("");
  }, [initial, open]);

  const submit = (event) => {
    event.preventDefault();
    onSave({
      name,
      tier,
      visibility,
      price: Number(price || 0),
      description,
      luaContent,
      isPublished: initial?.isPublished || false,
    });
  };

  const inputClassName = "w-full rounded-xl border border-white/10 bg-[#09101a] px-4 py-3 text-sm text-white placeholder:text-[#41506d] focus:border-[#3e5f98] focus:outline-none";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl border-white/10 bg-[#0e1522]">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold uppercase tracking-[0.3em] text-[#9ec2ff]">
            {initial ? "Edit Config" : "Create Config"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <InputField label="Name" value={name} onChange={setName} className={inputClassName} />
            <SelectField label="Tier" value={tier} onChange={setTier} options={TIERS.filter((tier) => tier !== "All")} className={inputClassName} />
            <SelectField label="Visibility" value={visibility} onChange={setVisibility} options={VISIBILITY} className={inputClassName} />
            <InputField label="Price" type="number" value={price} onChange={setPrice} className={inputClassName} />
          </div>
          <InputField label="Description" value={description} onChange={setDescription} className={inputClassName} />
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7f8ba6]">Lua Content</label>
            <textarea
              value={luaContent}
              onChange={(event) => setLuaContent(event.target.value)}
              rows={12}
              className={`${inputClassName} resize-none font-mono text-[12px] leading-6`}
              required
            />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#8c98b3]">
              Cancel
            </button>
            <button type="submit" className="flex-1 rounded-xl border border-[#355287] bg-[#13203b] px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#dce8ff]">
              {initial ? "Save Config" : "Create Config"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InputField({ label, type = "text", value, onChange, className }) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7f8ba6]">{label}</label>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={className} required={label !== "Description"} />
    </div>
  );
}

function SelectField({ label, value, onChange, options, className }) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7f8ba6]">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={className}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function Tag({ children, tone = "default" }) {
  const map = {
    default: "border-white/10 text-[#8aa1c9]",
    blue: "border-[#355287] text-[#9ec2ff]",
    green: "border-[#295948] text-[#79d79b]",
    gold: "border-[#635533] text-[#f0d48d]",
  };

  return <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${map[tone]}`}>{children}</span>;
}

function SmallAction({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#c3d1ea]"
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-[#101927] px-6 py-12 text-center">
      <h3 className="text-xl font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-[#91a0be]">{description}</p>
    </div>
  );
}
