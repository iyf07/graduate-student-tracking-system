require("dotenv").config();
const check = require("./check");
const express = require("express");
const cookieParser = require("cookie-parser");
const engine = require("ejs-mate");
const sqlite3 = require("sqlite3").verbose();
const app = express();
const port = process.env.PORT || 8080;
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
app.use(express.urlencoded({extended: true}));
app.use(express.static(__dirname + "/public"));
app.use(cookieParser());

app.get("/", async (req, res) => {
  const cookies = req.cookies;
  let courses = [];
  let specializations = [];
  let bins = [];
  const coursePromise = new Promise((resolve, reject) => {
    db.each(
      "SELECT subject, number, name from COURSE",
      (err, row) => {
        courses.push([row.subject, row.number, row.name]);
      },
      () => {
        resolve();
      }
    );
  });

  const specializationPromise = new Promise((resolve, reject) => {
    db.each(
      "SELECT spec_id, spec_name from SPECIALIZATION",
      (err, row) => {
        specializations.push([row.spec_id, row.spec_name]);
      },
      () => {
        resolve();
      }
    );
  });

  const binPromise = new Promise((resolve, reject) => {
    db.each(
      "SELECT bin_id, bin_name FROM BIN",
      (err, row) => {
        bins.push([row.bin_id, row.bin_name]);
      },
      () => {
        resolve();
      }
    );
  });

  await Promise.all([coursePromise, specializationPromise, binPromise]);
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
    if (taken.length > 0) {
      data[category]["taken"] = taken;
    }
    if (recommend.length > 0) {
      data[category]["recommend"] = recommend;
    }
  const studentInfo = req.cookies;
  let data = {};
  const selectedSpecialization = studentInfo.specialization.split(" - ");

  data = await check.degree_audit(
    studentInfo.program,
    studentInfo.capstone,
    studentInfo.course,
    selectedSpecialization[0],
    db
  );

  info = {
    program: studentInfo.program,
    capstone: studentInfo.capstone,
    specialization: selectedSpecialization[1],
  };
  res.render("degree-audit", { data, info });
});

app.post("/degree-audit/:status", async (req, res) => {
  res.cookie("course", req.body.course);
  res.cookie("program", req.body.program);
  res.cookie("specialization", req.body.specialization);
  res.cookie("capstone", req.body.capstone);
  if (req.params.status === "save") {
    res.redirect("/");
  } else {
    res.redirect("/degree-audit");
  }
});

app.listen(port, () => {
    console.log(`Serving on port ${port}`);
});
