# Architecture and Implementation Decisions

This document records the architecture and implementation decisions made while building the Hotel Offer Orchestrator.

## 1. Use Node.js with TypeScript

**Decision:** Build the service with Node.js and TypeScript.

**Reason:**
- It matches the assessment requirements.
- TypeScript provides compile-time type checking and clearer data contracts.
- Async operations such as supplier calls, Temporal workflows, and Redis operations are well supported.

**Alternative considered:** Plain JavaScript. It was rejected because explicit types improve reliability for hotel records and API boundaries.

## 2. Use Express for the HTTP API

**Decision:** Use Express to expose the health, supplier, and orchestration endpoints.

**Reason:**
- Express is lightweight and directly matches the assessment stack.
- It provides simple route and middleware handling.
- It supports the health and mock supplier endpoints used during development.

**Alternative considered:** A framework such as NestJS. It was rejected as unnecessarily complex for this project's scope.

## 3. Use ES2022 and CommonJS-compatible Node module settings

**Decision:** Compile with TypeScript target `ES2022`, module `Node16`, and module resolution `Node16`.

**Reason:**
- The project uses Node.js packages and CommonJS-oriented imports.
- `Node16` module behavior works with the installed TypeScript and Node package configuration.
- It avoids deprecated `node10` module resolution.

**Alternative considered:** ES modules. This was deferred until the project structure and dependencies are fully standardized.

## 4. Enable strict TypeScript checking

**Decision:** Enable strict compiler checking and TypeScript compilation as a build step.

**Reason:**
- It detects missing values, incorrect types, and unsafe assumptions early.
- It makes hotel and supplier data contracts easier to maintain.
- It prevents implementation problems from only appearing at runtime.

**Alternative considered:** Relaxed JavaScript-like TypeScript settings. This was rejected because strict mode provides better project reliability.

## 5. Use environment configuration for server settings

**Decision:** Load configuration with `dotenv` and provide `.env.example`.

**Reason:**
- Deployment-specific values should not be written into source code.
- The server port can be changed without modifying implementation files.
- `.env.example` documents configuration without exposing real secrets.

**Default:** The API port is `3000` when `PORT` is not defined.

## 6. Enable CORS and JSON request parsing

**Decision:** Enable CORS middleware and Express JSON body parsing globally.

**Reason:**
- CORS allows browser-based or Postman clients to call the API when needed.
- JSON parsing prepares the server for future request bodies and API endpoints.

**Alternative considered:** Adding CORS only to selected routes. Global middleware is simpler for this small service.

## 7. Separate server, routes, controllers, suppliers, types, and future services

**Decision:** Use a folder structure containing `config`, `controllers`, `routes`, `services`, `suppliers`, `temporal`, `redis`, `types`, and `utils`.

**Reason:**
- It separates HTTP concerns from domain data and infrastructure.
- It makes later Temporal, Redis, and comparison additions easier to integrate.
- It keeps `src/server.ts` focused on application setup.

**Alternative considered:** Keeping all logic in `server.ts`. This was rejected because it would become difficult to maintain as the project grows.

## 8. Add a health endpoint

**Decision:** Provide `GET /health` and return a successful JSON status.

**Reason:**
- It provides a simple deployment and startup readiness check.
- It can later be expanded to report supplier, Redis, Temporal, and worker health.

**Response:**

```json
{
  "status": "ok"
}
```

## 9. Define an explicit supplier hotel type

**Decision:** Represent supplier records with a `SupplierHotel` interface containing `hotelId`, `name`, `price`, `city`, and `commissionPct`.

**Reason:**
- It establishes a consistent contract for mock suppliers and future Temporal activities.
- It prevents supplier response shapes from changing silently.
- It allows both supplier datasets to use the same logic.

**Location:** `src/types/hotel.ts`

## 10. Implement separate mock supplier endpoints

**Decision:** Expose:
- `GET /supplierA/hotels`
- `GET /supplierB/hotels`

**Reason:**
- It directly satisfies the assessment requirements.
- Independent endpoints allow the supplier behavior to be tested separately.
- The endpoints can later be called by separate Temporal activities.

