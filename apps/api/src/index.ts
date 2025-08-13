
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import router from "./routes.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") ?? "*",
  })
);

app.get("/health", (_req: any, res: { json: (arg0: { ok: boolean; }) => any; }) => res.json({ ok: true }));
app.use("/", router);

const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`API listening on :${port}`));