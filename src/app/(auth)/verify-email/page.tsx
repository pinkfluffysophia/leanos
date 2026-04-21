"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "pending">("pending");
  const [message, setMessage] = useState("");

  const token = searchParams.get("token");
  const email = searchParams.get("email");

  useEffect(() => {
    if (token) {
      verifyEmail(token);
    }
  }, [token]);

  async function verifyEmail(verificationToken: string) {
    setStatus("loading");
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verificationToken }),
      });

      const result = await response.json();

      if (response.ok) {
        setStatus("success");
        setMessage("Your email has been verified successfully!");
        setTimeout(() => router.push("/login"), 3000);
      } else {
        setStatus("error");
        setMessage(result.error || "Verification failed");
      }
    } catch {
      setStatus("error");
      setMessage("An error occurred during verification");
    }
  }

  async function resendVerification() {
    if (!email) return;

    setStatus("loading");
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage("Verification email sent! Please check your inbox.");
        setStatus("pending");
      } else {
        setStatus("error");
        setMessage(result.error || "Failed to resend verification email");
      }
    } catch {
      setStatus("error");
      setMessage("An error occurred");
    }
  }

  if (status === "loading") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-center">Verifying your email...</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  if (status === "success") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-center text-green-600">Email Verified!</CardTitle>
          <CardDescription className="text-center">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-gray-500">
          Redirecting to login...
        </CardContent>
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-center text-red-600">Verification Failed</CardTitle>
          <CardDescription className="text-center">
            {message}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center">
          <Link href="/login">
            <Button>Back to Login</Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  // Pending state - waiting for user to check email
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">Check your email</CardTitle>
        <CardDescription className="text-center">
          We&apos;ve sent a verification link to{" "}
          <span className="font-medium">{email}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <p className="text-sm text-center text-green-600">{message}</p>
        )}
        <p className="text-sm text-center text-gray-500">
          Click the link in your email to verify your account. If you don&apos;t see it, check your spam folder.
        </p>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <Button
          variant="outline"
          className="w-full"
          onClick={resendVerification}
          disabled={!email}
        >
          Resend verification email
        </Button>
        <Link href="/login" className="w-full">
          <Button variant="ghost" className="w-full">
            Back to Login
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <Card>
        <CardHeader>
          <CardTitle className="text-center">Loading...</CardTitle>
        </CardHeader>
      </Card>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