## 11. Require city in mock supplier requests

**Decision:** Reject supplier requests that omit or provide an empty `city` query parameter with HTTP 400.

**Reason:**
- Supplier searches are city-specific.
- Clear validation prevents accidental requests that could return the wrong dataset.

**Response example:**

```json
{
  "error": "city query parameter is required"
}
```

**Alternative considered:** Returning all hotels. This was rejected because it does not represent city-based supplier behavior.

## 12. Perform city matching case-insensitively

**Decision:** Trim and lowercase the requested city before comparing it with hotel cities.

**Reason:**
- It makes requests such case-tolerant while preserving the underlying city value in records.
- It prevents harmless casing differences from producing empty results.

## 13. Return an empty array for unsupported cities

**Decision:** Return HTTP 200 with `[]` when the city is valid but no supplier records exist.

**Reason:**
- A supported API request with no matching inventory is a valid no-result response.
- It is easier for clients to handle a JSON array consistently.
- Missing-city validation remains HTTP 400 because the request itself is incomplete.

**Alternative considered:** Returning HTTP 404. The project treats no inventory as an empty successful search rather than an unknown endpoint.

## 14. Keep supplier data deterministic

**Decision:** Generate mock supplier data deterministically instead of using random values.

**Reason:**
- Predictable prices and IDs make testing reliable.
- Postman and future unit tests can reuse known behavior.
- It avoids changing comparison results between server restarts.

**Trade-off:** The data is static or deterministically generated rather than genuinely random.

## 15. Use shared and supplier-exclusive hotel groups

**Decision:** Generate both shared hotel names and names that exist only in Supplier A or Supplier B.

**Reason:**
- It provides overlap scenarios for price comparison testing.
- Supplier-exclusive hotels ensure deduplication logic does not discard valid inventory.
- It supports city-specific mock data across all supported cities.

## 16. Give Supplier B a lower default offset

**Decision:** Generate Supplier B base prices with a negative offset relative to Supplier A.

**Reason:**
- It produces meaningful overlapping results where lower offers are distributed across suppliers.
- It allows visual and functional comparison testing without custom test fixtures.

**Future rule:** Final cheapest-offer selection will be performed by the comparison service, not by relying on this offset.

## 17. Normalize hotel names for grouping

**Decision:** Trim whitespace, collapse repeated whitespace, and compare names case-insensitively.

**Reason:**
- Supplier records may use inconsistent casing or spacing.
- Normalization prevents duplicate names from surviving as separate hotels.
- The display name from the selected winning record is preserved for the response.

## 18. Resolve equal prices deterministically

**Decision:** For an equal price across suppliers, select Supplier A; for duplicate offers within Supplier A or Supplier B, use the lowest `hotelId` as the final tie-breaker.

**Reason:**
- Equal-price outcomes must not depend on array order.
- Supplier A preference provides a stable, documented cross-supplier rule.
- Hotel ID tie-breaking makes duplicate handling deterministic within a supplier.

**Alternative considered:** Preferring the first matching record. It was rejected because input ordering may change.

## 19. Use a large synthetic supplier dataset

**Decision:** Generate hundreds of hotel records across eight cities.

**Reason:**
- Larger datasets better exercise sorting, filtering, Redis indexing, and API payload behavior.
- Shared data generation keeps both supplier datasets maintainable.
- It provides volume for future price-range and performance testing.

**Dataset scale:** 416 records per supplier across Delhi, Mumbai, Goa, Bangalore, Jaipur, Chennai, Kolkata, and Hyderabad.

**Trade-off:** Data is generated in memory and does not yet represent a database or external supplier.

## 20. Keep external operations for later Temporal activities

**Decision:** HTTP calls and Redis operations will be implemented inside Temporal activities, not workflow code.

**Reason:**
- Temporal workflows must remain deterministic.
- Supplier HTTP calls and Redis writes are external side effects.
- Activities provide a clear retry and isolation boundary.

**Alternative considered:** Calling suppliers directly from workflow code. This was rejected because workflow code would become non-deterministic.

## 21. Resolve supplier failures explicitly

