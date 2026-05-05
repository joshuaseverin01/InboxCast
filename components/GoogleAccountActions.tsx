import { LogIn, RefreshCcw, Unplug } from "lucide-react";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { hasGoogleOAuthCredentials } from "@/lib/googleAuth";
import { cn } from "@/lib/utils";

export function ConnectGoogleAccountButton({
  className,
  label = "Connect Google Account",
  reconnect = false,
}: {
  className?: string;
  label?: string;
  reconnect?: boolean;
}) {
  const configured = hasGoogleOAuthCredentials();

  return (
    <form
      action={async () => {
        "use server";

        if (!hasGoogleOAuthCredentials()) {
          redirect("/settings?connection=missing-config");
        }

        await signIn("google", { redirectTo: "/settings?connection=success" });
      }}
    >
      <button
        className={cn("primary-button w-full sm:w-auto", className)}
        disabled={!configured}
        type="submit"
      >
        {reconnect ? <RefreshCcw className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
        {configured ? label : "Google OAuth not configured"}
      </button>
    </form>
  );
}

export function DisconnectGoogleAccountButton({ className }: { className?: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/settings?connection=disconnected" });
      }}
    >
      <button className={cn("secondary-button w-full sm:w-auto", className)} type="submit">
        <Unplug className="h-4 w-4" />
        Disconnect local session
      </button>
    </form>
  );
}
