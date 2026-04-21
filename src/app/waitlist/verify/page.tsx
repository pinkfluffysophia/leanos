"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

function VerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "already" | "error">("loading");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    fetch(`/api/waitlist/verify?token=${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setStatus("error");
        } else if (data.message === "Email already verified") {
          setStatus("already");
        } else {
          setStatus("success");
        }
      })
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <>
      {status === "loading" && (
        <>
          <Loader2 className="h-12 w-12 text-muted-foreground animate-spin mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Verifying your email...</h1>
        </>
      )}
      {status === "success" && (
        <>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 mb-4">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Email Verified!</h1>
          <p className="text-muted-foreground mt-2">
            Your email has been verified. You&apos;re all set.
          </p>
        </>
      )}
      {status === "already" && (
        <>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 mb-4">
            <CheckCircle className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Already Verified</h1>
          <p className="text-muted-foreground mt-2">
            Your email was already verified. No action needed.
          </p>
        </>
      )}
      {status === "error" && (
        <>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900 mb-4">
            <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Verification Failed</h1>
          <p className="text-muted-foreground mt-2">
            This link is invalid or has already been used.
          </p>
        </>
      )}
    </>
  );
}

export default function WaitlistVerifyPage() {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-gray-950 flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center text-center py-12 px-6">
          <Suspense fallback={
            <>
              <Loader2 className="h-12 w-12 text-muted-foreground animate-spin mb-4" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Verifying your email...</h1>
            </>
          }>
            <VerifyContent />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
