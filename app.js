const express = require('express');
const engine = require('ejs-mate');
const app = express();
const port = 3000;

app.engine('ejs', engine);
app.set('view engine', 'ejs');

app.get('/', async(req, res) => {
    res.render('main');
})

app.listen(port, () => {
    console.log(`Serving on port ${port}`);
})