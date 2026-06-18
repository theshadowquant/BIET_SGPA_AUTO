const { initializeApp } = require('firebase/app');
const { getFirestore, doc, writeBatch } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyDggw7KolO1AqI8vjM-7EM2yoRIqO-9wnI",
  authDomain: "biet-sgpa-auto-2d3ff.firebaseapp.com",
  projectId: "biet-sgpa-auto-2d3ff",
  storageBucket: "biet-sgpa-auto-2d3ff.firebasestorage.app",
  messagingSenderId: "765597648425",
  appId: "1:765597648425:web:2a7cc270c62d483723be38",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const BRANCHES = [
  { id: 'cs-ds', name: 'CS&E (Data Science)' },
  { id: 'cse',   name: 'Computer Science & Engineering' },
  { id: 'aiml',  name: 'AI & Machine Learning' },
  { id: 'ise',   name: 'Information Science & Engineering' },
  { id: 'csd',   name: 'Computer Science & Design' },
];

const SEMESTERS = [3, 4, 5, 6];

// Standard/Default subjects for VTU branches
const DEFAULTS = {
  'cs-ds': {
    3: [
      { key: 'math',     code: 'BCS301',     label: 'Mathematics for Computer Science',                  alias: 'Math',          credits: 4 },
      { key: 'dsa',      code: 'BCS302',     label: 'Data Structures and Applications',                  alias: 'DSA',           credits: 4 },
      { key: 'co',       code: 'BCS303',     label: 'Computer Organization and Architecture',            alias: 'COA',           credits: 3 },
      { key: 'oops',     code: 'BCS304',     label: 'Object Oriented Programming with Java',             alias: 'Java/OOP',      credits: 3 },
      { key: 'dsLab',    code: 'BCSL305',    label: 'Data Structures Lab',                               alias: 'DSA Lab',       credits: 1, hasLab: true },
      { key: 'scrLab',   code: 'BCS306',     label: 'Scripting Language Lab',                           alias: 'Python Lab',    credits: 1, hasLab: true },
      { key: 'scr',      code: 'BHS307',     label: 'Social Connect and Responsibility',                 alias: 'SCR',           credits: 1 },
      { key: 'pe',       code: 'BMNPHE309',  label: 'Physical Education',                                alias: 'PE',            credits: 0 },
    ],
    4: [
      { key: 'ada',      code: 'BCSPCC401',  label: 'Analysis and Design of Algorithms',                 alias: 'ADA',           credits: 4 },
      { key: 'advJava',  code: 'BCSPCC402',  label: 'Advanced Java',                                     alias: 'Adv. Java',     credits: 4 },
      { key: 'dbms',     code: 'BCSPCC403',  label: 'Database Management Systems',                        alias: 'DBMS',          credits: 4 },
      { key: 'dms',      code: 'BCSESC404A', label: 'Discrete Mathematical Structures and Graph Theory',  alias: 'DMS',           credits: 3 },
      { key: 'biology',  code: 'BBTBIO405',  label: 'Biology for Engineers',                             alias: 'Biology',       credits: 2 },
      { key: 'adaLab',   code: 'BCSPCL406',  label: 'Analysis And Design of Algorithms Lab',              alias: 'ADA Lab',       credits: 1, hasLab: true },
      { key: 'gitLab',   code: 'BCSAEC407A', label: 'Version Control with GIT-Lab',                       alias: 'Git Lab',       credits: 1, hasLab: true },
      { key: 'evs',      code: 'BHSENV408',  label: 'Environmental Studies',                             alias: 'EVS',           credits: 1 },
      { key: 'pe',       code: 'BMNPHE409',  label: 'Physical Education',                                alias: 'PE',            credits: 0 },
    ],
    5: [
      { key: 'cn',       code: 'BCS501',     label: 'Computer Networks',                                 alias: 'CN',            credits: 4 },
      { key: 'se',       code: 'BCS502',     label: 'Software Engineering & Project Management',         alias: 'SEPM',          credits: 4 },
      { key: 'wt',       code: 'BCS503',     label: 'Web Technology & its Applications',                 alias: 'Web Tech',      credits: 3 },
      { key: 'pe1',      code: 'BCSE504',    label: 'Professional Elective 1',                           alias: 'PE-1',          credits: 3 },
      { key: 'oe1',      code: 'BCSO505',    label: 'Open Elective 1',                                   alias: 'OE-1',          credits: 3 },
      { key: 'cnLab',    code: 'BCSL506',    label: 'Computer Networks Lab',                             alias: 'CN Lab',        credits: 1, hasLab: true },
      { key: 'wtLab',    code: 'BCSL507',    label: 'Web Technology Lab',                                alias: 'Web Lab',       credits: 1, hasLab: true },
      { key: 'pe',       code: 'BMNPHE509',  label: 'Physical Education',                                alias: 'PE',            credits: 0 },
    ],
    6: [
      { key: 'cd',       code: 'BCS601',     label: 'Compiler Design',                                   alias: 'Compiler',      credits: 4 },
      { key: 'cg',       code: 'BCS602',     label: 'Computer Graphics & Visualization',                 alias: 'Graphics',      credits: 4 },
      { key: 'st',       code: 'BCS603',     label: 'Software Testing',                                  alias: 'Testing',       credits: 3 },
      { key: 'pe2',      code: 'BCSE604',    label: 'Professional Elective 2',                           alias: 'PE-2',          credits: 3 },
      { key: 'oe2',      code: 'BCSO605',    label: 'Open Elective 2',                                   alias: 'OE-2',          credits: 3 },
      { key: 'miniProj', code: 'BCSMP606',    label: 'Mini Project',                                      alias: 'Mini Project',  credits: 2 },
      { key: 'stLab',    code: 'BCSL607',    label: 'Software Testing Lab',                              alias: 'Testing Lab',   credits: 1, hasLab: true },
      { key: 'pe',       code: 'BMNPHE609',  label: 'Physical Education',                                alias: 'PE',            credits: 0 },
    ]
  }
};

// Populate other branches with standard TEMPLATE subjects
for (const b of BRANCHES) {
  if (b.id === 'cs-ds') continue;
  DEFAULTS[b.id] = {};
  for (const sem of SEMESTERS) {
    DEFAULTS[b.id][sem] = JSON.parse(JSON.stringify(DEFAULTS['cs-ds'][sem]));
  }
}

async function seed() {
  console.log('Starting seed process via CommonJS...');
  const batch = writeBatch(db);

  for (const b of BRANCHES) {
    for (const sem of SEMESTERS) {
      const docId = `${b.id}_${sem}`;
      const docRef = doc(db, 'curriculum', docId);
      const subjects = DEFAULTS[b.id]?.[sem] || [];
      
      console.log(`Queueing curriculum for ${b.name} sem ${sem}...`);
      batch.set(docRef, {
        branch: b.id,
        semester: sem,
        subjects
      });
    }
  }

  await batch.commit();
  console.log('Seed completed successfully!');
}

seed().catch(err => {
  console.error('Seed failed:', err);
});
