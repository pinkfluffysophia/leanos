import { Suspense } from "react";
import { getSetting } from "@/lib/settings";
import { SignupForm } from "./signup-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const registrationOpen = (await getSetting("registrationOpen")) === "true";

  if (!registrationOpen) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Registration Closed</CardTitle>
          <CardDescription className="text-center">
            New account registration is currently closed. Please check back later.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center">
          <Link href="/login">
            <Button variant="ghost">Back to Login</Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
