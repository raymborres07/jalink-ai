import { createFileRoute } from "@tanstack/react-router";
import { LegalDemo } from "@/components/synapse/LegalDemo";

export const Route = createFileRoute("/legal")({
  component: LegalPage,
});

function LegalPage() {
  return <LegalDemo />;
}
