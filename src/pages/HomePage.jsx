import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";

export default function HomePage() {
  const navigate = useNavigate();
  const { home, user, checkUserAuth } = useAuth();
  const { toast } = useToast();
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState(home);
  const [activeConfig, setActiveConfig] = useState(null);

  useEffect(() => {
    setStatus(home);
  }, [home]);

  useEffect(() => {
    const refresh = async (withConfigs = false) => {
      try {
        const payload = await api.get("/home");
        setStatus(payload.home);
        if (withConfigs) {
          const configPayload = await api.get("/configs");
          const configs = configPayload.myConfigs || [];
          setActiveConfig(configs.find((config) => config.isActive) || configs[0] || null);
        }
      } catch {
        return;
      }
    };

    refresh(true);
    const timer = window.setInterval(() => refresh(false), 3000);
    return () => window.clearInterval(timer);
  }, []);

  const licenseKey = status?.loaderCommand?.match(/license=([^"]+)/)?.[1] || "LUXX-XXXX-XXXX-XXXX";

  const copyText = async (value, message) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast({ title: "Copied", description: message });
    window.setTimeout(() => setCopied(false), 1800);
  };

  const refreshStatus = async () => {
    await checkUserAuth();
    const payload = await api.get("/home");
    setStatus(payload.home);
  };

  const downloadActiveConfig = () => {
    if (!activeConfig?.luaContent) {
      toast({ title: "No config ready", description: "Create or activate a config first." });
      return;
    }

    const blob = new Blob([activeConfig.luaContent], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(activeConfig.name || "luxx-config").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.lua`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const isConnected = Boolean(status?.scriptConnected);
  const hasValidGame = Boolean(isConnected && status?.gameFound);

  return (
    <div className="space-y-6">
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="luxx-surface">
        <div className="px-6 py-7">
          <h1 className="text-[2rem] font-semibold tracking-[-0.03em] text-white">
            Welcome, {user?.displayName || "operator"}
          </h1>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="luxx-surface relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(58,107,194,0.16),_transparent_56%)]" />
        <div className="relative px-6 py-12 text-center sm:px-8 sm:py-16">
          {hasValidGame ? (
            <div className="mx-auto flex h-10 items-center justify-center">
              <svg className="h-12 w-12 text-[#38c278]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <SignalBars />
          )}
          <h2 className="mt-6 text-[2.2rem] font-black uppercase tracking-[0.14em] text-white">
            {hasValidGame ? "Game Found" : "Verifying..."}
          </h2>
          <div className="mx-auto mt-4 flex max-w-[360px] items-center gap-4">
            <span className="h-px flex-1 bg-white/[0.07]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-[#808ba2]">
              {hasValidGame ? status.gameFound : "Waiting for game...."}
            </p>
            <span className="h-px flex-1 bg-white/[0.07]" />
          </div>
          <p className="mx-auto mt-5 max-w-xl text-sm text-[#8994ab]">
            {hasValidGame
              ? `${status?.executor || "Unknown executor"} is online and the web panel is ready.`
              : null}
          </p>
          <button onClick={refreshStatus} className="luxx-button mt-8">
            Refresh Status
          </button>
        </div>
      </motion.section>

      <div className="mx-auto max-w-4xl">
        <ActionTile
          title="LUXX SCRIPT"
          primaryAction={{
            label: "Configure Configs",
            onClick: () => navigate("/configs"),
          }}
          showKey={showKey}
          onToggleKey={() => setShowKey((value) => !value)}
          onCopyKey={() => copyText(licenseKey, "License key copied to clipboard")}
          copied={copied}
          licenseKey={licenseKey}
        />
      </div>
    </div>
  );
}

function ActionTile({
  title,
  primaryAction,
  secondaryAction,
  showKey,
  onToggleKey,
  onCopyKey,
  copied,
  licenseKey,
  onDownload,
}) {
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="luxx-surface px-6 py-7 sm:px-7">
      <h2 className="text-[2.15rem] font-black uppercase tracking-[-0.06em] text-white">{title}</h2>
      <div className={`mt-12 grid gap-4 ${secondaryAction ? "sm:grid-cols-2" : ""}`}>
        <button onClick={primaryAction.onClick} className="luxx-button w-full">
          {primaryAction.label}
        </button>
        {secondaryAction ? (
          <button onClick={secondaryAction.onClick} className="luxx-button w-full">
            {secondaryAction.label}
          </button>
        ) : null}
      </div>
      <div className="luxx-divider mt-8 pt-7">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#6a7690]">Licensed Key</p>
          <div className="flex gap-2">
            <button onClick={onToggleKey} className="luxx-icon-button">
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
            <button onClick={onCopyKey} className="luxx-icon-button">
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
        </div>
        <div className="mt-4 border border-white/[0.05] bg-[#0a0d15] px-4 py-4 font-mono text-sm tracking-[0.32em] text-[#dbe7ff]">
          {showKey ? licenseKey : "********"}
        </div>
      </div>

    </motion.section>
  );
}

function SignalBars() {
  return (
    <div className="mx-auto flex h-10 items-center justify-center gap-3">
      {[1, 2, 3, 4].map((_, index) => (
        <motion.span
          key={index}
          className="w-2 rounded-full bg-[#69b0ff]"
          initial={{ height: 8, opacity: 0.3 }}
          animate={{
            height: [8, 20, 8],
            opacity: [0.3, 1, 0.3],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            repeatType: "loop",
            delay: index * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
