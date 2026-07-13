import { createFileRoute } from "@tanstack/react-router";
import { ReconciliationDemo } from "@/components/synapse/ReconciliationDemo";

export const Route = createFileRoute("/procure-to-pay")({
  component: ProcureToPay,
});

function ProcureToPay() {
  return <ReconciliationDemo />;
}
