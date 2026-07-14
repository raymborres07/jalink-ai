import { createFileRoute } from "@tanstack/react-router";
import { HRDemo } from "@/components/synapse/HRDemo";

export const Route = createFileRoute("/hr")({
  component: HrPage,
});

function HrPage() {
  return <HRDemo />;
}
