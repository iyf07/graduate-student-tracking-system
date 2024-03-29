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
  if (program == "MSIS") {
    total_bins_num.servicesAndOrganizations = 1;
    total_bins_num.technology = 2;
  } else if (program == "MSLS") {
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
};
const degree_audit = async function (
  program,
  capstone,
  courses,
  specialization,
  db
) {
  let specSet = new Set();

  spec_dbToSet(specSet, specialization, capstone, db);
  await new Promise((resolve) => setTimeout(resolve, 300));
  initialize_data(program);
  let taken = await preprocess(courses, db, specSet);
  const recommandCourses = taken[1]; //in set
  const progressTaken = taken[0];
  recommandCourses.forEach((course) => {
    updateRecommandData(course);
  });
  progressTaken.forEach((course) => {
    let bin_id = course.bin_id;
    if (bin_id == 0) update_data("elective", course);
    else if (bin_id == 1) check_bin(course, "information");
    else if (bin_id == 2) check_bin(course, "servicesAndOrganizations");
    else if (bin_id == 3) check_bin(course, "technology");
    else if (bin_id == 4) check_bin(course, "peopleAndCommunities");
    else if (bin_id == 5) check_bin(course, "core");
    else if (bin_id == 6) check_capstone(capstone, course);
    else console.log("no bin_id:", bin_id);
  });
  return data;
};

const preprocess = async function (courses, db, recommandSet) {
  const courses_info = courses.split("&&&");
  let takenCheckForProgress = [];
  let takenCheckForRecommand = "";
  let creditDict = [[], [], [], [], []];
  for (let i = 0; i < courses_info.length; i++) {
    let course_info = courses_info[i].split(" - ");
    const subject_number = course_info[0].split(" ");
    if (course_info.length == 3) {
      const customizedCourse = {
        subject: subject_number[0],
        number: subject_number[1],
        name: course_info[2].substring(8).concat(" ", Number(course_info[2].substring(8))===1? "credit" : "credits"),
        credit: Number(course_info[2].substring(8)),
        bin_id: Number(course_info[1].substring(4, 5)),
      };
      takenCheckForRecommand =
        customizedCourse.subject +
        " " +
        customizedCourse.number +
        " - " +
        customizedCourse.name +
        " & " +
        customizedCourse.bin_id;
      //Check whether the taken course is in specialization x
      if (recommandSet.has(takenCheckForRecommand)) {
        recommandSet.delete(takenCheckForRecommand);
      }
      if (customizedCourse.credit == "1") creditDict[0].push(customizedCourse);
      else if (customizedCourse.credit == "1.5")
        creditDict[1].push(customizedCourse);
      else if (customizedCourse.credit == "2")
        creditDict[2].push(customizedCourse);
      else if (customizedCourse.credit == "3")
        creditDict[3].push(customizedCourse);
      else if (customizedCourse.credit == "4")
        creditDict[4].push(customizedCourse);
    } else {
      const coursePromise = new Promise((resolve) => {
        db.each(
          `SELECT * from COURSE WHERE subject=? AND number=? AND name=?`,
          subject_number[0],
          subject_number[1],
          course_info[1],
          (err, row) => {
            takenCheckForRecommand =
              row.subject +
              " " +
              row.number +
              " - " +
              row.name +
              " & " +
              row.bin_id;
            if (recommandSet.has(takenCheckForRecommand)) {
              recommandSet.delete(takenCheckForRecommand);
            }

            if (row.credit == "1") creditDict[0].push(row);
            else if (row.credit == "1.5") creditDict[1].push(row);
            else if (row.credit == "2") creditDict[2].push(row);
            else if (row.credit == "3") creditDict[3].push(row);
            else if (row.credit == "4") creditDict[4].push(row);
          },
          () => resolve()
        );
      });
      await coursePromise;
    }
  }
  creditDict.forEach((credit) => {
    credit.forEach((course) => {
      takenCheckForProgress.push(course);
    });
  });
  return [takenCheckForProgress, recommandSet];
};

const check_bin = function (course, category) {
  if (
    data[category].progress.takenNum + 1 <=
    data[category].progress.requiredNum
  ) {
    update_data(category, course);
  } else {
    update_data("elective", course);
  }
};

const check_capstone = function (capstone, course) {
  if (
    (capstone == "research" && course.number == "778") ||
    (capstone == "practicum" && course.number == "779") ||
    course.number == "992"
  )
    update_data("capstone", course);
  else update_data("elective", course);
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
};

//Recommanded
//Put the specialization and core courses to spec_set

async function spec_dbToSet(specSet, specialization, capstone, db) {
  return new Promise((resolve) => {
    db.serialize(() => {
      //Specialization
      db.each(
        `SELECT COURSE_TO_SPEC.subject, COURSE_TO_SPEC.number, COURSE_TO_SPEC.name, bin_id 
      FROM COURSE_TO_SPEC 
      INNER JOIN COURSE 
      ON COURSE.subject=COURSE_TO_SPEC.subject AND COURSE.number=COURSE_TO_SPEC.number AND COURSE.name=COURSE_TO_SPEC.name 
      WHERE spec_id=?`,
        specialization,
        (err, row) => {
          specSet.add(
            row.subject +
              " " +
              row.number +
              " - " +
              row.name +
              " & " +
              row.bin_id
          );
        }
      );
      //Core & Capstone courses
      db.each(
        "SELECT subject, number, name, bin_id from COURSE WHERE bin_id = 5 OR bin_id = 6",
        (err, row) => {
          if (
            (capstone == "research" && row.number != "779") ||
            (capstone == "practicum" && row.number != "778")
          ) {
            specSet.add(
              row.subject +
                " " +
                row.number +
                " - " +
                row.name +
                " & " +
                row.bin_id
            );
          }
        }
      );
    });
    setTimeout(() => {
      resolve();
    }, 200);
  });
}

//Distribute the remaining course to each bin
async function updateRecommandData(course) {
  const recommandCourse = course.split(" & ");
  const courseInfo = recommandCourse[0];
  const bin_id = recommandCourse[1];
  if (bin_id == 0) {
    data["elective"].recommend.push(courseInfo);
  } else if (bin_id == 1) {
    data["information"].recommend.push(courseInfo);
  } else if (bin_id == 2) {
    data["servicesAndOrganizations"].recommend.push(courseInfo);
  } else if (bin_id == 3) {
    data["technology"].recommend.push(courseInfo);
  } else if (bin_id == 4) {
    data["peopleAndCommunities"].recommend.push(courseInfo);
  } else if (bin_id == 5) {
    data["core"].recommend.push(courseInfo);
  } else if (bin_id == 6) {
    data["capstone"].recommend.push(courseInfo);
  }
}
