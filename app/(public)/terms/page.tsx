import type { Metadata } from "next";
import terms from "@/content/policies/terms.json";
import { PolicyDocumentView, type PolicyDocument } from "@/components/PolicyDocumentView";

export const metadata: Metadata = {
  title: "Terms & Conditions · Venturo",
};

export default function TermsPage() {
  return <PolicyDocumentView policy={terms as PolicyDocument} />;
}
