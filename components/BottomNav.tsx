"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, Home, MessageCircle, Radio, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/briefing", label: "Briefing", icon: Radio },
  { href: "/concierge", label: "Concierge", icon: MessageCircle },
  { href: "/outputs", label: "Outputs", icon: Archive },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-950/[0.88] px-2 py-2 backdrop-blur-2xl lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "focus-ring flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[11px] font-medium text-mist-500 transition",
                active
                  ? "bg-white/[0.08] text-mist-50 shadow-inner shadow-white/5"
                  : "hover:bg-white/[0.05] hover:text-mist-100",
              )}
              href={item.href}
              key={item.href}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.9} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
