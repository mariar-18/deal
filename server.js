require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors()); app.use(express.json());
app.use(express.static(__dirname));
const db = mysql.createConnection({
    host: process.env.MYSQLHOST || 'localhost',
    user: process.env.MYSQLUSER || 'root',
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE || 'deal',
    port: process.env.MYSQLPORT || 3306
});

db.connect(err => {
    if (err) console.error("Database connection failed:", err);
    else console.log("MySQL Connected...");
});

// AUTH
app.post('/signup', async (req, res) => {
    const { username, email, password, role, campus } = req.body;
    const hash = await bcrypt.hash(password, 10);
    db.query("INSERT INTO users (username, email, password, role, campus) VALUES (?,?,?,?,?)", [username, email, hash, role, campus], (err) => res.json({message: "Ok"}));
});

app.post('/login', (req, res) => {
    const { email, password, role } = req.body;
    db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
        if (!results.length) return res.status(401).json({error: "Not found"});
        const isMatch = await bcrypt.compare(password, results[0].password);
        if (!isMatch || results[0].role !== role) return res.status(401).json({error: "Invalid role/password"});
        res.json({ user: results[0] });
    });
});

// PRODUCTS
app.get('/products', (req, res) => {
    const c = req.query.campus;
    let sql = "SELECT p.*, (SELECT AVG(rating) FROM ratings r WHERE r.seller_id = p.seller_id) as seller_rating FROM products p WHERE status='available'";
    if(c !== 'all') sql += ` AND campus = '${c}'`;
    db.query(sql, (err, r) => res.json(r));
});

app.get('/products/:id', (req, res) => {
    db.query("SELECT p.*, u.username FROM products p JOIN users u ON p.seller_id = u.id WHERE p.id = ?", [req.params.id], (err, r) => res.json(r[0]));
});

app.post('/products', (req, res) => {
    db.query("INSERT INTO products (seller_id, title, price, category, description, campus, status, item_condition) VALUES (?,?,?,?,?,?,'available',?)",
    [req.body.seller_id, req.body.title, req.body.price, req.body.category, req.body.description, req.body.campus, req.body.item_condition], () => res.json({message: "Ok"}));
});

app.get('/my-products/:id', (req, res) => { db.query("SELECT * FROM products WHERE seller_id = ?", [req.params.id], (err, r) => res.json(r)); });
app.delete('/products/:id', (req, res) => { db.query("DELETE FROM products WHERE id = ?", [req.params.id], () => res.json({message: "Ok"})); });

// OFFERS & BARGAINS
app.post('/make-offer', (req, res) => {
    const b = req.body;
    const sql = `INSERT INTO offers (product_id, buyer_id, seller_id, offered_price, p1, p2, p3, d1, d2, d3, t1, t2, t3, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'pending')`;
    db.query(sql, [b.product_id, b.buyer_id, b.seller_id, b.offered_price, b.p1, b.p2, b.p3, b.d1, b.d2, b.d3, b.t1, b.t2, b.t3], (err) => res.json({message: "Ok"}));
});

app.post('/handle-offer', (req, res) => {
    const { offer_id, status, selected_p, selected_d, selected_t } = req.body;
    let cleanDate = selected_d;
    if (selected_d && selected_d.includes('T')) cleanDate = selected_d.split('T')[0];
    const sql = "UPDATE offers SET status=?, selected_p=?, selected_d=?, selected_t=? WHERE id=?";
    db.query(sql, [status, selected_p || null, cleanDate || null, selected_t || null, offer_id], (err) => res.json({message: "Ok"}));
});

app.get('/seller-offers/:id', (req, res) => {
    db.query("SELECT o.*, p.title FROM offers o JOIN products p ON o.product_id = p.id WHERE o.seller_id = ? ORDER BY o.id DESC", [req.params.id], (err, r) => res.json(r));
});

app.get('/buyer-offers/:id', (req, res) => {
    db.query("SELECT o.*, p.title, (SELECT COUNT(*) FROM ratings r WHERE r.product_id = o.product_id AND r.buyer_id = o.buyer_id) as is_rated FROM offers o JOIN products p ON o.product_id = p.id WHERE o.buyer_id = ? ORDER BY o.id DESC", [req.params.id], (err, r) => res.json(r));
});

app.delete('/offers/:id', (req, res) => { db.query("DELETE FROM offers WHERE id = ?", [req.params.id], () => res.json({message: "Ok"})); });

// CART
app.post('/cart', (req, res) => { db.query("INSERT INTO cart (user_id, product_id) VALUES (?,?)", [req.body.user_id, req.body.product_id], () => res.json({message: "Ok"})); });
app.get('/cart/:id', (req, res) => { db.query("SELECT c.id as cart_id, p.* FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?", [req.params.id], (err, r) => res.json(r)); });
app.delete('/cart/:id', (req, res) => { db.query("DELETE FROM cart WHERE id = ?", [req.params.id], () => res.json({message: "Ok"})); });

// PAY & ORDERS
app.post('/pay', (req, res) => {
    const { product_id, offer_id, amount, buyer_id, seller_id } = req.body;

    const finalizePayment = () => {
        db.query("UPDATE products SET status='sold' WHERE id=?", [product_id], () => {
            db.query("DELETE FROM cart WHERE user_id = ? AND product_id = ?", [buyer_id, product_id], () => {
                res.json({message: "Ok"});
            });
        });
    };

    if(offer_id) {
        db.query("UPDATE offers SET status='paid' WHERE id=?", [offer_id], finalizePayment);
    } else {
        db.query("INSERT INTO offers (product_id, buyer_id, seller_id, offered_price, status) VALUES (?,?,?,?,'paid')", [product_id, buyer_id, seller_id, amount], finalizePayment);
    }
});

// MISC
app.post('/rate', (req, res) => { db.query("INSERT INTO ratings (product_id, seller_id, buyer_id, rating) VALUES (?,?,?,?)", [req.body.product_id, req.body.seller_id, req.body.buyer_id, req.body.rating], () => res.json({message: "Ok"})); });
app.post('/requests', (req, res) => { db.query("INSERT INTO item_requests (user_id, title, description) VALUES (?,?,?)", [req.body.user_id, req.body.title, req.body.description], () => res.json({message: "Ok"})); });
app.get('/requests', (req, res) => { db.query("SELECT * FROM item_requests ORDER BY id DESC", (err, r) => res.json(r)); });
app.delete('/requests/:id', (req, res) => { db.query("DELETE FROM item_requests WHERE id = ?", [req.params.id], () => res.json({message: "Ok"})); });

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`DEAL running on ${PORT}`);
});