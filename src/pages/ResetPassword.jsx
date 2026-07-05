import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, Loader2, Lock } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { api } from "@/api/client";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get("token");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", { resetToken, newPassword });
      navigate("/login", { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Could not reset password");
    } finally {
      setLoading(false);
    }
  };

  if (!resetToken) {
    return (
      <AuthLayout
        title="Invalid Token"
        subtitle="A password reset token is required."
        footer={
          <Link to="/forgot-password" className="text-[#9ec2ff] transition-colors hover:text-white">
            Request a new reset link
          </Link>
        }
      >
        <div className="rounded-xl border border-white/10 bg-[#0b1420] px-4 py-4 text-sm leading-6 text-[#9ea9c6]">
          <AlertTriangle className="mb-3 h-5 w-5 text-[#8ab3ff]" />
          The reset link is missing its token. Generate a new one from the forgot-password screen.
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="New Password" subtitle="Set a fresh password for your Luxx account.">
      {error && (
        <div className="mb-4 rounded-xl border border-[#61333c] bg-[#211117] px-4 py-3 text-sm text-[#f0b8c1]">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordField
          label="New Password"
          value={newPassword}
          onChange={setNewPassword}
          placeholder="At least 8 characters"
        />
        <PasswordField
          label="Confirm Password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Repeat the new password"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-xl border border-[#355287] bg-[#13203b] px-4 py-3 text-sm font-semibold uppercase tracking-[0.22em] text-[#dce8ff] transition-colors hover:bg-[#18284a] disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Resetting
            </>
          ) : (
            "Reset Password"
          )}
        </button>
      </form>
    </AuthLayout>
  );
}

function PasswordField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7f8ba6]">{label}</label>
      <div className="relative">
        <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#51617f]" />
        <input
          type="password"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-white/10 bg-[#09101a] py-3 pl-11 pr-4 text-sm text-white placeholder:text-[#41506d] focus:border-[#3e5f98] focus:outline-none"
          required
        />
      </div>
    </div>
  );
}
