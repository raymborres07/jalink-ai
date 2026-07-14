import { createFileRoute } from "@tanstack/react-router";
import { SalesDemo } from "@/components/synapse/SalesDemo";

export const Route = createFileRoute("/sales")({
  component: SalesPage,
});

function SalesPage() {
  return <SalesDemo />;
}
