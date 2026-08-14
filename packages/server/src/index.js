import "dotenv/config";
import { createServer } from "node:http";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { attachMatchmaking } from "./matchmaking";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { friendsRouter } from "./routes/friends";
import { matchesRouter } from "./routes/matches";
import { walletRouter } from "./routes/wallet";
import { corsOptions } from "./config/cors";
import { logger, requestLoggerMiddleware } from "./utils/safeLogger";
const app = express();
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(requestLoggerMiddleware);
app.use("/api/auth", authRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/friends", friendsRouter);
app.use("/api/matches", matchesRouter);
app.use("/api/admin", adminRouter);
app.get("/", (_req, res) => {
    res.json({
        name: "ArcadeClash API Server",
        status: "online",
        health: `http://localhost:${port}/api/health`,
        endpoints: ["/api/auth", "/api/wallet", "/api/friends", "/api/matches"],
    });
});
app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
});
// Last-resort safety net — Express 5 forwards rejected async handler
// promises here automatically, so a DB hiccup returns a 500 instead of
// crashing the process (this is exactly what happened under Express 4
// during initial testing, before the upgrade).
const errorHandler = (err, _req, res, _next) => {
    logger.error("[server] unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);
const httpServer = createServer(app);
attachMatchmaking(httpServer);
const port = Number(process.env.PORT ?? 4000);
httpServer.listen(port, () => {
    console.log(`[server] listening on http://localhost:${port}`);
});
