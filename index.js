//IMPORT REQUIRED MODULES
import express from "express"; //import Express
import path from "path";
import { MongoClient, ObjectId } from "mongodb"; //import from mongodb driver
import bcrypt from "bcrypt"; 
import dotenv from "dotenv";
dotenv.config();
//Use Node’s DNS module and force all DNS lookups to use Cloudflare’s 1.1.1.1 server
import dns from "node:dns/promises"; 
dns.setServers(["1.1.1.1"]);
import session from "express-session";

import multer from "multer";
const upload = multer({ storage: multer.memoryStorage() });

const __dirname = import.meta.dirname;

// MONGODB CONNECTION 
const client = new MongoClient(process.env.MONGODB_URI); 
const db = client.db(process.env.MONGODB_DBNAME);

//set up Express app
const app = express(); 
const port = process.env.PORT || "8888";

//set up Express to use pug as the template engine 
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views")); 

//set up static folder for Express app
app.use(express.static(path.join(__dirname, "public")));

//Set Express to extend the URLencoded format and use JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// SESSION (for admin login) 
app.use( session({ 
    secret: "foodspot-secret-key", 
    resave: false, 
    saveUninitialized: false, 
}) );

//middleware
function requireAdmin(req, res, next) { 
    if (req.session.isAdmin) return next(); 
    res.redirect("/admin/login"); 
}

//PAGE ROUTES
app.get("/", (req, res) => {
  res.render("admin/landing", { title: "Welcome", hideHeader: true });
});


// Admin Login Page 
app.get("/admin/login", (req, res) => { 
    res.render("admin/login", { title: "Admin Login" , hideHeader: true}); 
});

// Login Submit 
app.post("/admin/login", (req, res) => { 
    const { username, password } = req.body; 
    if ( username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS ) { 
        req.session.isAdmin = true; 
        return res.redirect("/admin"); 
    } 
    res.render("admin/login", { 
        title: "Admin Login", 
        error: "Invalid username or password", 
        hideHeader: true
    }); 
});

// Logout 
app.get("/admin/logout", (req, res) => { 
    req.session.destroy(() => { 
        res.redirect("/admin/login"); 
    }); 
});

// Dashboard 
app.get("/admin", requireAdmin, async (req, res) => { 
    const userCount = await db.collection("users").countDocuments(); 
    const postCount = await db.collection("posts").countDocuments(); 
    res.render("admin/dashboard", { title: "Dashboard", userCount, postCount, }); 
});

// API Endpoints Page 
app.get("/admin/api", requireAdmin, (req, res) => { 
    res.render("admin/api", { title: "API Endpoints" }); 
});

// users admin functions
app.get("/admin/users", requireAdmin, async (req, res) => { 
    const users = await getUsers(); 
    res.render("admin/users/list", { title: "Manage Users", users }); 
});

app.get("/admin/users/add", requireAdmin, (req, res) => { 
    res.render("admin/users/form", { 
        title: "Add User", 
        user: {}, 
        formAction: "/admin/users/add"
    }); 
});

app.post("/admin/users/add", requireAdmin, async (req, res) => {
  const { fullName, username, email, city, password } = req.body;

  // 1. Mandatory fields
  if (!fullName || !username || !email || !city || !password) {
    return res.render("admin/users/form", {
      title: "Add User",
      error: "All fields are required.",
      formAction: "/admin/users/add", 
      user: req.body
    });
  }

  // 2. Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.render("admin/users/form", {
      title: "Add User",
      error: "Please enter a valid email address.",
      formAction: "/admin/users/add", 
      user: req.body
    });
  }

  // 3. Email uniqueness check
  const existingEmail = await db.collection("users").findOne({ email });
  if (existingEmail) {
    return res.render("admin/users/form", {
      title: "Add User",
      error: "This email is already registered.",
      formAction: "/admin/users/add", 
      user: req.body
    });
  }

  // 4. Username uniqueness check
  const existingUsername = await db.collection("users").findOne({ username });
  if (existingUsername) {
    return res.render("admin/users/form", {
      title: "Add User",
      error: "This username is already taken.",
      formAction: "/admin/users/add", 
      user: req.body
    });
  }

  // 5. Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // 6. Create user document
  const userDoc = {
    fullName,
    username,
    email,
    phone: req.body.phone,
    city,
    passwordHash: hashedPassword
  };

  // 7. Save to DB
  await addUser(userDoc);
  res.redirect("/admin/users");
});

//edit user
app.get("/admin/users/edit", requireAdmin, async (req, res) => { 
    if (!req.query.id) return res.redirect("/admin/users"); 
    const user = await getSingleUser(req.query.id); 
    res.render("admin/users/form", { 
        title: "Edit User", 
        user, 
        formAction: "/admin/users/edit", 
    }); 
});

//edit user post
app.post("/admin/users/edit", requireAdmin, async (req, res) => { 
    const id = req.body.id; 
    const userDoc = { 
        fullName: req.body.fullName, 
        username: req.body.username, 
        email: req.body.email, 
        phone: req.body.phone, 
        city: req.body.city, 
    }; 
    await editUser(id, userDoc); 
    res.redirect("/admin/users"); 
});

//delete user
app.get("/admin/users/delete", requireAdmin, async (req, res) => { 
    if (req.query.id) { 
        await deleteUser(req.query.id); 
    } 
    res.redirect("/admin/users"); 
});

