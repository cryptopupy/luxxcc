import React, { useState, useEffect } from "react";
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
  const [discordId, setDiscordId] = useState("");
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

    setLoading(true);

    try {
      await api.post("/auth/register", {
        username,
        displayName: username,
        password,
        licenseKey,
        discordUsername,
        discordId,
      });
      await checkUserAuth();
      navigate("/", { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  // Discord OAuth flow
  const handleDiscordConnect = () => {
    const clientId = "1523261220017279046";
    const redirectUri = encodeURIComponent("https://luxxcc.pages.dev/");
    const oauthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify`;
    window.location.href = oauthUrl;
  };

  // After redirect back with code, exchange for token and fetch user info
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      const fetchToken = async () => {
        try {
          const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              client_id: "1523261220017279046",
              client_secret: "l0E0niNk-7Tr01mo7x3HEun0dTe7g5RO",
              grant_type: "authorization_code",
              code,
              redirect_uri: "https://luxxcc.pages.dev/",
            }),
          });
          const tokenData = await tokenResponse.json();
          const accessToken = tokenData.access_token;
          if (accessToken) {
            const userResp = await fetch("https://discord.com/api/users/@me", {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            const userData = await userResp.json();
            setDiscordUsername(userData.username + (userData.discriminator ? `#${userData.discriminator}` : ""));
            setDiscordId(userData.id);
          }
        } catch (e) {
          console.error("Discord OAuth error", e);
        }
      };
      fetchToken();
    }
  }, []);

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
        <Field label="Username" value={username} onChange={setUsername} placeholder="Enter username" className={inputClassName} />
        <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="Enter password" className={inputClassName} />
        <Field label="Confirm Password" type="password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirm password" className={inputClassName} />
        <Field label="License Key *" value={licenseKey} onChange={setLicenseKey} placeholder="Enter your license key" className={inputClassName} />

        {/* Discord Connect */}
        <div>
          <label className="mb-2 block text-[12px] font-medium uppercase tracking-[0.12em] text-[#97a3b9]">
            Discord
          </label>
          {discordUsername ? (
            <div className="luxx-input flex items-center gap-2 text-[#8ab3ff]">
              <svg width="16" height="12" viewBox="0 0 71 55" fill="currentColor">
                <path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.3 37.3 0 0025.4.3a.2.2 0 00-.2-.1 58.4 58.4 0 00-14.7 4.6.2.2 0 00-.1.1C1.5 18.7-.9 32 .3 45.2v.1a58.7 58.7 0 0017.9 9.1.2.2 0 00.3-.1 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.7 38.7 0 01-5.5-2.7.2.2 0 01-.1-.4l1.1-.9a.2.2 0 01.2 0 41.9 41.9 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 01-.1.4 36.4 36.4 0 01-5.5 2.7.2.2 0 00-.1.3 47.2 47.2 0 003.6 5.9.2.2 0 00.3.1A58.5 58.5 0 0070.7 45.3v-.1C72.1 30.1 68.1 16.9 60.2 5a.2.2 0 00-.1-.1zM23.7 37.1c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1 6.5 3.2 6.4 7.1c0 3.9-2.8 7.1-6.4 7.1zm23.6 0c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1 6.5 3.2 6.4 7.1c0 3.9-2.8 7.1-6.4 7.1z" />
              </svg>
              Connected as <strong>{discordUsername}</strong>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleDiscordConnect}
              className="flex items-center gap-2 border border-[#4752c4] bg-[#5865F2] px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-[#4752c4]"
            >
              <svg width="16" height="12" viewBox="0 0 71 55" fill="currentColor">
                <path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.3 37.3 0 0025.4.3a.2.2 0 00-.2-.1 58.4 58.4 0 00-14.7 4.6.2.2 0 00-.1.1C1.5 18.7-.9 32 .3 45.2v.1a58.7 58.7 0 0017.9 9.1.2.2 0 00.3-.1 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.7 38.7 0 01-5.5-2.7.2.2 0 01-.1-.4l1.1-.9a.2.2 0 01.2 0 41.9 41.9 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 01-.1.4 36.4 36.4 0 01-5.5 2.7.2.2 0 00-.1.3 47.2 47.2 0 003.6 5.9.2.2 0 00.3.1A58.5 58.5 0 0070.7 45.3v-.1C72.1 30.1 68.1 16.9 60.2 5a.2.2 0 00-.1-.1zM23.7 37.1c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1 6.5 3.2 6.4 7.1c0 3.9-2.8 7.1-6.4 7.1zm23.6 0c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1 6.5 3.2 6.4 7.1c0 3.9-2.8 7.1-6.4 7.1z" />
              </svg>
              Connect Discord
            </button>
          )}
        </div>

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
