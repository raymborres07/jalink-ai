import { createFileRoute } from "@tanstack/react-router";
import { AgentsOverviewDemo } from "@/components/synapse/AgentsOverviewDemo";

export const Route = createFileRoute("/agents")({
  component: AgentsPage,
});

function AgentsPage() {
  return <AgentsOverviewDemo />;
}
