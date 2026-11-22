import cors from "cors";
import express from "express";
import supplierRoutes from "./routes/supplierRoutes";
import hotelRoutes from "./routes/hotelRoutes";
import { getHealth } from "./controllers/healthController";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", getHealth);

app.use(supplierRoutes);
app.use(hotelRoutes);

export default app;
