import type { Metadata } from "next";
import refunds from "@/content/policies/refunds.json";
import { PolicyDocumentView, type PolicyDocument } from "@/components/PolicyDocumentView";

export const metadata: Metadata = {
  title: "Refunds & Cancellation · Venturo",
};

export default function RefundsPage() {
  return <PolicyDocumentView policy={refunds as PolicyDocument} />;
}
