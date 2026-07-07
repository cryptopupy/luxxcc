import React, { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { RefreshCcw, Save } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/api/client";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-lua";
import "prismjs/themes/prism-tomorrow.css";

export default function Dashboard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [home, setHome] = useState(null);
  const [configs, setConfigs] = useState([]);
  const [applyBusy, setApplyBusy] = useState(false);
  const [editableConfig, setEditableConfig] = useState("");
  const [disconnected, setDisconnected] = useState(false);

  const initialLoadDone = useRef(false);
  const missedBeats = useRef(0);

  const loadData = async () => {
    if (!initialLoadDone.current) {
      setLoading(true);
    }
    try {
      const [homePayload, configPayload] = await Promise.all([api.get("/home"), api.get("/configs")]);
      setHome(homePayload.home);
      setConfigs(configPayload.myConfigs || []);

      // Only bail out to the home page after a few consecutive missed heartbeats,
      // so a single stale/slow poll doesn't bounce the user out mid-edit.
      if (!homePayload.home?.scriptConnected || !homePayload.home?.gameFound) {
        missedBeats.current += 1;
        if (missedBeats.current >= 3) {
          setDisconnected(true);
        }
      } else {
        missedBeats.current = 0;
        setDisconnected(false);
      }

      // Only update editable config on first load, or when explicitly resetting
      if (!initialLoadDone.current) {
        const newActiveConfig = configPayload.myConfigs.find((config) => config.isActive) || null;
        const newDashboardDefault = homePayload.home?.dashboardDefault || null;
        const newLuaContent = newActiveConfig?.luaContent || newDashboardDefault?.dashboardLuaContent;
        if (newLuaContent) {
          setEditableConfig(newLuaContent);
        }
        initialLoadDone.current = true;
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000); // Refresh every 3 seconds
    return () => clearInterval(interval);
  }, []);

  const activeConfig = configs.find((config) => config.isActive) || null;
  const dashboardDefault = home?.dashboardDefault || null;
  const dashboardTitle = home?.gameFound || displayedTitleFallback(activeConfig, dashboardDefault);
  const displayedConfig = activeConfig
    ? {
        name: activeConfig.name,
        tier: activeConfig.tier,
        luaContent: activeConfig.luaContent,
      }
    : dashboardDefault
      ? {
          name: dashboardDefault.dashboardTitle,
          tier: dashboardDefault.dashboardTier,
          luaContent: dashboardDefault.dashboardLuaContent,
        }
      : null;

  const resetConfig = async () => {
    const [homePayload, configPayload] = await Promise.all([api.get("/home"), api.get("/configs")]);
    setHome(homePayload.home);
    setConfigs(configPayload.myConfigs || []);

    // Use the fresh data from the payload, not the state!
    const newActiveConfig = configPayload.myConfigs.find((config) => config.isActive) || null;
    const newDashboardDefault = homePayload.home?.dashboardDefault || null;
    const newLuaContent = newActiveConfig?.luaContent || newDashboardDefault?.dashboardLuaContent;
    if (newLuaContent) {
      setEditableConfig(newLuaContent);
    }

    toast({ title: "Dashboard refreshed", description: "The latest active config was reloaded." });
  };

  const applyConfig = async () => {
    if (!activeConfig) {
      toast({ title: "No active config", description: "Pick or create a config before applying changes.", variant: "destructive" });
      return;
    }

    setApplyBusy(true);
    try {
      await api.put(`/configs/${activeConfig.id}`, {
        luaContent: editableConfig,
        isActive: true,
      });
      
      // Refresh the data
      const [homePayload, configPayload] = await Promise.all([api.get("/home"), api.get("/configs")]);
      setHome(homePayload.home);
      setConfigs(configPayload.myConfigs || []);

      toast({
        title: "Config applied",
        description: "The in-game script will pull the active config automatically within a few seconds.",
      });
    } catch (err) {
      toast({ title: "Error applying config", description: err?.message || "An error occurred", variant: "destructive" });
    } finally {
      setApplyBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#8ab3ff]" />
      </div>
    );
  }

  if (disconnected) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-4">
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="luxx-surface px-6 py-5"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[2.2rem] font-black uppercase tracking-[0.08em] text-white">
                {dashboardTitle.toUpperCase()}
              </h1>
            </div>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#77b6ff]">
              Config loaded: {(displayedConfig?.tier || "No active config").toUpperCase()}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <ActionButton icon={RefreshCcw} label="Reset" onClick={resetConfig} tone="danger" disabled={!displayedConfig || applyBusy} />
            <Link to="/configs" className="luxx-button">
              Configs
            </Link>
            <ActionButton
              icon={Save}
              label={applyBusy ? "Applying" : "Apply"}
              onClick={applyConfig}
              disabled={!activeConfig || applyBusy}
            />
          </div>
        </div>
      </motion.section>

      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-[18px] border border-white/10 overflow-hidden">
        <div
          className="editor-scrollbar flex items-start"
          style={{
            height: "70vh",
            maxHeight: "90vh",
            minHeight: "400px",
            overflowY: "auto",
            overflowX: "auto",
            backgroundColor: "#131825",
          }}
        >
          <div
            aria-hidden="true"
            className="select-none border-r border-white/[0.06] text-right font-mono text-xs leading-[1.72] text-[#4a5568]"
            style={{
              paddingTop: 24,
              paddingBottom: 24,
              paddingLeft: 16,
              paddingRight: 12,
              fontFamily: '"Fira Code", "Fira Mono", monospace',
            }}
          >
            {editableConfig.split("\n").map((_, index) => (
              <div key={index}>{index + 1}</div>
            ))}
          </div>
          <Editor
            value={editableConfig}
            onValueChange={(code) => setEditableConfig(code)}
            highlight={(code) => Prism.highlight(code, Prism.languages.lua, "lua")}
            padding={24}
            className="flex-1 font-mono text-xs leading-[1.72]"
            style={{
              backgroundColor: "#131825",
              fontFamily: '"Fira Code", "Fira Mono", monospace',
              overflow: "visible",
            }}
            spellCheck={false}
          />
        </div>
        <style>{`
          .editor-scrollbar::-webkit-scrollbar {
            width: 12px;
            height: 12px;
          }
          .editor-scrollbar::-webkit-scrollbar-track {
            background: #0f1420;
          }
          .editor-scrollbar::-webkit-scrollbar-thumb {
            background: #2d3a52;
            border-radius: 6px;
          }
          .editor-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #3d4a62;
          }
        `}</style>
      </motion.section>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, tone = "default", disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`luxx-button ${tone === "danger" ? "luxx-button-danger" : ""} ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function displayedTitleFallback(activeConfig, dashboardDefault) {
  return activeConfig?.name || dashboardDefault?.dashboardTitle || "LUXX";
}
