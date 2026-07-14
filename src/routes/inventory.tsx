import { createFileRoute } from "@tanstack/react-router";
import { InventoryDemo } from "@/components/synapse/InventoryDemo";

export const Route = createFileRoute("/inventory")({
  component: InventoryPage,
});

function InventoryPage() {
  return <InventoryDemo />;
}
