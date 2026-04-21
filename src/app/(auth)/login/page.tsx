import { getSetting } from "@/lib/settings";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const registrationOpen = (await getSetting("registrationOpen")) === "true";

  return <LoginForm registrationOpen={registrationOpen} />;
}
