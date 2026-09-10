import mongoose from "mongoose";

let isConnected = false;

export async function connectDB() {
  if (isConnected) return mongoose.connection;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Copy .env.example to .env and add your MongoDB connection string."
    );
  }

  mongoose.set("strictQuery", true);

  // Mongoose's default pool (100 sockets) is built for high-traffic apps —
  // wasteful on a small shared VPS running several projects on limited RAM.
  // A small flower shop's traffic comfortably fits in far fewer connections.
  const conn = await mongoose.connect(uri, { maxPoolSize: 10 });
  isConnected = true;

  console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);

  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err);
  });

  return conn.connection;
}

export default connectDB;
