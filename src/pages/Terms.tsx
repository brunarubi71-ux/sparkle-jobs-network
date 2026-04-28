import LegalPage from "@/components/LegalPage";
import { TERMS_OF_SERVICE } from "@/content/legal";

export default function Terms() {
  return <LegalPage title="Terms of Service" markdown={TERMS_OF_SERVICE} />;
}
