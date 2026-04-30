"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  CalendarCheck,
  Home,
  MailCheck,
  MessageCircle,
  Radio,
  Settings,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/briefing", label: "Briefing", icon: Radio },
  { href: "/concierge", label: "Concierge", icon: MessageCircle },
  { href: "/outputs", label: "Outputs", icon: Archive },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-white/10 bg-ink-950/[0.72] px-5 py-6 backdrop-blur-2xl lg:block">
      <Link className="focus-ring flex items-center gap-3 rounded-2xl p-2" href="/dashboard">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mist-50 text-ink-950 shadow-glow">
          <Radio className="h-5 w-5" />
        </div>
        <div>
          <div className="text-base font-semibold text-mist-50">InboxCast</div>
          <div className="text-xs text-mist-500">Personal morning briefings</div>
        </div>
      </Link>

      <nav className="mt-8 space-y-2">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "focus-ring flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition",
                active
                  ? "bg-white/[0.09] text-mist-50 shadow-inner shadow-white/5"
                  : "text-mist-500 hover:bg-white/[0.055] hover:text-mist-100",
              )}
              href={item.href}
              key={item.href}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="surface-card mt-8 rounded-[2rem] p-4">
        <div className="flex items-center gap-2 text-xs font-medium uppercase text-teal-300">
          <Sparkles className="h-4 w-4" />
          Private MVP
        </div>
        <p className="mt-3 text-sm leading-6 text-mist-300">
          Google context fetches run server-side with Gmail metadata and Calendar read-only access.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="quiet-card rounded-2xl p-3">
            <MailCheck className="h-4 w-4 text-teal-300" />
            <div className="mt-2 text-xs text-mist-300">No send scope</div>
          </div>
          <div className="quiet-card rounded-2xl p-3">
            <CalendarCheck className="h-4 w-4 text-violet-300" />
            <div className="mt-2 text-xs text-mist-300">Read-only calendar</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
