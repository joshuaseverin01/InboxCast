import { ShieldCheck } from "lucide-react";

export function PrivatePrototypeNotice() {
  return (
    <section className="surface-card rounded-[1.75rem] p-4 sm:p-5">
      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-300/[0.12] text-teal-300">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-mist-50">Private beta prototype</h2>
          <p className="mt-1 text-sm leading-6 text-mist-500">
            InboxCast is currently configured for trusted private testing. Review AI outputs before acting; InboxCast
            creates Gmail drafts only after confirmation, never sends email automatically, and reads full email or
            thread content only after explicit approval.
          </p>
        </div>
      </div>
    </section>
  );
}
