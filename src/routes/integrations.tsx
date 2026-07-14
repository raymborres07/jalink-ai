import { createFileRoute } from "@tanstack/react-router";
import { IntegrationsDemo } from "@/components/synapse/IntegrationsDemo";

export const Route = createFileRoute("/integrations")({
  component: IntegrationsPage,
});

function IntegrationsPage() {
  return <IntegrationsDemo />;
}
