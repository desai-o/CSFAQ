const mongoose = require("mongoose");

let mongoAvailable = false;

async function connectMongo() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    mongoAvailable = true;
    console.log("MongoDB connected");
    console.log("Database name:", mongoose.connection.name);

    mongoose.connection.on("disconnected", () => {
      mongoAvailable = false;
      console.warn("MongoDB disconnected. SQLite fallback active.");
    });

    mongoose.connection.on("reconnected", () => {
      mongoAvailable = true;
      console.log("MongoDB reconnected");
    });

    mongoose.connection.on("error", (error) => {
      mongoAvailable = false;
      console.error("MongoDB runtime error:", error.message);
    });
  } catch (error) {
    mongoAvailable = false;
    console.error("MongoDB connection failed. SQLite fallback active.");
    console.error(error.message);
  }
}

function isMongoAvailable() {
  return mongoAvailable && mongoose.connection.readyState === 1;
}

module.exports = {
  connectMongo,
  isMongoAvailable
};
