const express = require('express');
const app = express();
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
require('dotenv').config();

//middlewares
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.mktejfv.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {

        const usersCollection = client.db('wheelmania').collection('users');

        //storing users info
        app.post('/users', async (req, res) => {
            const user = req.body;
            // console.log(user);

            const query = {}
            const allUsers = await usersCollection.find(query).toArray();
            const existingUser = allUsers.find(existingUser => existingUser.email === user.email)
            // console.log('existing', existingUser)

            if (existingUser) {
                return;
            }
            else {
                const result = await usersCollection.insertOne(user);
                res.send(result);
            }

        });


    }
    finally {
        ///
    }
}

run().catch(error => console.error(error));


app.get('/', async (req, res) => {
    res.send('wheel mania server is running successfully.');
});

app.listen(port, () => {
    console.log(`Wheel Mania is running on ${port}`);
});