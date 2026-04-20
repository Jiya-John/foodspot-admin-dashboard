// index.js
import express from "express";
import path from "path";
import session from "express-session";
import multer from "multer";
import dotenv from "dotenv";
import dns from "node:dns/promises"; 
dns.setServers(["1.1.1.1"]);

import { MongoClient } from "mongodb";
import adminRoutes from "./routes/admin.js";
import apiRoutes from "./routes/api.js";
import cors from "cors";

dotenv.config();

const __dirname = import.meta.dirname;

// MongoDB connection
const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db(process.env.MONGODB_DBNAME);

// Express setup
const app = express();
app.use(cors());
const port = process.env.PORT || "8888";

// Template engine
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

// Static folder
app.use(express.static(path.join(__dirname, "public")));

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Sessions (admin login)
app.use(
  session({
    secret: "foodspot-secret-key",
    resave: false,
    saveUninitialized: false,
  })
);

// Multer (photo uploads)
const upload = multer({ storage: multer.memoryStorage() });

// Mount routes
app.use("/admin", adminRoutes(db, upload));
app.use("/api", apiRoutes(db, upload));

// Landing page
app.get("/", (req, res) => {
  res.render("admin/landing", { title: "Welcome", hideHeader: true });
});

// Start server
app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});

