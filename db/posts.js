// db/posts.js
import { ObjectId } from "mongodb";

export async function getPosts(db) {
  return await db.collection("posts").find({}).sort({ createdAt: -1 }).toArray();
}

export async function getSinglePost(db, id) {
  return await db.collection("posts").findOne({ _id: new ObjectId(id) });
}

export async function addPost(db, data, file) {
  const postDoc = {
    userId: new ObjectId(String(data.userId)),
    photo: file.buffer,
    photoType: file.mimetype,
    restaurantName: data.restaurantName,
    restaurantCity: data.restaurantCity,
    restaurantAddress: data.restaurantAddress,
    dishName: data.dishName,
    comment: data.comment,
    likesCount: parseInt(data.likesCount) || 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await db.collection("posts").insertOne(postDoc);
  return result.insertedId;
}

export async function editPost(db, id, data, file) {
  const update = {
    userId: new ObjectId(String(data.userId)),
    restaurantName: data.restaurantName,
    restaurantCity: data.restaurantCity,
    restaurantAddress: data.restaurantAddress,
    dishName: data.dishName,
    comment: data.comment,
    likesCount: parseInt(data.likesCount) || 0,
    updatedAt: new Date(),
  };

  if (file) {
    update.photo = file.buffer;
    update.photoType = file.mimetype;
  }

  await db
    .collection("posts")
    .updateOne({ _id: new ObjectId(id) }, { $set: update });
}

export async function deletePost(db, id) {
  await db.collection("posts").deleteOne({ _id: new ObjectId(id) });
}
