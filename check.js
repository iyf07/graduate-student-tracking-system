const sqlite3 = require("sqlite3").verbose();
const database = "graduate_tracking_system.db";

var data = {};
var total_bins_num = {
  core: 2,
  information: 2,
  servicesAndOrganizations: 1,
  technology: 1,
  peopleAndCommunities: 1,
  capstone: 2,
  elective: 6,
}; // [core_num, bin1_num, bin2_num, bin3_num, bin4_num, capstone_num,elective_num ]
var taken_credit = 0;
var capstone_step1 = null;
var capstone_step2 = null;
const total_graduate_credit = 48;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const initialize_data = function (program) {
  const category = [
    "core",
    "information",
    "servicesAndOrganizations",
    "technology",
    "peopleAndCommunities",
    "capstone",
    "elective",
  ];
  if (program == "msis") {
    total_bins_num.servicesAndOrganizations = 1;
    total_bins_num.technology = 2;
  } else if (program == "msls") {
    total_bins_num.servicesAndOrganizations = 2;
    total_bins_num.technology = 1;
  }
  for (let i = 0; i < category.length; i++) {
    data[category[i]] = {
      progress: {
        takenNum: 0,
        requiredNum: total_bins_num[category[i]],
        credit: 0,
      },
      taken: new Array(),
      recommend: [],
    };
  }
  capstone_step1 = null;
  capstone_step2 = null;
};
//var spec_set = new Set();
const degree_audit = async function (
  program,
  capstone,
  courses,
  specialization,
  db
) {
  initialize_data(program);
  console.log(capstone_step1, capstone_step2);
  let taken_courses = await preprocess(courses, db);
  console.log(
    "student major and capstone:",
    program,
    " ",
    capstone,
    "\n",
    "bin 2 require:",
    total_bins_num.servicesAndOrganizations,
    "\n",
    "Specialization id:",
    specialization,
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
    else if (bin_id == 1) check_bin(taken_courses[i], "information");
    else if (bin_id == 2)
      check_bin(taken_courses[i], "servicesAndOrganizations");
    else if (bin_id == 3) check_bin(taken_courses[i], "technology");
    else if (bin_id == 4) check_bin(taken_courses[i], "peopleAndCommunities");
    else if (bin_id == 5) check_bin(taken_courses[i], "core");
    else if (bin_id == 6) check_capstone(capstone, taken_courses[i]);
    else console.log("no bin_id:", bin_id);
  }
  //check_capstone
  console.log(1111111, capstone_step1, capstone_step2);
  if (capstone_step1 != null) {
    update_data("capstone", capstone_step1);
    if (capstone_step2 != null) update_data("capstone", capstone_step2);
  } else if (capstone_step1 == null && capstone_step2 != null) {
    console.log("cannot take 992 without taking 778/779!");
  }
  //recommand
  let spec_set = new Set();
  spec_dbToSet(spec_set, specialization, courses, db);
  await sleep(500);
  return data;
};

const preprocess = async function (courses, db) {
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

const check_bin = function (course, category) {
  if (
    data[category].progress.takenNum + 1 <=
    data[category].progress.requiredNum
  ) {
    update_data(category, course);
  } else {
    check_elective(course);
  }
};

const check_capstone = function (capstone, course) {
  if (
    (capstone == "research" && course.number == "778") ||
    (capstone == "practicum" && course.number == "779")
  )
    capstone_step1 = course;
  else if (course.number == "992") capstone_step2 = course;
  else check_elective(course);
};

const check_elective = function (course) {
  update_data("elective", course);
};

//Update progress and taken
const update_data = function (category, course) {
  //update progress
  data[category].progress.credit += course.credit;
  data[category].progress.takenNum += 1;
  //update taken
  taken_credit += course.credit;
  delete course.credit;
  delete course.bin_id;
  data[category].taken.push(
    course.subject + " " + course.number + " - " + course.name
  );
};

module.exports = {
  degree_audit,
  taken_credit,
};

//Recommanded
//Put the specialization and core courses to spec_set

async function spec_dbToSet(spec_set, specialization, courses, db) {
  db.serialize(() => {
    //Specialization
    db.each(
      `SELECT subject, number, name from COURSE_TO_SPEC WHERE spec_id = ?`,
      specialization,
      (err, row) => {
        spec_set.add(row.subject + " " + row.number + " - " + row.name);
      }
    );
    //Core course
    db.each(
      "SELECT subject, number, name from COURSE WHERE bin_id = 5 OR bin_id = 6",
      (err, row) => {
        spec_set.add(row.subject + " " + row.number + " - " + row.name);
      }
    );
  });

  await sleep(300);
  check_spec(spec_set, courses, db);
}
//Check whether the taken course is in specialization x

function check_spec(spec_set, courses, db) {
  const taken_courses2 = courses.split("&&&");
  for (let i = 0; i < taken_courses2.length; i++) {
    // Exist: remove it from set
    if (spec_set.has(taken_courses2[i])) {
      spec_set.delete(taken_courses2[i]);
    }
  }
  update_data2(spec_set, db);
}

//Distribute the remaining course to each bin
async function update_data2(spec_set, db) {
  spec_set.forEach((e) => {
    const course_info = e.split(" - ");
    const subject_number = course_info[0].split(" ");
    db.each(
      `SELECT bin_id from COURSE WHERE subject=? AND number=? AND name=?`,
      subject_number[0],
      subject_number[1],
      course_info[1],
      (err, row) => {
        if (row.bin_id == 0) {
          data["elective"].recommend.push(e);
        } else if (row.bin_id == 1) {
          data["information"].recommend.push(e);
        } else if (row.bin_id == 2) {
          data["servicesAndOrganizations"].recommend.push(e);
        } else if (row.bin_id == 3) {
          data["technology"].recommend.push(e);
        } else if (row.bin_id == 4) {
          data["peopleAndCommunities"].recommend.push(e);
        } else if (row.bin_id == 5) {
          data["core"].recommend.push(e);
        } else if (row.bin_id == 6) {
          data["capstone"].recommend.push(e);
        }
      }
    );
  });
  await sleep(300);

  // console.log("=======in check.js=========");
  // console.log(data);
}

/*
data={
  core: {
    progress:
    {
      num: ,
      credit:
    }, 
    taken:{
      {subject: , number: , name: },
      {subject: , number: , name: }
    },
    recommend:{
      //...
    }
  },
  bin1:{
    //...
  }
  //bin2 bin3 bin4 capstone elective..
}
*/
