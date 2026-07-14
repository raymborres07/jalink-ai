import { createFileRoute } from "@tanstack/react-router";
import { AnalyticsDemo } from "@/components/synapse/AnalyticsDemo";

export const Route = createFileRoute("/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  return <AnalyticsDemo />;
}
