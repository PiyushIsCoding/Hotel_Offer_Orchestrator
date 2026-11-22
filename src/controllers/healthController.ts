import { Request, Response } from "express";
import Redis from "ioredis";
import { Connection } from "@temporalio/client";

type CheckStatus = "ok" | "failed" | "not_checked";

interface HealthChecks {
  api: CheckStatus;
  redis: CheckStatus;
  temporal: CheckStatus;
  supplierA: CheckStatus;
  supplierB: CheckStatus;
}

async function checkSupplier(path: string): Promise<CheckStatus> {
  const baseUrl = process.env.SUPPLIERS_BASE_URL ?? "http://127.0.0.1:3000";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1000);

  try {
    const response = await fetch(
      `${baseUrl}${path}?city=delhi`,
      { signal: controller.signal }
    );
    return response.ok ? "ok" : "failed";
  } catch {
    return "failed";
  } finally {
    clearTimeout(timeout);
  }
}

async function checkRedis(): Promise<CheckStatus> {
  const redis = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");
  try {
    await redis.ping();
    return "ok";
  } catch {
    return "failed";
  } finally {
    await redis.quit();
  }
}

async function checkTemporal(): Promise<CheckStatus> {
  try {
    const connection = await Connection.connect({
      address: process.env.TEMPORAL_ADDRESS ?? "127.0.0.1:7233"
    });
    await connection.close();
    return "ok";
  } catch {
    return "failed";
  }
}

export async function getHealth(_req: Request, res: Response): Promise<void> {
  const checks: HealthChecks = {
    api: "ok",
    redis: "not_checked",
    temporal: "not_checked",
    supplierA: "not_checked",
    supplierB: "not_checked"
  };

  if (process.env.HEALTHCHECK_DEPENDENCIES !== "true") {
    res.status(200).json({ status: "ok", checks });
    return;
  }

  const [redis, temporal, supplierA, supplierB] = await Promise.all([
    checkRedis(),
    checkTemporal(),
    checkSupplier("/supplierA/hotels"),
    checkSupplier("/supplierB/hotels")
  ]);
  checks.redis = redis;
  checks.temporal = temporal;
  checks.supplierA = supplierA;
  checks.supplierB = supplierB;

  const healthy = Object.values(checks).every((status) => status === "ok");
  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    checks
  });
}
