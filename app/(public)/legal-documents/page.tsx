import type { Metadata } from "next";
import { PolicyIndex } from "@/components/PolicyDocumentView";

export const metadata: Metadata = {
  title: "Legal Documents · Venturo",
};

export default function LegalDocumentsPage() {
  return <PolicyIndex eyebrow="Here To Help" title="Legal Documents" />;
}
