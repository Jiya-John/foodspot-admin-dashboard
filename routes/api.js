import express from "express";

import bcrypt from "bcrypt";
import { ObjectId } from "mongodb";
import {
  getUsers,
  getSingleUser,
  addUser,
  editUser,
} from "../db/users.js";

import {
  getPosts,
  getSinglePost,
  addPost,
  editPost,
} from "../db/posts.js";

export default function apiRoutes(db, upload) {
  const router = express.Router();

  // GET all users
  router.get("/users", async (req, res) => {
    res.json(await getUsers(db));
  });

  // GET single user
  router.get("/users/:id", async (req, res) => {
    res.json(await getSingleUser(db, req.params.id));
  });

  // UPDATE user
  router.put("/users/:id", async (req, res) => {
    await editUser(db, req.params.id, req.body);
    res.json(await getSingleUser(db, req.params.id));
  });

  // SIGNUP
  router.post("/signup", async (req, res) => {
    const { fullName, username, email, password, city } = req.body;

    //checking if existing user
    const existing = await db.collection("users").findOne({ email });
    if (existing) {
      return res.status(400).json({ error: "Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userDoc = {
      fullName,
      username,
      email,
      city,
      passwordHash: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("users").insertOne(userDoc);

    res.json({
      _id: result.insertedId,
      fullName,
      username,
      email,
      city,
    });
  });

  // LOGIN
  router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    const user = await db.collection("users").findOne({ email });
    if (!user) return res.status(400).json({ error: "Invalid email" });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(400).json({ error: "Invalid password" });

    res.json({
      _id: user._id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      city: user.city,
    });
  });

  // GET all posts
  router.get("/posts", async (req, res) => {
    res.json(await getPosts(db));
  });

  // GET single post
  router.get("/posts/:id", async (req, res) => {
    res.json(await getSinglePost(db, req.params.id));
  });

  // CREATE post
  router.post("/posts", upload.single("photo"), async (req, res) => {
    const result = await addPost(db, req.body, req.file);
    res.json({ success: true, id: result });
  });

  // UPDATE post
  router.put("/posts/:id", upload.single("photo"), async (req, res) => {
    await editPost(db, req.params.id, req.body, req.file);
    res.json({ success: true });
  });

  // Serve photo
  router.get("/posts/:id/photo", async (req, res) => {
    const post = await getSinglePost(db, req.params.id);
    res.set("Content-Type", post.photoType);
    res.send(post.photo.buffer);
  });

  return router;
}
