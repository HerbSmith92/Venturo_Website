import type { Metadata } from "next";
import copyright from "@/content/policies/copyright.json";
import { PolicyDocumentView, type PolicyDocument } from "@/components/PolicyDocumentView";

export const metadata: Metadata = {
  title: "Copyright & Intellectual Property · Venturo",
};

export default function CopyrightPage() {
  return <PolicyDocumentView policy={copyright as PolicyDocument} />;
}
