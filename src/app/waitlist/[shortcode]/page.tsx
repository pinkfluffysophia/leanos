"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users } from "lucide-react";
import { toast } from "sonner";

interface WaitlistInfo {
  title: string;
  description: string | null;
  shortcode: string;
  memberCount: number;
}

export default function WaitlistPublicPage() {
  const params = useParams();
  const shortcode = params.shortcode as string;

  const [waitlist, setWaitlist] = useState<WaitlistInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    fetch(`/api/waitlist/${shortcode}`)
      .then((res) => {
        if (!res.ok) {
          setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setWaitlist(data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoaded(true));
  }, [shortcode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !firstName.trim() || !lastName.trim()) {
      toast.error("All fields are required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/waitlist/${shortcode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }),
      });

      if (res.ok) {
        setJoined(true);
        toast.success("Successfully joined the waitlist!");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to join");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-950">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-950">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Not Found</h1>
          <p className="text-muted-foreground mt-2">This waitlist does not exist or is no longer active.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-gray-950 flex flex-col items-center justify-center px-4 py-16">
      {/* Hero */}
      <div className="text-center max-w-2xl mb-8">
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white leading-tight">
          {waitlist?.title}
        </h1>
        {waitlist?.description && (
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
            {waitlist.description}
          </p>
        )}
        <div className="mt-6 inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-full text-sm font-medium">
          <Users className="h-4 w-4" />
          {waitlist?.memberCount} {waitlist?.memberCount === 1 ? "person" : "people"} joined
        </div>
      </div>

      {/* Form Card */}
      <Card className="w-full max-w-lg">
        <CardContent className="p-6 sm:p-8">
          {joined ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 mb-4">
                <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">You&apos;re on the list!</h2>
              <p className="text-muted-foreground mt-2">
                We&apos;ll let you know when it&apos;s your turn.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Join the waiting list</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Be the first to know when we launch.
                </p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="wlEmail">Email *</Label>
                  <Input
                    id="wlEmail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="wlFirstName">First Name *</Label>
                    <Input
                      id="wlFirstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wlLastName">Last Name *</Label>
                    <Input
                      id="wlLastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                  {submitting ? "Joining..." : "Join the waiting list"}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
