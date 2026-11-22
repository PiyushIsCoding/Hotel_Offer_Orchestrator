import cors from "cors";
import express from "express";
import supplierRoutes from "./routes/supplierRoutes";
import hotelRoutes from "./routes/hotelRoutes";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok"
  });
});

app.use(supplierRoutes);
app.use(hotelRoutes);

export default app;
