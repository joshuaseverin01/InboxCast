import type { Metadata } from "next";
import { DemoExperience } from "@/components/DemoExperience";

export const metadata: Metadata = {
  title: "InboxCast Demo",
  description: "A safe public demo of InboxCast using fictional inbox and calendar data.",
};

export default function DemoPage() {
  return <DemoExperience />;
}
