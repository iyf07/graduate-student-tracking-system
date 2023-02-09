const sqlite3 = require("sqlite3").verbose();
const database = "graduate_tracking_system.db";

// open database
let db = new sqlite3.Database(database, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log(`Connected to ${database}`);
});

var data = {};
var total_bins_num = [2, 1, 1, 1, 2]; // [bin1_num, bin2_num, bin3_num, bin4_num, core_num]
var taken_credit = 0;
var capstone_step1 = false;
var capstone_step2 = null;
const total_graduate_credit = 48;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const initialize_data = function (program) {
  const category = [
    "core",
    "bin1",
    "bin2",
    "bin3",
    "bin4",
    "capstone",
    "elective",
  ];
  for (let i = 0; i < category.length; i++) {
    data[category[i]] = {
      progress: { num: 0, credit: 0 },
      taken: new Array(),
      recommend: [],
    };
  }
  if (program == "msis") {
    total_bins_num[2] = 2;
    total_bins_num[1] = 1;
  } else if (program == "msls") {
    total_bins_num[2] = 1;
    total_bins_num[1] = 2;
  }
  capstone_step1 = false;
  capstone_step2 = null;
};

const degree_audit = async function (program, capstone, courses) {
  initialize_data(program);
  let taken_courses = await preprocess(courses);
  console.log(
    "student major and capstone:",
    program,
    " ",
    capstone,
    "\nbin 2 require:",
    total_bins_num[1],
    "\n",
    "now courses are:"
  );
  for (let i = 0; i < taken_courses.length; i++) {
    console.log(
      taken_courses[i].subject + " " + taken_courses[i].number,
      ": bin is ",
      taken_courses[i].bin_id,
      ", credit is ",
      taken_courses[i].credit
    );
  }
  for (let i = 0; i < taken_courses.length; i++) {
    let bin_id = taken_courses[i].bin_id;
    if (bin_id == 0) check_elective(taken_courses[i]);
    else if (bin_id >= 1 && bin_id <= 4)
      check_bin(taken_courses[i], "bin" + bin_id, total_bins_num[bin_id - 1]);
    else if (bin_id == 5)
      check_bin(taken_courses[i], "core", total_bins_num[bin_id - 1]);
    else if (bin_id == 6) check_capstone(capstone, taken_courses[i]);
    else console.log("no bin_id:", bin_id);
  }
  return data;
};

const preprocess = async function (courses) {
  const courses_info = courses.split("&&&");
  let taken_courses = [];
  for (let i = 0; i < courses_info.length; i++) {
    const course_info = courses_info[i].split(" - ");
    const subject_number = course_info[0].split(" ");
    db.each(
      `SELECT * from COURSE WHERE subject=? AND number=? AND name=?`,
      subject_number[0],
      subject_number[1],
      course_info[1],
      (err, row) => {
        if (row.credit == "1.5") {
          taken_courses.splice(0, 0, row);
        } else {
          taken_courses.push(row);
        }
      }
    );
  }
  await sleep(300);
  return taken_courses;
};

const check_bin = function (course, bin_num, required_num) {
  if (data[bin_num].progress.num + 1 <= required_num) {
    update_data(bin_num, course);
  } else {
    check_elective(course);
  }
};

const check_capstone = function (capstone, course) {
  if (
    (capstone == "research" && course.number == "778") ||
    (capstone == "practicum" && course.number == "779") ||
    (capstone_step1 && course.number == "992") || //778/779 first, 992 second
    (capstone_step1 && capstone_step2 != null) //992 first, 778/779 second
  ) {
    capstone_step1 = true;
    update_data("capstone", course);
    if (capstone_step1 && capstone_step2 != null) {
      console.log("both take!!!!!!!!!!!!");
      update_data("capstone", capstone_step2);
    }
  } else if (
    (capstone == "research" && course.number == "779") ||
    (capstone == "practicum" && course.number == "778")
  ) {
    check_elective(course);
    console.log("move ", course.number, " in elective");
    return;
  } else if (course.number == "992" && !capstone_step1) {
    //992 first, but 778/779 not met
    capstone_step2 = course;
    console.log("WARNING: cannot take 992 before taking 779 or 778");
  }
};

const check_elective = function (course) {
  update_data("elective", course);
};

const update_data = function (bin, course) {
  data[bin].progress.credit += course.credit;
  data[bin].progress.num += 1;
  taken_credit += course.credit;
  delete course.credit;
  delete course.bin_id;
  data[bin].taken.push(course);
};

module.exports = {
  degree_audit,
  taken_credit,
};
/*
data={
  core: {
    progress:
    {
      num: int,
      credit:int
    }, 
    taken:{
      {subject: string, number: string, name: string},
      {subject: string, number: string, name: string}
    },
    recommend:{
      //...
    }
  },
  bin1:{
    //...
  }
  //bin2 bin3 bin4 capstone elective..
}*/
