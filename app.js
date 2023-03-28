require('dotenv').config()
const check = require("./check");
const express = require("express");
const cookieParser = require("cookie-parser");
const engine = require("ejs-mate");
const sqlite3 = require("sqlite3").verbose();
const app = express();
const port =process.env.PORT || 8080;
const database = "graduate_tracking_system.db";

// open database
let db = new sqlite3.Database(database, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log(`Connected to ${database}`);
});

app.engine("ejs", engine);
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + "/public"));
app.use(cookieParser());

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.get("/", async (req, res) => {
  const cookies = req.cookies;
  let courses = [];
  let specializations = [];
  let bins = [];
  db.serialize(() => {
    db.each("SELECT subject, number, name from COURSE", (err, row) => {
      courses.push([row.subject, row.number, row.name]);
    });
    db.each("SELECT spec_id, spec_name from SPECIALIZATION", (err, row) => {
      specializations.push([row.spec_id, row.spec_name]);
    });
    db.each("SELECT bin_id, bin_name FROM BIN", (err, row) => {
      bins.push([row.bin_id, row.bin_name]);
    });
  });
  await sleep(300);
  res.render("add-courses", { courses, specializations, bins, cookies });
});

app.get("/degree-audit", async (req, res) => {
  function newData(category, progress, taken, recommend) {
    if (progress.length > 0) {
      data[category]["progress"] = progress;
    }
    if (taken.length > 0) {
      data[category]["taken"] = taken;
    }
    if (recommend.length > 0) {
      data[category]["recommend"] = recommend;
    }
  }
  const studentInfo = req.cookies;
  let data = {};

  data = await check.degree_audit(
    studentInfo.program,
    studentInfo.capstone,
    studentInfo.course,
    studentInfo.specialization,
    db
  );

  info = {
    program: studentInfo.program,
    capstone: studentInfo.capstone,
    specialization: "N.A.",
  };
  db.each(
    "SELECT spec_name FROM SPECIALIZATION WHERE spec_id=?",
    studentInfo.specialization,
    (err, row) => {
      info.specialization = row.spec_name;
    }
  );
  await sleep(300);
  res.render("degree-audit", { data, info });
});
app.post("/degree-audit", async (req, res) => {
  res.cookie("course", req.body.course);
  res.cookie("program", req.body.program);
  res.cookie("specialization", req.body.specialization);
  res.cookie("capstone", req.body.capstone);
  if (req.body.address === "save") {
    res.redirect("/");
  } else {
    res.redirect("/degree-audit");
  }
});

app.listen(port, () => {
  console.log(`Serving on port ${port}`);
});
