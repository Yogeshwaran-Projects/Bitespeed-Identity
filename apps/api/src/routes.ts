
import { Router, type Request, type Response } from "express";
import { identify } from "./services/identify.js";
import { z } from "zod";

const router = Router();

const IdentifySchema = z.object({
  email: z.string().email().optional().nullable(),
  phoneNumber: z.union([z.string(), z.number()]).optional().nullable(),
});

router.post("/identify", async (req: Request, res: Response) => {
  try {
    const parsed = IdentifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { email, phoneNumber } = parsed.data;
    const payload = {
      email: email ?? null,
      phoneNumber: phoneNumber != null ? String(phoneNumber) : null,
    };

    const response = await identify(payload);
    return res.status(200).json(response);
  } catch (err) {
    console.error("/identify error", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
