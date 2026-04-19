// src/index.js
require("dotenv").config();
const express   = require("express");
const helmet    = require("helmet");
const cors      = require("cors");
const morgan    = require("morgan");
const rateLimit = require("express-rate-limit");

const { connect }    = require("./config/db");
const logger         = require("./utils/logger");
const { notFound, errorHandler } = require("./middleware/error");

const authRoutes       = require("./routes/auth");
const tokenRoutes      = require("./routes/tokens");
const projectRoutes    = require("./routes/projects");
const ticketRoutes     = require("./routes/tickets");
const userRoutes       = require("./routes/users");
const workspaceRoutes  = require("./routes/workspaces");
const epicRoutes       = require("./routes/epics");

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.set("trust proxy", 1);

const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000")
  .split(",").map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
   if (!origin || allowedOrigins.includes(origin) || origin.endsWith(".vercel.app")) 
    return cb(null, true);
  cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ["GET","POST","PATCH","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization","X-API-Key"],
}));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev", { stream: { write: msg => logger.http(msg.trim()) } }));

app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX)        || 300,
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
}));

app.get("/health", (_, res) =>
  res.json({ status: "ok", version: "2.0.0", uptime: process.uptime() })
);

const api = "/api/v1";
app.use(`${api}/auth`,       authRoutes);
app.use(`${api}/tokens`,     tokenRoutes);
app.use(`${api}/workspaces`, workspaceRoutes);
app.use(`${api}/projects`,   projectRoutes);
app.use(`${api}/`,           ticketRoutes);
app.use(`${api}/`,           epicRoutes);
app.use(`${api}/users`,      userRoutes);

app.use(notFound);
app.use(errorHandler);

const start = async () => {
  await connect();
  app.listen(PORT, "0.0.0.0", () => {
    logger.info(`🐞 BUGTRACKER v2 API → http://0.0.0.0:${PORT}${api}`);
    logger.info(`   Env: ${process.env.NODE_ENV || "development"}`);
    logger.info(`   DB : ${process.env.MONGODB_URI}`);
  });
};

start().catch(err => { logger.error("Failed to start:", err); process.exit(1); });
module.exports = app;
