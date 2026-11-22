import { Client, Connection } from "@temporalio/client";
import { ConsolidatedHotel, HotelWorkflowInput } from "../types/hotel";

export async function startHotelOfferWorkflow(
  input: HotelWorkflowInput
): Promise<ConsolidatedHotel[]> {
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS ?? "127.0.0.1:7233"
  });

  const client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE ?? "default"
  });

  try {
    const taskQueue = process.env.TEMPORAL_TASK_QUEUE ?? "hotel-offers";
    const normalizedCity = input.city.trim().toLowerCase();
    const handle = await client.workflow.start("hotelOfferWorkflow", {
      taskQueue,
      workflowId: `hotel-offers-${normalizedCity}-${Date.now()}`,
      workflowExecutionTimeout: "60 seconds",
      args: [{ ...input, city: normalizedCity }]
    });

    return await handle.result();
  } finally {
    await connection.close();
  }
}
