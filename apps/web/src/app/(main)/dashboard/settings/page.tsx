import { permanentRedirect } from "next/navigation";

export default function SettingsIndexPage() {
  permanentRedirect("/dashboard/settings/security");
}
