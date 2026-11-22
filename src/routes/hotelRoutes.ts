import { Router } from "express";
import { getHotels } from "../controllers/hotelController";

const router = Router();

router.get("/api/hotels", getHotels);

export default router;
