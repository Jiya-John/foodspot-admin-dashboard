import express from "express";
import { ObjectId } from "mongodb";
import {
  getUsers,
  getSingleUser,
  addUser,
  editUser,
  deleteUser,
} from "../db/users.js";

import {
  getPosts,
  getSinglePost,
  addPost,
  editPost,
  deletePost,
} from "../db/posts.js";

export default function adminRoutes(db, upload) {
  const router = express.Router();

  // Middleware
  function requireAdmin(req, res, next) {
    if (req.session.isAdmin) return next();
    res.redirect("/admin/login");
  }

  // Admin Login Page
  router.get("/login", (req, res) => {
    res.render("admin/login", { title: "Admin Login", hideHeader: true });
  });

  // Login Submit
  router.post("/login", (req, res) => {
    const { username, password } = req.body;
    if (
      username === process.env.ADMIN_USER &&
      password === process.env.ADMIN_PASS
    ) {
      req.session.isAdmin = true;
      return res.redirect("/admin");
    }
    res.render("admin/login", {
      title: "Admin Login",
      error: "Invalid username or password",
      hideHeader: true,
    });
  });

  // Logout
  router.get("/logout", (req, res) => {
    req.session.destroy(() => {
      res.redirect("/admin/login");
    });
  });

  // Dashboard
  router.get("/", requireAdmin, async (req, res) => {
    const userCount = await db.collection("users").countDocuments();
    const postCount = await db.collection("posts").countDocuments();
    res.render("admin/dashboard", { title: "Dashboard", userCount, postCount });
  });

  // API Endpoints Page
  router.get("/api", requireAdmin, (req, res) => {
    res.render("admin/api", { title: "API Endpoints" });
  });

  // USERS ADMIN
  router.get("/users", requireAdmin, async (req, res) => {
    const users = await getUsers(db);
    res.render("admin/users/list", { title: "Manage Users", users });
  });

  router.get("/users/add", requireAdmin, (req, res) => {
    res.render("admin/users/form", {
      title: "Add User",
      user: {},
      formAction: "/admin/users/add",
    });
  });

  router.post("/users/add", requireAdmin, async (req, res) => {
    const { fullName, username, email, city, password } = req.body;

    if (!fullName || !username || !email || !city || !password) {
      return res.render("admin/users/form", {
        title: "Add User",
        error: "All fields are required.",
        formAction: "/admin/users/add",
        user: req.body,
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.render("admin/users/form", {
        title: "Add User",
        error: "Please enter a valid email address.",
        formAction: "/admin/users/add",
        user: req.body,
      });
    }

    const existingEmail = await db.collection("users").findOne({ email });
    if (existingEmail) {
      return res.render("admin/users/form", {
        title: "Add User",
        error: "This email is already registered.",
        formAction: "/admin/users/add",
        user: req.body,
      });
    }

    const existingUsername = await db.collection("users").findOne({ username });
    if (existingUsername) {
      return res.render("admin/users/form", {
        title: "Add User",
        error: "This username is already taken.",
        formAction: "/admin/users/add",
        user: req.body,
      });
    }

    await addUser(db, req.body);
    res.redirect("/admin/users");
  });

  router.get("/users/edit", requireAdmin, async (req, res) => {
    if (!req.query.id) return res.redirect("/admin/users");
    const user = await getSingleUser(db, req.query.id);
    res.render("admin/users/form", {
      title: "Edit User",
      user,
      formAction: "/admin/users/edit",
    });
  });

  router.post("/users/edit", requireAdmin, async (req, res) => {
    await editUser(db, req.body.id, req.body);
    res.redirect("/admin/users");
  });

  router.get("/users/delete", requireAdmin, async (req, res) => {
    if (req.query.id) await deleteUser(db, req.query.id);
    res.redirect("/admin/users");
  });

  // POSTS ADMIN
  router.get("/posts", requireAdmin, async (req, res) => {
    const posts = await getPosts(db);
    const users = await getUsers(db);
    res.render("admin/posts/list", { title: "Manage Posts", posts, users });
  });

  router.get("/posts/add", requireAdmin, async (req, res) => {
    const users = await getUsers(db);
    res.render("admin/posts/form", {
      title: "Add Post",
      post: {},
      users,
      formAction: "/admin/posts/add",
    });
  });

  router.post(
    "/posts/add",
    requireAdmin,
    upload.single("photo"),
    async (req, res) => {
      const { restaurantName, restaurantCity } = req.body;

      if (!req.file || !restaurantName || !restaurantCity) {
        return res.render("admin/posts/form", {
          title: "Add Post",
          error: "Photo, restaurant name, and city are required.",
          formAction: "/admin/posts/add",
          post: req.body,
          users: await getUsers(db),
        });
      }

      await addPost(db, req.body, req.file);
      res.redirect("/admin/posts");
    }
  );

  router.get("/posts/edit", requireAdmin, async (req, res) => {
    if (!req.query.id) return res.redirect("/admin/posts");
    const post = await getSinglePost(db, req.query.id);
    const users = await getUsers(db);
    res.render("admin/posts/form", {
      title: "Edit Post",
      post,
      users,
      formAction: "/admin/posts/edit",
    });
  });

  router.post(
    "/posts/edit",
    requireAdmin,
    upload.single("photo"),
    async (req, res) => {
      await editPost(db, req.body.id, req.body, req.file);
      res.redirect("/admin/posts");
    }
  );

  router.get("/posts/delete", requireAdmin, async (req, res) => {
    if (req.query.id) await deletePost(db, req.query.id);
    res.redirect("/admin/posts");
  });

  return router;
}
