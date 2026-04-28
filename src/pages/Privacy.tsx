import LegalPage from "@/components/LegalPage";
import { PRIVACY_POLICY } from "@/content/legal";

export default function Privacy() {
  return <LegalPage title="Privacy Policy" markdown={PRIVACY_POLICY} />;
}
