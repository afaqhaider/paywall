"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@paywall/ui";
import { ProtectedRoute } from "../../../../../components/protected-route";
import { DashboardNav } from "../../../../../components/dashboard-nav";
import { AppNav } from "../../../../../components/app-nav";
import { CopyableSecret } from "../../../../../components/copyable-secret";
import { useAuth } from "../../../../../lib/auth-context";
import { ApiError } from "../../../../../lib/api-client";
import {
  APPLICATION_MEMBER_ROLES,
  type ApplicationMember,
  type ApplicationMemberRole,
} from "../../../../../lib/applications-types";
import type {
  DeveloperInvitation,
  DeveloperInvitationCreated,
} from "../../../../../lib/invitations-types";

function ApplicationMembersContent() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const { authedFetch } = useAuth();

  const [members, setMembers] = useState<ApplicationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ApplicationMemberRole>("VIEWER");
  const [adding, setAdding] = useState(false);

  // --- Invitations (email-based, doesn't require the invitee to already
  // have an account - coexists alongside the "add existing user" flow above) ---
  const [invitations, setInvitations] = useState<DeveloperInvitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(true);
  const [invitationsError, setInvitationsError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<ApplicationMemberRole>("DEVELOPER");
  const [inviting, setInviting] = useState(false);
  const [lastInvite, setLastInvite] = useState<DeveloperInvitationCreated | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<ApplicationMember[]>(`/applications/${applicationId}/members`);
      setMembers(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load members.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, applicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadInvitations = useCallback(async () => {
    setInvitationsLoading(true);
    setInvitationsError(null);
    try {
      const data = await authedFetch<DeveloperInvitation[]>(
        `/applications/${applicationId}/invitations`,
      );
      setInvitations(data);
    } catch (err) {
      setInvitationsError(err instanceof ApiError ? err.message : "Could not load invitations.");
    } finally {
      setInvitationsLoading(false);
    }
  }, [authedFetch, applicationId]);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setAdding(true);
    try {
      await authedFetch(`/applications/${applicationId}/members`, {
        method: "POST",
        body: JSON.stringify({ email, role }),
      });
      setEmail("");
      setRole("VIEWER");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add member.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRoleChange(membershipId: string, newRole: ApplicationMemberRole) {
    try {
      await authedFetch(`/applications/${applicationId}/members/${membershipId}`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update role.");
    }
  }

  async function handleRemove(membershipId: string) {
    try {
      await authedFetch(`/applications/${applicationId}/members/${membershipId}`, {
        method: "DELETE",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove member.");
    }
  }

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    setInvitationsError(null);
    setInviting(true);
    setLastInvite(null);
    try {
      const created = await authedFetch<DeveloperInvitationCreated>(
        `/applications/${applicationId}/invitations`,
        { method: "POST", body: JSON.stringify({ email: inviteEmail, role: inviteRole }) },
      );
      setLastInvite(created);
      setInviteEmail("");
      setInviteRole("DEVELOPER");
      await loadInvitations();
    } catch (err) {
      setInvitationsError(err instanceof ApiError ? err.message : "Could not send invitation.");
    } finally {
      setInviting(false);
    }
  }

  async function handleResendInvite(invitationId: string) {
    setInvitationsError(null);
    setLastInvite(null);
    try {
      await authedFetch(`/applications/${applicationId}/invitations/${invitationId}/resend`, {
        method: "POST",
      });
      await loadInvitations();
    } catch (err) {
      setInvitationsError(err instanceof ApiError ? err.message : "Could not resend invitation.");
    }
  }

  async function handleRevokeInvite(invitationId: string) {
    setInvitationsError(null);
    try {
      await authedFetch(`/applications/${applicationId}/invitations/${invitationId}`, {
        method: "DELETE",
      });
      await loadInvitations();
    } catch (err) {
      setInvitationsError(err instanceof ApiError ? err.message : "Could not revoke invitation.");
    }
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <AppNav applicationId={applicationId} />
        <h1 className="text-2xl font-semibold text-slate-900">Members</h1>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}

        <Card className="mt-6">
          <CardContent className="pt-6">
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : members.length === 0 ? (
              <p className="text-sm text-slate-500">No members yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.membershipId}>
                      <TableCell>
                        <div className="font-medium text-slate-900">
                          {member.user.displayName ?? member.user.email}
                        </div>
                        <div className="text-xs text-slate-500">{member.user.email}</div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={member.role}
                          onChange={(e) =>
                            void handleRoleChange(
                              member.membershipId,
                              e.target.value as ApplicationMemberRole,
                            )
                          }
                          className="h-9 w-40"
                        >
                          {APPLICATION_MEMBER_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </Select>
                      </TableCell>
                      <TableCell>{new Date(member.joinedAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleRemove(member.membershipId)}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <form
              onSubmit={handleAdd}
              className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-end"
              noValidate
            >
              <div className="flex-1">
                <Label htmlFor="memberEmail">Email (must already have an account)</Label>
                <Input
                  id="memberEmail"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@example.com"
                />
              </div>
              <div>
                <Label htmlFor="memberRole">Role</Label>
                <Select
                  id="memberRole"
                  value={role}
                  onChange={(e) => setRole(e.target.value as ApplicationMemberRole)}
                >
                  {APPLICATION_MEMBER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" disabled={adding}>
                {adding ? "Adding..." : "Add member"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
          </CardHeader>
          <CardContent>
            {invitationsError ? (
              <Alert variant="destructive" className="mb-4">
                {invitationsError}
              </Alert>
            ) : null}
            {lastInvite ? (
              <Alert className="mb-4">
                <p className="font-medium">
                  Invitation created for {lastInvite.email} - share this link (it will not be shown
                  again):
                </p>
                <div className="mt-2">
                  <CopyableSecret value={lastInvite.acceptUrl} />
                </div>
              </Alert>
            ) : null}

            {invitationsLoading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : invitations.length === 0 ? (
              <p className="text-sm text-slate-500">No pending invitations.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell className="font-medium text-slate-900">
                        {invitation.email}
                      </TableCell>
                      <TableCell>{invitation.role}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            invitation.status === "PENDING"
                              ? "outline"
                              : invitation.status === "ACCEPTED"
                                ? "success"
                                : "destructive"
                          }
                        >
                          {invitation.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(invitation.expiresAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={invitation.status !== "PENDING"}
                            onClick={() => void handleResendInvite(invitation.id)}
                          >
                            Resend
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={invitation.status !== "PENDING"}
                            onClick={() => void handleRevokeInvite(invitation.id)}
                          >
                            Revoke
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <form
              onSubmit={handleInvite}
              className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-end"
              noValidate
            >
              <div className="flex-1">
                <Label htmlFor="inviteEmail">Invite by email</Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="new-teammate@example.com"
                />
              </div>
              <div>
                <Label htmlFor="inviteRole">Role</Label>
                <Select
                  id="inviteRole"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as ApplicationMemberRole)}
                >
                  {APPLICATION_MEMBER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" disabled={inviting || !inviteEmail}>
                {inviting ? "Sending..." : "Send invite"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

export default function ApplicationMembersPage() {
  return (
    <ProtectedRoute>
      <ApplicationMembersContent />
    </ProtectedRoute>
  );
}
