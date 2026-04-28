import LegalPage from "@/components/LegalPage";
import { CANCELLATION_POLICY } from "@/content/legal";

export default function Cancellation() {
  return <LegalPage title="Cancellation & Refund Policy" markdown={CANCELLATION_POLICY} />;
}
