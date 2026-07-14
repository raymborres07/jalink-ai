import { createFileRoute } from "@tanstack/react-router";
import { MemoryDemo } from "@/components/synapse/MemoryDemo";

export const Route = createFileRoute("/memory")({
  component: MemoryPage,
});

function MemoryPage() {
  return <MemoryDemo />;
}
