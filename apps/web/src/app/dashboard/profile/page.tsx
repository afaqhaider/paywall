"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@paywall/ui";
import { ProtectedRoute } from "../../../components/protected-route";
import { DashboardNav } from "../../../components/dashboard-nav";
import { useAuth } from "../../../lib/auth-context";
import { ApiError } from "../../../lib/api-client";

interface Profile {
  id: string;
  email: string;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  timezone: string;
  language: string;
  country: string | null;
  phone: string | null;
}

function ProfileContent() {
  const { authedFetch } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    authedFetch<Profile>("/profile")
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      const updated = await authedFetch<Profile>("/profile", {
        method: "PATCH",
        body: JSON.stringify({
          firstName: profile.firstName,
          lastName: profile.lastName,
          displayName: profile.displayName,
          timezone: profile.timezone,
          language: profile.language,
          country: profile.country,
          phone: profile.phone,
        }),
      });
      setProfile(updated);
      setMessage("Profile updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordMessage(null);
    setPasswordSaving(true);
    try {
      const res = await authedFetch<{ message: string }>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPasswordMessage(res.message);
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : "Could not change password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  if (!profile) {
    return (
      <>
        <DashboardNav />
        <main className="mx-auto max-w-2xl px-6 py-10 text-sm text-slate-500">
          Loading profile…
        </main>
      </>
    );
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Your profile</h1>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Personal information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="flex flex-col gap-4" noValidate>
              {error ? <Alert variant="destructive">{error}</Alert> : null}
              {message ? <Alert variant="success">{message}</Alert> : null}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    value={profile.firstName ?? ""}
                    onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    value={profile.lastName ?? ""}
                    onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  value={profile.displayName ?? ""}
                  onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={profile.email} disabled />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    value={profile.timezone}
                    onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    maxLength={2}
                    placeholder="US"
                    value={profile.country ?? ""}
                    onChange={(e) =>
                      setProfile({ ...profile, country: e.target.value.toUpperCase() })
                    }
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={profile.phone ?? ""}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                />
              </div>
              <Button type="submit" disabled={saving} className="w-fit">
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="flex flex-col gap-4" noValidate>
              {passwordError ? <Alert variant="destructive">{passwordError}</Alert> : null}
              {passwordMessage ? <Alert variant="success">{passwordMessage}</Alert> : null}
              <div>
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div>
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  required
                  minLength={12}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" disabled={passwordSaving} className="w-fit">
                {passwordSaving ? "Updating..." : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}
