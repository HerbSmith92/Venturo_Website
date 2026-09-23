import type { Metadata } from "next";
import privacy from "@/content/policies/privacy.json";
import { PolicyDocumentView, type PolicyDocument } from "@/components/PolicyDocumentView";

export const metadata: Metadata = {
  title: "Privacy Policy · Venturo",
};

export default function PrivacyPolicyPage() {
  return <PolicyDocumentView policy={privacy as PolicyDocument} />;
}
