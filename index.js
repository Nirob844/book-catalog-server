require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const cors = require("cors");

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9mv6kq4.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const run = async () => {
  try {
    const db = client.db("book-catelog");
    const bookCollection = db.collection("book");
    const usersCollection = db.collection("user");

    app.get("/books", async (req, res) => {
      const { search, genre, publicationYear } = req.query;
      // Prepare the filter conditions
      const filter = {};

      if (search) {
        // Use search for title, author name, and genre
        filter.$or = [
          { title: { $regex: search, $options: "i" } },
          { author: { $regex: search, $options: "i" } },
          { genre: { $regex: search, $options: "i" } },
        ];
      }

      if (genre) {
        // Filter by genre
        filter.genre = genre;
      }

      if (publicationYear) {
        filter.publicationDate = {
          $regex: `^${publicationYear}-`,
          $options: "i",
        };
      }
      const books = await bookCollection.find(filter).toArray();
      return res.status(200).send({
        message: "Books retrieved successfully!",
        data: books,
      });
    });

    app.get("/book/recent-published", async (req, res) => {
      const sort = { publishedDate: -1 };
      const result = await bookCollection
        .find({})
        .sort(sort)
        .limit(10)
        .toArray();
        
      return res.status(200).send({
        message: "Recent Published Books retrieved successfully!",
        book: result,
      });
    });

    app.post("/book", async (req, res) => {
      const authorizeToken = req.headers.authorization;
      if (!authorizeToken) {
        return res.status(400).send({
          message: "Authorization not provided",
        });
      } else {
        const verifiedUser = await jwt.verify(authorizeToken, "tokenSecret");
        if (!verifiedUser) {
          return res.status(400).send({
            message: "You are not authorized",
          });
        } else {
          const book = req.body;
          const result = await bookCollection.insertOne(book);
          if (result.acknowledged == true) {
            return res.status(200).send({
              message: "Book added successfully!",
              book: book,
            });
          } else {
            return res.status(400).send({
              message: "Book added failed!",
            });
          }
        }
      }
    });

    app.get("/book/:id", async (req, res) => {
      const id = req.params.id;

      const book = await bookCollection.findOne({ _id: ObjectId(id) });
      //res.send(result);
      if (book) {
        return res.status(200).send({
          message: "Book details retrieved successfully!",
          book: book,
        });
      } else {
        return res.status(404).send({
          message: "Book not found",
        });
      }
    });

    app.put("/book/:id", async (req, res) => {
      const authorizeToken = req.headers.authorization;
      if (!authorizeToken) {
        return res.status(400).send({
          message: "Authorization not provided",
        });
      } else {
        const verifiedUser = jwt.verify(authorizeToken, "tokenSecret");
        if (!verifiedUser) {
          return res.status(400).send({
            message: "You are not authorized",
          });
        } else {
          const bookId = req.params.id;
          const updatedBookData = req.body;
          // Remove the _id field from the updatedBookData object
          delete updatedBookData._id;

          const result = await bookCollection.updateOne(
            { _id: new ObjectId(bookId) },
            { $set: updatedBookData }
          );

          if (result.matchedCount > 0) {
            return res.status(200).send({
              message: "Book updated successfully!",
              book: updatedBookData,
            });
          } else {
            return res.status(404).send({
              message: "Book not found",
            });
          }
        }
      }
    });

    app.delete("/book/:id", async (req, res) => {
      const authorizeToken = req.headers.authorization;
      if (!authorizeToken) {
        return res.status(400).send({
          message: "Authorization not provided",
        });
      } else {
        const verifiedUser = await jwt.verify(authorizeToken, "tokenSecret");
        if (!verifiedUser) {
          return res.status(400).send({
            message: "You are not authorized",
          });
        } else {
          const bookId = req.params.id;

          const result = await bookCollection.deleteOne({
            _id: new ObjectId(bookId),
          });

          if (result.deletedCount > 0) {
            return res.status(200).send({
              message: "Book deleted successfully!",
            });
          } else {
            return res.status(404).send({
              message: "Book not found",
            });
          }
        }
      }
    });

    app.post("/comment/:id", async (req, res) => {
      const authorizeToken = req.headers.authorization;
      if (!authorizeToken) {
        return res.status(400).send({
          message: "Authorization not provided",
        });
      } else {
        const verifiedUser = await jwt.verify(authorizeToken, "tokenSecret");
        if (!verifiedUser) {
          return res.status(400).send({
            message: "You are not authorized",
          });
        } else {
          const bookId = req.params.id;
          const bodyData = req.body;
          const filter = { _id: new ObjectId(bookId) };
          const update = {
            $push: { customerReviews: bodyData },
          };

          const result = await bookCollection.updateOne(filter, update);

          if (result.modifiedCount > 0) {
            return res.status(200).send({
              message: "Review added successfully!",
            });
          } else {
            return res.status(400).send({
              message: "Review adding failed!",
            });
          }
        }
      }
    });

    app.get("/comment/:id", async (req, res) => {
      const bookId = req.params.id;

      const result = await bookCollection.findOne(
        { _id: ObjectId(bookId) },
        { projection: { _id: 0, comments: 1 } }
      );

      if (result) {
        res.json(result);
      } else {
        res.status(404).json({ error: "book not found" });
      }
    });

    // Authentication APIs Start
    app.post("/auth/signup", async (req, res) => {
      const userData = req.body;
      // find user is exist or not
      const isExistUser = await usersCollection.findOne({
        email: userData.email,
      });
      if (isExistUser) {
        return res.status(400).send({
          message: "This email already exist!",
        });
      } else {
        const hashedPassword = await bcrypt.hash(userData.password, 12);
        userData.password = hashedPassword;
        const result = await usersCollection.insertOne(userData);
        if (result.acknowledged == true) {
          return res.status(200).send({
            message: "User sign up successfully!",
          });
        } else {
          return res.status(400).send({
            message: "Sign Up Failed!",
          });
        }
      }
    });

    app.post("/auth/login", async (req, res) => {
      const userData = req.body;
      const isAvailableUser = await usersCollection.findOne({
        email: userData.email,
      });
      if (!isAvailableUser) {
        return res.status(400).send({
          message: "This email does not exist!",
        });
      } else {
        const isPasswordMatched = await bcrypt.compare(
          userData.password,
          isAvailableUser.password
        );
        if (!isPasswordMatched) {
          return res.status(400).send({
            message: "Incorrect Password!",
          });
        } else {
          const accessToken = await jwt.sign(
            { email: isAvailableUser.email },
            "tokenSecret",
            { expiresIn: "30d" }
          );
          return res.status(200).send({
            message: "Login successfully!",
            token: accessToken,
          });
        }
      }
    });

    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;

      const result = await userCollection.findOne({ email });

      if (result?.email) {
        return res.send({ status: true, data: result });
      }

      res.send({ status: false });
    });
  } finally {
  }
};

run().catch((err) => console.log(err));

app.get("/", (req, res) => {
  res.send("Hello Book Catelogo!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