//posts admin functions
app.get("/admin/posts", requireAdmin, async (req, res) => { 
    const posts = await getPosts(); 
    const users = await getUsers(); 
    res.render("admin/posts/list", { title: "Manage Posts", posts, users }); 
});

//add post route
app.get("/admin/posts/add", requireAdmin, async (req, res) => { 
    const users = await getUsers(); 
    res.render("admin/posts/form", { 
        title: "Add Post", 
        post: {}, 
        users, 
        formAction: "/admin/posts/add", 
    }); 
});

app.post("/admin/posts/add", requireAdmin, upload.single("photo"), async (req, res) => {
  const { restaurantName, restaurantCity } = req.body;

  // 1. Mandatory validation
  if (!req.file || !restaurantName || !restaurantCity) {
    return res.render("admin/posts/form", {
      title: "Add Post",
      error: "Photo URL, restaurant name, and restaurant city are required.",
      formAction: "/admin/posts/add",
      post: req.body,
      users: await getUsers()
    });
  }

  // 2. Create post document
  const postDoc = {
    userId: new ObjectId(String(req.body.userId)),
    photo: req.file.buffer,
    photoType: req.file.mimetype, 
    restaurantName,
    restaurantCity,
    restaurantAddress: req.body.restaurantAddress,
    dishName: req.body.dishName,
    comment: req.body.comment,
    likesCount: parseInt(req.body.likesCount) || 0
  };

  // 3. Save to DB
  await addPost(postDoc);
  res.redirect("/admin/posts");
});

//edit post
app.get("/admin/posts/edit", requireAdmin, async (req, res) => { 
    if (!req.query.id) return res.redirect("/admin/posts"); 
    const post = await getSinglePost(req.query.id); 
    const users = await getUsers(); 
    res.render("admin/posts/form", { 
        title: "Edit Post", 
        post, 
        users, 
        formAction: "/admin/posts/edit", 
    }); 
});

app.post("/admin/posts/edit", requireAdmin, upload.single("photo"), async (req, res) => { 
    const id = req.body.id; 
    const postDoc = { 
        userId: new ObjectId(String(req.body.userId)), 
        restaurantName: req.body.restaurantName, 
        restaurantCity: req.body.restaurantCity, 
        restaurantAddress: req.body.restaurantAddress, 
        dishName: req.body.dishName, 
        comment: req.body.comment, 
        likesCount: parseInt(req.body.likesCount) || 0, 
    }; 
    if (req.file) {
        postDoc.photo = req.file.buffer;
        postDoc.photoType = req.file.mimetype;
    }
    await editPost(id, postDoc); 
    res.redirect("/admin/posts"); 
});

//delete post
app.get("/admin/posts/delete", requireAdmin, async (req, res) => { 
    if (req.query.id) { 
        await deletePost(req.query.id); 
    } 
    res.redirect("/admin/posts"); 
});

// API endpoints
app.get("/api/users", async (req, res) => { 
    const users = await getUsers(); 
    res.json(users); 
}); 
    
app.get("/api/posts", async (req, res) => { 
    const posts = await getPosts(); 
    res.json(posts); 
});

// function to get users
async function getUsers() { 
    const results = db.collection("users").find({}).sort({ createdAt: -1 }); 
    return await results.toArray(); 
}

//function to fetch single user by id
async function getSingleUser(id) { 
    const filter = { _id: new ObjectId(String(id)) }; 
    return await db.collection("users").findOne(filter); 
}

//function to add new user
async function addUser(userDoc) { 
    userDoc.createdAt = new Date(); 
    userDoc.updatedAt = new Date(); 
    const status = await db.collection("users").insertOne(userDoc); 
    if (status.insertedId) console.log("User added"); 
} 

//function to edit user
async function editUser(id, userDoc) { 
    const filter = { _id: new ObjectId(String(id)) }; 
    userDoc.updatedAt = new Date(); 
    await db.collection("users").updateOne(filter, { $set: userDoc }); 
}

//function to delete user
async function deleteUser(id) { 
    const filter = { _id: new ObjectId(String(id)) }; 
    const result = await db.collection("users").deleteOne(filter); 
    if (result.deletedCount === 1) 
        console.log("User deleted"); 
} 

//function to fetch all posts
async function getPosts() { 
    const results = db.collection("posts").find({}).sort({ createdAt: -1 }); 
    return await results.toArray(); 
} 

//function to fetch single post
async function getSinglePost(id) { 
    const filter = { _id: new ObjectId(String(id)) }; 
    return await db.collection("posts").findOne(filter); 
} 

//function to add new post
async function addPost(postDoc) { 
    postDoc.createdAt = new Date(); 
    postDoc.updatedAt = new Date(); 
    const status = await db.collection("posts").insertOne(postDoc); 
    if (status.insertedId) console.log("Post added"); 
} 

//function to edit post
async function editPost(id, postDoc) { 
    const filter = { _id: new ObjectId(String(id)) }; 
    postDoc.updatedAt = new Date(); 
    await db.collection("posts").updateOne(filter, { $set: postDoc }); 
}

//function to delete post
async function deletePost(id) { 
    const filter = { _id: new ObjectId(String(id)) }; 
    const result = await db.collection("posts").deleteOne(filter); 
    if (result.deletedCount === 1) console.log("Post deleted"); 
}

//set the server to listening for requests
app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
