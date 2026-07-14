import { createFileRoute } from "@tanstack/react-router";
import { GovernanceDemo } from "@/components/synapse/GovernanceDemo";

export const Route = createFileRoute("/governance")({
  component: GovernancePage,
});

function GovernancePage() {
  return <GovernanceDemo />;
}
