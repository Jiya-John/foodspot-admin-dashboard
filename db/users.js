// db/users.js
import bcrypt from "bcrypt";
import { ObjectId } from "mongodb";

export async function getUsers(db) {
  return await db.collection("users").find({}).sort({ createdAt: -1 }).toArray();
}

export async function getSingleUser(db, id) {
  return await db.collection("users").findOne({ _id: new ObjectId(id) });
}

export async function addUser(db, data) {
  const hashedPassword = await bcrypt.hash(data.password, 10);

  const userDoc = {
    fullName: data.fullName,
    username: data.username,
    email: data.email,
    phone: data.phone,
    city: data.city,
    passwordHash: hashedPassword,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.collection("users").insertOne(userDoc);
}

export async function editUser(db, id, data) {
  const update = {
    fullName: data.fullName,
    username: data.username,
    email: data.email,
    phone: data.phone,
    city: data.city,
    updatedAt: new Date(),
  };

  await db
    .collection("users")
    .updateOne({ _id: new ObjectId(id) }, { $set: update });
}

export async function deleteUser(db, id) {
  await db.collection("users").deleteOne({ _id: new ObjectId(id) });
}
