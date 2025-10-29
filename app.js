import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import favicon from "serve-favicon";
import path from "path";
import { fileURLToPath } from 'url';
import session from "express-session";
import Swal from 'sweetalert2'
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true}));
app.use(favicon(path.join(__dirname, 'public', 'Logo Sweetflix.ico')))
app.use(express.json());
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true
}));

const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "BakeryShop",
    port: 5432
})
db.connect();

app.get('/', (req, res) => {
  res.render("beranda.ejs")
})

app.get('/produk', (req, res) => {
  res.render("produk.ejs")
})

// Database keranjang
let cart = [];

app.post('/keranjang/tambah', (req, res) => {
  if (!req.session.cart) req.session.cart = [];

  const item = req.body;
  const existing = req.session.cart.find(i => i.name === item.name);

  if (existing) {
    existing.quantity = (existing.quantity || 1) + 1;
  } else {
    item.quantity = 1;
    req.session.cart.push(item);
  }

  res.json(req.session.cart);
});

app.get('/keranjang', (req, res) => {
  const cartItems = req.session.cart || [];
  let total = 0;

  cartItems.forEach(item => {
    total += parsePrice(item.price) * (item.quantity || 1);
  });

  res.render('keranjang.ejs', { cart: cartItems, total });
});

// Fungsi pembantu operasi harga
function parsePrice(priceString) {
  const matches = priceString.match(/Rp\s?\d{1,3}(\.\d{3})*/g);

  if (!matches || matches.length === 0) return 0;

  const lastPrice = matches[matches.length - 1];

  const numeric = lastPrice
    .replace(/Rp\s?/i, '')
    .replace(/\./g, '');

  return parseInt(numeric, 10) || 0;
}

app.post('/keranjang/hapus', (req, res) => {
  const index = parseInt(req.body.index);
  const cart = req.session.cart;

  if (cart && index >= 0 && index < cart.length) {
    const item = cart[index];

    if (item.quantity && item.quantity > 1) {
      item.quantity -= 1;
    } else {
      cart.splice(index, 1);
    }
  }

  res.redirect('/keranjang');
});

app.get('/checkout', (req, res) => {
  res.render("checkout.ejs")
})

app.get('/checkout-success', (req, res) => {
  res.render("checkout-success.ejs")
})

// Setup Multer untuk menangani file upload
const upload = multer({ dest: 'uploads/' });

app.post('/checkout', upload.single('bukti'), async (req, res) => {
  try {
    const { nama, whatsapp, alamat } = req.body;
    const bukti = req.file; // file info from multer

    if (!nama || !whatsapp || !alamat || !bukti) {
      return res.status(400).send('Semua field wajib diisi');
    }

    const result = await db.query(
      `INSERT INTO checkout_orders (nama, whatsapp, alamat, bukti_path) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [nama, whatsapp, alamat, bukti.filename]
    );

    console.log('Data inserted with ID:', result.rows[0].id);

    res.redirect('/checkout-success');
  } catch (err) {
    console.error('Error saving to DB:', err);
    res.status(500).send('Terjadi kesalahan pada server.');
  }
});

app.listen(port, () => {
    console.log(`App is listening at port http://localhost:${port}`);
})