**Decision:** The final workflow will fail explicitly if Supplier A or Supplier B is unavailable.

**Reason:**
- The assessment does not define partial-result semantics.
- Returning an incomplete hotel list could hide a supplier outage.
- An explicit failure is safer and easier to diagnose than silently substituting partial data.

**Future option:** Partial-result handling may be added only after the primary behavior is established.

## 22. Use Docker Compose for complete deployment

**Decision:** Deploy the API, Temporal server, worker, and Redis through Docker Compose.

**Reason:**
- It provides one reproducible startup command.
- Each infrastructure component can run in an isolated container.
- It matches the assessment's containerization requirement.

**Alternative considered:** Running Redis and Temporal manually. This was deferred because Compose is a better submission experience.

## 23. Execute Supplier calls and Redis writes in Temporal activities

**Decision:** Keep supplier HTTP requests and Redis persistence inside Temporal activities.

**Reason:**
- Temporal workflows must remain deterministic.
- HTTP and Redis operations are external side effects.
- Activities allow retries and isolated failure handling.

**Implementation:** `fetchSupplierA`, `fetchSupplierB`, and `saveHotelsToRedis` are registered as Temporal activities.

## 24. Run supplier activities in parallel

**Decision:** Execute both supplier activities with `Promise.all` inside the hotel workflow.

**Reason:**
- Supplier requests are independent.
- Parallel execution reduces end-to-end workflow latency.
- If either supplier fails, the workflow fails instead of silently returning partial inventory.

## 25. Expose workflow execution through an Express controller

**Decision:** `GET /api/hotels` creates a unique Temporal workflow execution and waits for its result.

**Reason:**
- It keeps the HTTP API separate from supplier and Redis infrastructure.
- Temporal owns workflow execution and retries.
- Each city workflow receives a unique workflow ID for traceability.

**Workflow IDs:** `hotel-offers-{city}-{timestamp}`

## 26. Retain Redis persistence for Temporal orchestration

**Decision:** Store the consolidated hotel result under `hotel-offers:{city}` in Redis during the workflow.

**Reason:**
- It provides a city-specific consolidated cache.
- It establishes Redis persistence before the final sorted-set and hash implementation in Phase 5.
- Redis failures make the workflow fail explicitly instead of returning an unpersisted result.

## 27. Use Redis sorted sets and hashes for price filtering

**Decision:** Store each city's hotel names in a Redis sorted set scored by price, and store full hotel records in a Redis hash.

**Reason:**
- `ZRANGEBYSCORE` performs price filtering inside Redis.
- Hashes preserve the complete response data without duplicating it in the sorted-set index.
- A city-specific key isolates inventory between searches.

**Keys:**
- `hotel-offers:{city}:prices`
- `hotel-offers:{city}:details`

## 28. Delete city indexes before refreshing them

**Decision:** Delete the previous city sorted set, hash, and legacy JSON key before writing fresh consolidated records.

**Reason:**
- Removed or changed supplier offers must not remain in Redis.
- Refreshes produce a complete snapshot rather than merging stale records.
- The legacy key cleanup prevents old Phase 4 data from being mistaken for current storage.

## 29. Use one multi-stage Docker image for API and worker

**Decision:** Build TypeScript once in a builder stage and run both the API and Temporal worker from the same production image.

**Reason:**
- The API and worker share the same source, dependencies, and compiled output.
- A multi-stage build keeps build tooling out of the runtime image.
- One image prevents API and worker code from drifting apart.

## 30. Use Docker Compose service names for internal networking

**Decision:** Containers connect using `api`, `temporal`, and `redis` hostnames rather than localhost.

**Reason:**
- `localhost` inside a container refers to that same container.
- Compose service names provide stable internal DNS names.
- This allows the worker to call the API and Redis without host-specific configuration.

## 31. Persist Redis data with a named volume

**Decision:** Enable Redis append-only persistence and mount the `redis-data` named volume.

**Reason:**
- Redis data survives normal Compose restarts.
- Append-only persistence reduces data loss between restarts.
- The volume keeps infrastructure state separate from the application image.
