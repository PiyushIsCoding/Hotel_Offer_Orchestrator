# Hotel Offer Orchestrator — tests for Phases 1 and 2

This bundle contains automated tests for the functionality reported as implemented:

- Phase 1: Express app and `GET /health`
- Phase 2: Supplier A/B endpoints, city validation, response shape, overlapping and supplier-exclusive hotel names

## 1. Install test dependencies

Run from your project root:

```powershell
npm install -D vitest supertest @types/supertest
```

## 2. Make the Express app importable

The tests import `../src/app`. If your current `src/server.ts` creates the Express app and calls `app.listen()` in the same file, split the app setup from the server startup:

- `src/app.ts`: create/configure Express, register `/health` and supplier routes, then `export default app`. Do not call `listen()` here.
- `src/server.ts`: load dotenv, import the app, and call `app.listen()`.

Example `src/server.ts`:

```ts
import dotenv from "dotenv";
import app from "./app";

dotenv.config();

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`Hotel Offer Orchestrator running on port ${port}`);
});
```

In `src/app.ts`, keep your existing supplier route import and route mounting. The final paths must remain:
- `/supplierA/hotels`
- `/supplierB/hotels`

The exact import path depends on the route structure Copilot created, so do not blindly replace your existing route registration.

## 3. Add scripts to `package.json`

Merge these into your existing `scripts` object; preserve the other entries:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:phase1": "vitest run tests/phase1.test.ts",
"test:phase2": "vitest run tests/phase2.test.ts"
```

## 4. Copy the `tests` folder

Copy this bundle's `tests` directory into the project root. It should sit alongside `src`, not inside it.

```text
Hotel Orchestrator/
├── src/
│   ├── app.ts
│   └── server.ts
├── tests/
│   ├── phase1.test.ts
│   └── phase2.test.ts
├── package.json
└── tsconfig.json
```

## 5. Run tests

```powershell
npm run test:phase1
npm run test:phase2
```

Run both together with:

```powershell
npm test
```

## Phase-specific tests

Run the tests for an individual phase:

```powershell
npm run test:phase1
npm run test:phase2
npm run test:phase3
npm run test:phase4
npm run test:phase5
npm run test:phase6
```

`test:phase5` requires Redis to be running at the `REDIS_URL` configured in
`.env`. Run all Phase 1–6 tests together with:

```powershell
npm run test:all
```

The suites cover validation failures, unsupported cities, supplier failures,
Temporal workflow failures, duplicate and tie handling, empty results,
malformed price filters, Redis price ranges, and stale-record refreshes.

## Docker Compose

Build and start the complete system:

```powershell
docker compose up --build
```

Before starting Compose, stop any locally running `npm run dev` and
`npm run worker` processes. A host-side worker using the same Temporal task
queue can receive a workflow intended for Compose but cannot resolve the
Compose-only hostnames such as `redis` and `api`.

The Compose stack starts:

- API: `http://localhost:3000`
- Temporal UI: `http://localhost:8233`
- Temporal gRPC: `localhost:7233`
- Redis: `localhost:6379` for local test execution

Test the containerized API:

```powershell
curl.exe "http://localhost:3000/api/hotels?city=delhi"
```

Optional stay-context parameters are supported and are included in Redis cache
keys:

```powershell
curl.exe "http://localhost:3000/api/hotels?city=delhi&checkIn=2026-12-01&checkOut=2026-12-05"
```

Requests use a valid Redis cache entry by default. Add `refresh=true` to force
both suppliers to be queried and replace the cached results:

```powershell
curl.exe "http://localhost:3000/api/hotels?city=delhi&refresh=true"
```

`refresh` accepts only `true` or `false`.

The public hotel response contains the assessment fields `name`, `price`,
`supplier`, and `commissionPct`. Alternate supplier offers remain available
internally for comparison and auditing but are not exposed by this endpoint.

When `HEALTHCHECK_DEPENDENCIES=true`, `/health` also checks Redis, Temporal, and
both supplier endpoints:

```powershell
curl.exe http://localhost:3000/health
```

Stop the stack while preserving the Redis volume:

```powershell
docker compose down
```

## Final submission checklist

- [ ] Source code and package configuration included
- [ ] `Dockerfile` included
- [ ] `docker-compose.yml` included
- [ ] `.dockerignore` included
- [ ] `.env.example` included; real `.env` excluded
- [ ] `README.md` included
- [ ] `decisions.md` included
- [ ] `Hotel-Offer-Orchestrator.postman_collection.json` included
- [ ] `npm run test:all` passes
- [ ] Docker Compose starts the API, worker, Temporal, and Redis services

## Test assumptions

- `/health` returns JSON containing `status: "ok"`.
- Missing `city` returns HTTP 400.
- A supported city returns HTTP 200 and an array with at least one hotel.
- An unsupported city returns HTTP 200 and an empty array.
- Each hotel contains `name`, `price`, and `commissionPct`.
- Delhi has at least one overlapping hotel name and at least one supplier-exclusive name.
- Hotel names are compared after trimming whitespace and ignoring case.

The tests deliberately avoid fixed hotel names, prices, IDs, and record counts. If your current health response uses a different status field/value, or the route wiring differs, align the tests/app adapter with your actual implementation rather than changing the business behavior just to make a test pass.
