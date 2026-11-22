import { createHash } from "node:crypto";
import {
  Client,
  Connection,
  WorkflowExecutionAlreadyStartedError
} from "@temporalio/client";
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
    const context = JSON.stringify({
      city: normalizedCity,
      checkIn: input.checkIn ?? null,
      checkOut: input.checkOut ?? null
    });
    const contextHash = createHash("sha256")
      .update(context)
      .digest("hex")
      .slice(0, 16);
    const workflowId = input.refresh
      ? `hotel-offers-${contextHash}-${Date.now()}`
      : `hotel-offers-${contextHash}`;

    let handle;
    try {
      handle = await client.workflow.start("hotelOfferWorkflow", {
        taskQueue,
        workflowId,
        workflowExecutionTimeout: "60 seconds",
        args: [{ ...input, city: normalizedCity }]
      });
    } catch (error) {
      if (!(error instanceof WorkflowExecutionAlreadyStartedError)) {
        throw error;
      }

      handle = client.workflow.getHandle("hotelOfferWorkflow", workflowId);
    }

    return await handle.result();
  } finally {
    await connection.close();
  }
}
