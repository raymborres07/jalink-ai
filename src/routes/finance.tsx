import { createFileRoute } from "@tanstack/react-router";
import { FinanceDemo } from "@/components/synapse/FinanceDemo";

export const Route = createFileRoute("/finance")({
  component: FinancePage,
});

function FinancePage() {
  return <FinanceDemo />;
}
