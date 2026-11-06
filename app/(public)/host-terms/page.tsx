import type { Metadata } from "next";
import hostTerms from "@/content/policies/host-terms.json";
import { PolicyDocumentView, type PolicyDocument } from "@/components/PolicyDocumentView";

export const metadata: Metadata = {
  title: "Host Terms Agreement · Venturo",
};

export default function HostTermsPage() {
  return <PolicyDocumentView policy={hostTerms as PolicyDocument} />;
}
