require('dotenv').config();
const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

const cors = require('cors');

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9mv6kq4.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri);
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});


const run = async () => {
  try {
    const db = client.db('book-catelog');
    const bookCollection = db.collection('book');
    const usersCollection = db.collection("user");
    

    app.get('/books', async (req, res) => {
    //  const cursor = bookCollection.find({});
    //  const books = await cursor.toArray();
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
      res.send({ status: true, data: books });
    });

    app.post('/book', async (req, res) => {
      const book = req.body;

      const result = await bookCollection.insertOne(book);

      res.send(result);
    });

    app.get('/book/:id', async (req, res) => {
      const id = req.params.id;

      const result = await bookCollection.findOne({ _id: ObjectId(id) });
      res.send(result);
    });

    app.delete('/book/:id', async (req, res) => {
      const id = req.params.id;

      const result = await bookCollection.deleteOne({ _id: ObjectId(id) });
      res.send(result);
    });

    app.post('/comment/:id', async (req, res) => {
      const bookId = req.params.id;
      const comment = req.body.comment;


      const result = await bookCollection.updateOne(
        { _id: ObjectId(bookId) },
        { $push: { comments: comment } }
      );

      console.log(result);

      if (result.modifiedCount !== 1) {
        console.error('book not found or comment not added');
        res.json({ error: 'book not found or comment not added' });
        return;
      }

      res.json({ message: 'Comment added successfully' });
    });

    app.get('/comment/:id', async (req, res) => {
      const bookId = req.params.id;

      const result = await bookCollection.findOne(
        { _id: ObjectId(bookId) },
        { projection: { _id: 0, comments: 1 } }
      );

      if (result) {
        res.json(result);
      } else {
        res.status(404).json({ error: 'book not found' });
      }
    });

    app.post('/user', async (req, res) => {
      const user = req.body;

      const result = await userCollection.insertOne(user);

      res.send(result);
    });

    app.get('/user/:email', async (req, res) => {
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

app.get('/', (req, res) => {
  res.send('Hello Book Catelogo!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
