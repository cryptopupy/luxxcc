import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { api } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";

export default function Register() {
  const navigate = useNavigate();
  const { checkUserAuth } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [discordUsername, setDiscordUsername] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const inputClassName = "luxx-input text-[15px]";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    if (!acceptTerms) {
      setError("You must accept the terms to create an account");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/register", {
        username,
        displayName: username,
        password,
        licenseKey,
        discordUsername,
      });
      await checkUserAuth();
      navigate("/", { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="REGISTER"
      subtitle="LUXX"
      footer={
        <>
          <span className="uppercase tracking-[0.18em] text-[#7f90ae]">Member?</span>{" "}
          <Link to="/login" className="font-semibold text-white transition-colors hover:text-[#c9d0dc]">
            Login
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
        <Field
          label="Username"
          value={username}
          onChange={setUsername}
          placeholder="Enter username"
          className={inputClassName}
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="Enter password"
          className={inputClassName}
        />
        <Field
          label="Confirm Password"
          type="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Confirm password"
          className={inputClassName}
        />
        <Field
          label="License Key *"
          value={licenseKey}
          onChange={(value) => setLicenseKey(value)}
          placeholder="Enter your license key"
          className={inputClassName}
        />
        <Field
          label="Discord Username *"
          value={discordUsername}
          onChange={setDiscordUsername}
          placeholder="Discord Username (e.g. user#1234 or user)"
          className={inputClassName}
        />



        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center border border-[#29436d] bg-[#162238] px-4 py-3 text-[15px] font-black uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#1a2840] disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Account
            </>
          ) : (
            "Register"
          )}
        </button>
      </form>
    </AuthLayout>
  );
}

function Field({ label, type = "text", value, onChange, placeholder, className }) {
  return (
    <div>
      <label className="mb-2 block text-[12px] font-medium uppercase tracking-[0.12em] text-[#97a3b9]">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={className}
        required
      />
    </div>
  );
}
