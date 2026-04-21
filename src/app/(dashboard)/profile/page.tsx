"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Mail, Calendar, Hash, Copy, Check, Users } from "lucide-react";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  profilePictureUrl: string | null;
  referralCode: string;
  referredBy: string | null;
  referralCount: number;
  createdAt: string;
}

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    nickname: "",
  });

  const [referralCode, setReferralCode] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/users/profile");
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        setFormData({
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          nickname: data.nickname || "",
        });
        // Sync session with DB data only if it differs
        if (
          data.firstName !== session?.user?.firstName ||
          data.lastName !== session?.user?.lastName ||
          data.profilePictureUrl !== session?.user?.profilePictureUrl
        ) {
          await update({
            firstName: data.firstName,
            lastName: data.lastName,
            profilePictureUrl: data.profilePictureUrl,
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await update({
          firstName: formData.firstName,
          lastName: formData.lastName,
        });
        await fetchProfile();
        toast.success("Profile updated successfully");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to update profile");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyReferralCode = async () => {
    if (!referralCode.trim()) return;

    try {
      const response = await fetch("/api/users/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: referralCode }),
      });

      if (response.ok) {
        toast.success("Referral code applied successfully");
        setReferralCode("");
        await fetchProfile();
      } else {
        const data = await response.json();
        toast.error(data.error || "Invalid referral code");
      }
    } catch {
      toast.error("An error occurred");
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/users/upload-avatar", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        await update({ profilePictureUrl: data.profilePictureUrl });
        await fetchProfile();
        toast.success("Profile picture updated");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to upload picture");
      }
    } catch {
      toast.error("An error occurred uploading your picture");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const copyReferralLink = () => {
    const link = `${window.location.origin}/signup?ref=${profile?.referralCode || ""}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(link).then(() => {
        setCopied(true);
        toast.success("Referral link copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        fallbackCopy(link);
      });
    } else {
      fallbackCopy(link);
    }
  };

  const fallbackCopy = (text: string) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    setCopied(true);
    toast.success("Referral link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Manage your personal information and preferences
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 items-start">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Update your personal details</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              {/* Profile Picture */}
              <div className="flex flex-col items-center gap-3">
                <Avatar className="!size-20">
                  <AvatarImage src={profile?.profilePictureUrl || session?.user?.profilePictureUrl || undefined} />
                  <AvatarFallback className="bg-gray-500 text-white text-xl">
                    {getInitials(
                      profile?.firstName || session?.user?.firstName || "U",
                      profile?.lastName || session?.user?.lastName || "U"
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {isUploading ? "Uploading..." : "Change Picture"}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, PNG or GIF. Max 2MB.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Name Fields */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    placeholder="John"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nickname">Nickname (Optional)</Label>
                <Input
                  id="nickname"
                  value={formData.nickname}
                  onChange={(e) =>
                    setFormData({ ...formData, nickname: e.target.value })
                  }
                  placeholder="johnd"
                />
              </div>

              {/* Email (Read-only) */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  value={profile?.email || session?.user?.email || ""}
                  disabled
                  className="bg-gray-50 dark:bg-gray-900"
                />
                <p className="text-xs text-muted-foreground">
                  Email address cannot be changed. Contact support if you need to update it.
                </p>
              </div>

              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Account Details */}
          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                <Hash className="h-5 w-5 flex-shrink-0 text-purple-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium">User ID</p>
                  <p className="text-xs text-muted-foreground font-mono break-all">
                    {session?.user?.id}
                  </p>
                </div>
              </div>
              <div className="flex items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                <Mail className="h-5 w-5 flex-shrink-0 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-xs text-muted-foreground">
                    {profile?.email || session?.user?.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                <Calendar className="h-5 w-5 flex-shrink-0 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium">Member Since</p>
                  <p className="text-xs text-muted-foreground">
                    {profile?.createdAt
                      ? new Date(profile.createdAt).toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })
                      : "Loading..."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Referral Section */}
          <Card>
            <CardHeader>
              <CardTitle>Referral Program</CardTitle>
              <CardDescription>Invite friends and earn rewards</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Apply Referral Code - only show if not already referred */}
              {profile?.referredBy ? (
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 text-sm text-green-700 dark:text-green-300">
                  You were referred by another user. Thanks for joining!
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="referralCode">Enter Referral Code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="referralCode"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      placeholder="ABCD1234"
                      className="uppercase"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleApplyReferralCode}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              )}

              <Separator />

              {/* Your Referral Link */}
              <div className="space-y-2">
                <Label>Your Referral Link</Label>
                <div className="flex gap-2">
                  <Input
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/signup?ref=${profile?.referralCode || ""}`}
                    readOnly
                    className="bg-gray-50 dark:bg-gray-900 text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={copyReferralLink}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Referral Count */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                <Users className="h-5 w-5 flex-shrink-0 text-amber-500" />
                <div>
                  <p className="text-sm font-medium">
                    {profile?.referralCount ?? 0} {profile?.referralCount === 1 ? "person" : "people"} referred
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Users who used your referral code
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
