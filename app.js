const express = require('express');
const cookieParser = require('cookie-parser');
const engine = require('ejs-mate');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const port = 3000;
const database = 'graduate_tracking_system.db';

// open database
let db = new sqlite3.Database(database, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log(`Connected to ${database}`);
});

app.engine('ejs', engine);
app.set('view engine', 'ejs');
app.use(express.urlencoded({extended: true}));
app.use(express.static(__dirname + '/public'));
app.use(cookieParser());

app.get('/', async (req, res) => {
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    const cookies = req.cookies;
    let courses = [];
    db.serialize(() => {
        db.each("SELECT subject, number, name from COURSE", (err, row) => {
            courses.push([row.subject, row.number, row.name])
        });
    });
    await sleep(300);
    res.render('add-courses', {courses, cookies});
})

app.get('/degree-audit', async (req, res) => {
    function newData(category, progress, taken, recommend){
        data[category] = {'progress': progress, 'taken': taken, 'recommend': recommend};
    }
    const studentInfo = req.cookies;
    const data = {};

    // Algorithm here -- Example
    newData('c', 'p', 't', 'r');

    res.render('degree-audit', {data});
})

app.post('/degree-audit', async (req, res) => {
    res.cookie('course', req.body.course);
    res.cookie('program', req.body.program);
    res.cookie('specialization', req.body.specialization);
    res.cookie('capstone', req.body.capstone);
    if (req.body.address === 'save') {
        res.redirect('/');
    } else {
        res.redirect('/degree-audit');
    }
})

app.listen(port, () => {
    console.log(`Serving on port ${port}`);
})