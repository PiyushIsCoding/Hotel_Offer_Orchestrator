export class SupplierValidationError extends Error {
  constructor(message: string) {
    super(`SUPPLIER_FAILURE: ${message}`);
    this.name = "SupplierValidationError";
  }
}

export class SupplierUnavailableError extends Error {
  constructor(message: string) {
    super(`SUPPLIER_FAILURE: ${message}`);
    this.name = "SupplierUnavailableError";
  }
}

export class RedisUnavailableError extends Error {
  constructor(message: string) {
    super(`REDIS_FAILURE: ${message}`);
    this.name = "RedisUnavailableError";
  }
}

export class RedisDataError extends Error {
  constructor(message: string) {
    super(`REDIS_FAILURE: ${message}`);
    this.name = "RedisDataError";
  }
}
