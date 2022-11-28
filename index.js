const express = require('express');
const app = express();
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// console.log(process.env.STRIPE_SECRET_KEY)

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
        const ordersCollection = client.db('wheelmania').collection('orders');
        const wishListCollection = client.db('wheelmania').collection('wishlistproducts');


        ///verify buyer middleware
        const verifyBuyer = async (req, res, next) => {
            // console.log(req.decoded.email);
            const decodedEmail = req.decoded.email;
            const queryEmail = { email: decodedEmail };
            const user = await usersCollection.findOne(queryEmail);
            if (user.role !== 'buyer') {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        };

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





        ///stripe///
        //stripe payment api

        app.post('/create-payment-intent', async (req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ]
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });


        /*  app.post('/create-payment-intent', async (req, res) => {
             const order = req.body;
             const price = order.resale_price;
             const amount = parseFloat(price * 100);
             console.log(amount);
 
             const paymentIntent = await stripe.paymentIntents.create({
                 currency: 'usd',
                 amount: amount,
                 "payment_method_types": [
                     "card"
                 ]
 
             });
             console.log(paymentIntent.client_secret)
 
             res.send({
                 clientSecret: paymentIntent.client_secret,
             });
         }); */



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

        //deleting a product
        app.delete('/products/:id', verifyJWT, verifySeller, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await productsCollection.deleteOne(query);
            res.send(result);
        });

        ///set to advertise
        app.put('/products/advertise/:id', async (req, res) => {
            const advertiseStatus = req.query.advertise;
            // console.log(advertiseStatus);
            const id = req.params.id;
            const queryId = { _id: ObjectId(id) };
            const options = { upsert: true };
            let updatedDoc;
            if (advertiseStatus === "false") {
                updatedDoc = {
                    $set: {
                        advertise: 'true'
                    }
                };
            }
            else {
                updatedDoc = {
                    $set: {
                        advertise: 'false'
                    }
                };
            }



            const result = await productsCollection.updateOne(queryId, updatedDoc, options);
            res.send(result);
        });


        ///get all advertisements
        app.get('/advertisements', async (req, res) => {
            const query = { resale_status: 'Available', advertise: 'true' };
            const products = await productsCollection.find(query).toArray();
            res.send(products);
        });

        app.get('/allproducts', async (req, res) => {
            const query = {};
            const products = await productsCollection.find(query).toArray();
            res.send(products);
        });


        ///orders///
        //inserting an order
        app.post('/orders', async (req, res) => {
            const order = req.body;
            const result = await ordersCollection.insertOne(order);
            res.send(result);
        });

        //getting all the orders
        app.get('/orders', async (req, res) => {
            const query = {};
            const orders = await ordersCollection.find(query).toArray();
            res.send(orders);
        });

        //getting per order data
        app.get('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const order = await ordersCollection.findOne(query);
            res.send(order);
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

        //delete user
        app.delete('/users/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            res.send(result);
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

        //getting a seller
        app.get('/users/seller', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const seller = await usersCollection.findOne(query);
            res.send(seller);
        });





        ///make seller verified///
        app.put('/users/verify/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };

            const updatedDoc = {
                $set: {
                    verification: 'verified'
                }
            };
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        });


        ///wishlist 
        //add wishlist item
        app.post('/wishlistproducts', async (req, res) => {
            const product = req.body;

            const query = {};
            const allproducts = await wishListCollection.find(query).toArray();

            const existingProduct = allproducts.find(existingProduct => existingProduct.product_id === product.product_id && existingProduct.user_email === product.user_email);

            if (existingProduct) {
                res.send({ acknowledged: false })
            }
            else {
                const result = await wishListCollection.insertOne(product);
                res.send(result);
            }
        });

        //getting all wishlists
        app.get('/wishlistproducts', async (req, res) => {
            const userEmail = req.query.user_email;
            const query = { user_email: userEmail };
            const wLProducts = await wishListCollection.find(query).toArray();

            const filter = {};
            const products = await productsCollection.find(filter).toArray();

            /* // console.log(products);
             
            wLProducts.forEach(wl=>{
                const matchedProduct=products.filter(product=>)
            }) */


            res.send(wLProducts);
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


        //updating a new field
        /* app.get('/addadvertise', async (req, res) => {
            const query = {};
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    advertise: "false"
                }
            };
            const result = await productsCollection.updateMany(query, updatedDoc, options);
            res.send(result);

        }); */






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