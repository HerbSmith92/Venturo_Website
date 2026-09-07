import { EVENT_HOST } from "@/lib/portal";
import { redirect } from "next/navigation";

export default function CreateEventPage() {
  redirect(EVENT_HOST);
}
