const express = require('express');
const app = express();
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
require('dotenv').config();

//middlewares
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.mktejfv.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized access');
    }
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET_KEY, function (error, decoded) {
        if (error) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
};


async function run() {
    try {

        const usersCollection = client.db('wheelmania').collection('users');
        const categoriesCollection = client.db('wheelmania').collection('categories');
        const productsCollection = client.db('wheelmania').collection('products');


        ///verify seller middleware
        const verifySeller = async (req, res, next) => {
            // console.log(req.decoded.email);
            const decodedEmail = req.decoded.email;
            const queryEmail = { email: decodedEmail };
            const user = await usersCollection.findOne(queryEmail);
            if (user.role !== 'seller') {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        };

        ///verify admin middleware
        const verifyAdmin = async (req, res, next) => {
            // console.log(req.decoded.email);
            const decodedEmail = req.decoded.email;
            const queryEmail = { email: decodedEmail };
            const user = await usersCollection.findOne(queryEmail);
            if (user.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        };

        ///using categories collection///
        app.get('/categories', async (req, res) => {
            const query = {};
            const categories = await categoriesCollection.find(query).toArray();
            res.send(categories);
        });

        //getting per category data
        app.get('/category/:id', async (req, res) => {
            const id = req.params.id;
            const query = { category_id: id };
            const products = await productsCollection.find(query).toArray();
            res.send(products);
        });



        //get jwt token(storing to LS)
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET_KEY, { expiresIn: '2d' });
                return res.send({ accessToken: token });
            }

            res.status(403).send({ accessToken: '' });
        });



        ///products collection
        //getting products depending on email
        app.get('/products', verifyJWT, verifySeller, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;

            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' });
            }

            const query = { email: email };
            const products = await productsCollection.find(query).toArray();
            res.send(products);
        });


        //inserting a product
        app.post('/products', async (req, res) => {
            const product = req.body;
            const result = await productsCollection.insertOne(product);
            res.send(result);
        });



        /// users ///
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

        //getting all sellers
        app.get('/users/sellers', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;

            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' });
            }


            const query = { role: 'seller' };
            const sellers = await usersCollection.find(query).toArray();
            res.send(sellers);
        });

        //getting all buyers
        app.get('/users/buyers', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;

            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' });
            }

            const query = { role: 'buyer' };
            const buyers = await usersCollection.find(query).toArray();
            res.send(buyers);
        });



        ///checking if buyer///
        app.get('/users/buyer/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            // console.log(user)
            res.send({ isBuyer: user?.role === 'buyer' });
        });

        ///checking if seller///
        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            // console.log(user)
            res.send({ isSeller: user?.role === 'seller' });
        });


        ///checking if admin///
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            console.log(user)
            res.send({ isAdmin: user?.role === 'admin' });
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