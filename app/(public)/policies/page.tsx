import type { Metadata } from "next";
import { PolicyIndex } from "@/components/PolicyDocumentView";

export const metadata: Metadata = {
  title: "Policies · Venturo",
};

export default function PoliciesPage() {
  return <PolicyIndex />;
}
