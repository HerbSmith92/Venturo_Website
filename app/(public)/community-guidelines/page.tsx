import type { Metadata } from "next";
import guidelines from "@/content/policies/community-guidelines.json";
import { PolicyDocumentView, type PolicyDocument } from "@/components/PolicyDocumentView";

export const metadata: Metadata = {
  title: "Community Guidelines · Venturo",
};

export default function CommunityGuidelinesPage() {
  return <PolicyDocumentView policy={guidelines as PolicyDocument} />;
}
