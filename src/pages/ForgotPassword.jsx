import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { api } from "@/api/client";

export default function ForgotPassword() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { username });
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Request a secure password reset token."
      footer={
        <Link to="/login" className="text-[#9ec2ff] transition-colors hover:text-white">
          <ArrowLeft className="mr-1 inline h-3 w-3" />
          Back to login
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-xl border border-white/10 bg-[#0b1420] px-4 py-4 text-sm leading-6 text-[#9ea9c6]">
          If the email exists, a reset token has been generated in the local data store for development use.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7f8ba6]">Username</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#51617f]" />
              <input
                type="text"
                autoFocus
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter your username"
                className="luxx-input py-3 pl-11 pr-4"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-xl border border-[#355287] bg-[#13203b] px-4 py-3 text-sm font-semibold uppercase tracking-[0.22em] text-[#dce8ff] transition-colors hover:bg-[#18284a] disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending
              </>
            ) : (
              "Send Reset Request"
            )}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
