import dotenv from "dotenv";
import path from "node:path";
import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities";

dotenv.config();

async function run(): Promise<void> {
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS ?? "127.0.0.1:7233",
  });

  const worker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE ?? "default",
    taskQueue: process.env.TEMPORAL_TASK_QUEUE ?? "hotel-offers",
    workflowsPath: path.join(__dirname, "workflows"),
    activities,
  });

  console.log(
    `Temporal worker started on task queue ${process.env.TEMPORAL_TASK_QUEUE ?? "hotel-offers"}`
  );
  await worker.run();
}

run().catch((error) => {
  console.error("Temporal worker failed:", error);
  process.exit(1);
});
