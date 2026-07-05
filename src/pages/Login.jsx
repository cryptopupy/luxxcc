import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Eye, EyeOff } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { api } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { checkUserAuth } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.post("/auth/login", { username, password });
      await checkUserAuth();
      navigate("/", { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  const inputClassName = "luxx-input text-[15px]";

  return (
    <AuthLayout
      title="LOGIN"
      subtitle="LUXX"
      footer={
        <>
          <span className="uppercase tracking-[0.18em] text-[#7f90ae]">No account?</span>{" "}
          <Link to="/register" className="font-semibold text-white transition-colors hover:text-[#c9d0dc]">
            Register
          </Link>
        </>
      }
    >
      {error && (
        <div className="mb-4 border border-[#3b2a2a] bg-[#1a1111] px-4 py-3 text-sm text-[#f0b8c1]">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-2 block text-[12px] font-medium uppercase tracking-[0.16em] text-[#97a3b9]">
            Username
          </label>
          <input
            type="text"
            autoComplete="username"
            autoFocus
            placeholder="Enter username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className={inputClassName}
            required
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#97a3b9]">
              Password
            </label>
            <Link to="/forgot-password" className="text-[11px] uppercase tracking-[0.12em] text-[#8b8b8b] transition-colors hover:text-white">
              Forgot
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={`${inputClassName} pr-11`}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a5f6e] hover:text-white transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center border border-[#29436d] bg-[#162238] px-4 py-3 text-[15px] font-black uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#1a2840] disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in
            </>
          ) : (
            "Login"
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
