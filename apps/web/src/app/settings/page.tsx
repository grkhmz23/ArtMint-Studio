"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { useWallet } from "@solana/wallet-adapter-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, User, Link as LinkIcon, Twitter, MessageCircle, Globe, Camera, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserProfile {
  wallet: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  website: string | null;
  twitter: string | null;
  discord: string | null;
}

export default function SettingsPage() {
  const { publicKey } = useWallet();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<UserProfile>>({});

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setProfile(data.profile);
      setFormData(data.profile);
    } catch (err) {
      console.error("Failed to load profile:", err);
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) return;

    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update");
      }

      const data = await res.json();
      setProfile(data.profile);
      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof UserProfile, value: string | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (!publicKey) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <div className="noise-overlay" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <User className="w-12 h-12 text-[var(--text-dim)] mx-auto" />
            <p className="font-mono text-sm text-[var(--text-dim)]">
              Connect your wallet to edit your profile
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <div className="noise-overlay" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="noise-overlay" />

      <div className="max-w-[800px] mx-auto w-full p-6 lg:p-12 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="font-serif text-4xl text-white">Settings</h1>
          <p className="font-mono text-sm text-[var(--text-dim)]">
            Customize your profile and manage your account
          </p>
        </div>

        {/* Profile Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Avatar Section */}
          <div className="border border-[var(--border)] bg-[var(--bg-card)] p-6 space-y-4">
            <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--text-dim)]">
              Profile Picture
            </h2>
            <div className="flex items-center gap-4">
              {formData.avatarUrl ? (
                <img
                  src={formData.avatarUrl}
                  alt=""
                  className="w-20 h-20 object-cover rounded-full"
                />
              ) : (
                <div className="w-20 h-20 bg-[var(--accent)] flex items-center justify-center rounded-full">
                  <User size={32} className="text-black" />
                </div>
              )}
              <div className="flex-1 space-y-2">
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
                  Avatar URL
                </label>
                <Input
                  type="url"
                  value={formData.avatarUrl || ""}
                  onChange={(e) => handleChange("avatarUrl", e.target.value || null)}
                  placeholder="https://example.com/avatar.png"
                  className="font-mono text-sm"
                />
                <p className="font-mono text-[10px] text-[var(--text-dim)]">
                  Enter a URL to an image (square format recommended)
                </p>
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div className="border border-[var(--border)] bg-[var(--bg-card)] p-6 space-y-6">
            <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--text-dim)]">
              Basic Information
            </h2>

            {/* Username */}
            <div className="space-y-2">
              <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
                Username
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] font-mono">
                  @
                </span>
                <Input
                  value={formData.username || ""}
                  onChange={(e) => handleChange("username", e.target.value.toLowerCase() || null)}
                  placeholder="username"
                  pattern="[a-zA-Z0-9_]+"
                  minLength={3}
                  maxLength={30}
                  className="pl-8 font-mono text-sm"
                />
              </div>
              <p className="font-mono text-[10px] text-[var(--text-dim)]">
                3-30 characters, letters, numbers, and underscores only
              </p>
            </div>

            {/* Display Name */}
            <div className="space-y-2">
              <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
                Display Name
              </label>
              <Input
                value={formData.displayName || ""}
                onChange={(e) => handleChange("displayName", e.target.value || null)}
                placeholder="Your Name"
                maxLength={50}
                className="font-mono text-sm"
              />
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
                Bio
              </label>
              <textarea
                value={formData.bio || ""}
                onChange={(e) => handleChange("bio", e.target.value || null)}
                placeholder="Tell us about yourself..."
                maxLength={500}
                rows={4}
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] text-white font-mono text-sm focus:outline-none focus:border-[var(--accent)] resize-none"
              />
              <p className="font-mono text-[10px] text-[var(--text-dim)] text-right">
                {(formData.bio?.length || 0)}/500
              </p>
            </div>
          </div>

          {/* Social Links */}
          <div className="border border-[var(--border)] bg-[var(--bg-card)] p-6 space-y-6">
            <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--text-dim)]">
              Social Links
            </h2>

            {/* Website */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
                <Globe size={12} />
                Website
              </label>
              <Input
                type="url"
                value={formData.website || ""}
                onChange={(e) => handleChange("website", e.target.value || null)}
                placeholder="https://yourwebsite.com"
                className="font-mono text-sm"
              />
            </div>

            {/* Twitter */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
                <Twitter size={12} />
                Twitter / X
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] font-mono">
                  @
                </span>
                <Input
                  value={formData.twitter || ""}
                  onChange={(e) => handleChange("twitter", e.target.value.replace(/^@/, "") || null)}
                  placeholder="username"
                  maxLength={15}
                  className="pl-8 font-mono text-sm"
                />
              </div>
            </div>

            {/* Discord */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
                <MessageCircle size={12} />
                Discord
              </label>
              <Input
                value={formData.discord || ""}
                onChange={(e) => handleChange("discord", e.target.value || null)}
                placeholder="username"
                maxLength={50}
                className="font-mono text-sm"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between pt-4">
            <p className="font-mono text-xs text-[var(--text-dim)]">
              Wallet: {publicKey.toBase58().slice(0, 6)}...{publicKey.toBase58().slice(-4)}
            </p>
            <Button
              type="submit"
              disabled={saving}
              className="gap-2"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check size={16} />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
