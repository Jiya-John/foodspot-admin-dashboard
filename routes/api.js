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
    const updates = {
      fullName: req.body.fullName,
      username: req.body.username,
      city: req.body.city,
      phone: req.body.phone,
      updatedAt: new Date(),
    }

    await db.collection("users").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updates }
    );

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

  // GET all posts with search + pagination
  router.get("/posts", async (req, res) => {
    try {
      const skip = parseInt(req.query.skip) || 0;
      const limit = parseInt(req.query.limit) || 8;
      const q = req.query.q?.trim() || "";

      const filter = q
        ? {
            $or: [
              { restaurantName: { $regex: q, $options: "i" } },
              { restaurantCity: { $regex: q, $options: "i" } },
              { dishName: { $regex: q, $options: "i" } },
            ],
          }
        : {};

      const posts = await db
        .collection("posts")
        .find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .toArray();

      res.json(posts);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
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
