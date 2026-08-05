// Predefined Curriculum Templates for BIET SGPA Calculator
// Used for quick autofill in Admin Curriculum Manager

const SEM1_PHYSICS = [
  { key: 'math1',   code: 'BMATE101',  label: 'Mathematics - I (Calculus & Linear Algebra)', alias: 'Math-I',    credits: 4 },
  { key: 'phy',     code: 'BPHYE102',  label: 'Engineering Physics',                          alias: 'Physics',   credits: 4 },
  { key: 'chem1',   code: 'BCHEE103',  label: 'Basic Electronics',                            alias: 'BE',        credits: 3 },
  { key: 'prog',    code: 'BPWSE104',  label: 'Problem Solving Using Python',                 alias: 'Python',    credits: 3 },
  { key: 'eng',     code: 'BESCK105',  label: 'Elements of Civil Engineering',                alias: 'ECE-1',     credits: 3 },
  { key: 'phyLab',  code: 'BPHYL106',  label: 'Engineering Physics Lab',                      alias: 'Physics Lab',credits: 1, hasLab: true },
  { key: 'progLab', code: 'BPWSL107',  label: 'Problem Solving Using Python Lab',             alias: 'Python Lab',credits: 1, hasLab: true },
  { key: 'ws',      code: 'BWSKS108',  label: 'Workshop / Mfg. Practice',                     alias: 'Workshop',  credits: 1 },
  { key: 'pe',      code: 'BMNPHE109', label: 'Physical Education',                           alias: 'PE',        credits: 0 },
];

const SEM2_CHEM = [
  { key: 'math2',   code: 'BMATE201',  label: 'Mathematics - II (Advanced Calculus)',         alias: 'Math-II',   credits: 4 },
  { key: 'chem',    code: 'BCHEE202',  label: 'Engineering Chemistry',                        alias: 'Chemistry', credits: 4 },
  { key: 'elec',    code: 'BELCE203',  label: 'Fundamentals of Electrical Engineering',       alias: 'FEE',       credits: 3 },
  { key: 'de',      code: 'BESCK204',  label: 'Design Engineering',                           alias: 'DE',        credits: 3 },
  { key: 'egdrg',   code: 'BEGCK205',  label: 'Engineering Drawing',                          alias: 'ED',        credits: 3 },
  { key: 'chemLab', code: 'BCHEML206', label: 'Engineering Chemistry Lab',                    alias: 'Chem Lab',  credits: 1, hasLab: true },
  { key: 'ws',      code: 'BWSKL207',  label: 'Workshop Practice Lab',                        alias: 'Workshop',  credits: 1, hasLab: true },
  { key: 'idp',     code: 'BIDPK208',  label: 'Innovative Design Practice',                   alias: 'IDP',       credits: 1 },
  { key: 'pe',      code: 'BMNPHE209', label: 'Physical Education',                           alias: 'PE',        credits: 0 },
];

const CS_DS_SEMS = {
  1: SEM1_PHYSICS,
  2: SEM2_CHEM,
  3: [
    { key: 'math3',   code: 'BCS301',    label: 'Mathematics for Computer Science',               alias: 'Math-III',  credits: 4 },
    { key: 'dsa',     code: 'BCS302',    label: 'Data Structures and Applications',               alias: 'DSA',       credits: 4 },
    { key: 'coa',     code: 'BCS303',    label: 'Computer Organization and Architecture',         alias: 'COA',       credits: 3 },
    { key: 'oops',    code: 'BCS304',    label: 'Object Oriented Programming with Java',          alias: 'Java/OOP',  credits: 3 },
    { key: 'dsaLab',  code: 'BCSL305',   label: 'Data Structures Lab',                            alias: 'DSA Lab',   credits: 1, hasLab: true },
    { key: 'scrLab',  code: 'BCS306',    label: 'Scripting Language Lab',                         alias: 'Python Lab',credits: 1, hasLab: true },
    { key: 'scr',     code: 'BHS307',    label: 'Social Connect and Responsibility',              alias: 'SCR',       credits: 1 },
    { key: 'pe',      code: 'BMNPHE309', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
  4: [
    { key: 'ada',     code: 'BCSPCC401', label: 'Analysis and Design of Algorithms (ADA)',            alias: 'ADA',       credits: 4 },
    { key: 'advJava', code: 'BCSPCC402', label: 'Advanced Java (Adv. Java)',                        alias: 'Adv. Java', credits: 4 },
    { key: 'dbms',    code: 'BCSPCC403', label: 'Database Management Systems (DBMS)',                  alias: 'DBMS',      credits: 4 },
    { key: 'dms',     code: 'BCSESC404A',label: 'Discrete Mathematical Structures & Graph Theory (DMS)',alias: 'DMS',     credits: 3 },
    { key: 'bio',     code: 'BBTBIO405', label: 'Biology for Engineers',                          alias: 'Biology',   credits: 2 },
    { key: 'adaLab',  code: 'BCSPCL406', label: 'Analysis and Design of Algorithms Lab (ADA-LAB)',    alias: 'ADA Lab',   credits: 1, hasLab: true },
    { key: 'gitLab',  code: 'BCSAEC407A',label: 'Version Control with GIT-Lab (GIT-Lab)',             alias: 'Git Lab',   credits: 1, hasLab: true },
    { key: 'evs',     code: 'BHSENV408', label: 'Environmental Studies (EVS)',                        alias: 'EVS',       credits: 1 },
    { key: 'pe',      code: 'BMNPHE409', label: 'Physical Education (PE)',                       alias: 'PE',        credits: 0 },
  ],
  5: [
    { key: 'cn',      code: 'BCS501',    label: 'Computer Networks',                              alias: 'CN',        credits: 4 },
    { key: 'se',      code: 'BCS502',    label: 'Software Engineering & Project Management',      alias: 'SEPM',      credits: 4 },
    { key: 'wt',      code: 'BCS503',    label: 'Web Technology & its Applications',              alias: 'Web Tech',  credits: 3 },
    { key: 'pe1',     code: 'BCSE504',   label: 'Professional Elective 1',                        alias: 'PE-1',      credits: 3 },
    { key: 'oe1',     code: 'BCSO505',   label: 'Open Elective 1',                               alias: 'OE-1',      credits: 3 },
    { key: 'cnLab',   code: 'BCSL506',   label: 'Computer Networks Lab',                          alias: 'CN Lab',    credits: 1, hasLab: true },
    { key: 'wtLab',   code: 'BCSL507',   label: 'Web Technology Lab',                             alias: 'Web Lab',   credits: 1, hasLab: true },
    { key: 'pe',      code: 'BMNPHE509', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
  6: [
    { key: 'cd',      code: 'BCS601',    label: 'Compiler Design',                               alias: 'Compiler',  credits: 4 },
    { key: 'cg',      code: 'BCS602',    label: 'Computer Graphics & Visualization',              alias: 'Graphics',  credits: 4 },
    { key: 'st',      code: 'BCS603',    label: 'Software Testing',                               alias: 'Testing',   credits: 3 },
    { key: 'pe2',     code: 'BCSE604',   label: 'Professional Elective 2',                        alias: 'PE-2',      credits: 3 },
    { key: 'oe2',     code: 'BCSO605',   label: 'Open Elective 2',                               alias: 'OE-2',      credits: 3 },
    { key: 'mini',    code: 'BCSMP606',  label: 'Mini Project',                                   alias: 'Mini Proj', credits: 2 },
    { key: 'stLab',   code: 'BCSL607',   label: 'Software Testing Lab',                           alias: 'Testing Lab',credits: 1, hasLab: true },
    { key: 'pe',      code: 'BMNPHE609', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
  7: [
    { key: 'ml',      code: 'BCS701',    label: 'Machine Learning',                               alias: 'ML',        credits: 4 },
    { key: 'ai',      code: 'BCS702',    label: 'Artificial Intelligence',                        alias: 'AI',        credits: 4 },
    { key: 'pe3',     code: 'BCSE703',   label: 'Professional Elective 3',                        alias: 'PE-3',      credits: 3 },
    { key: 'oe3',     code: 'BCSO704',   label: 'Open Elective 3',                               alias: 'OE-3',      credits: 3 },
    { key: 'proj',    code: 'BCSPR705',  label: 'Project Phase 1',                               alias: 'Project-1', credits: 4 },
    { key: 'intern',  code: 'BCSIT706',  label: 'Internship',                                    alias: 'Internship',credits: 2 },
    { key: 'pe',      code: 'BMNPHE709', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
  8: [
    { key: 'bigData', code: 'BCS801',    label: 'Big Data Analytics',                             alias: 'Big Data',  credits: 4 },
    { key: 'iot',     code: 'BCS802',    label: 'Internet of Things',                             alias: 'IoT',       credits: 4 },
    { key: 'pe4',     code: 'BCSE803',   label: 'Professional Elective 4',                        alias: 'PE-4',      credits: 3 },
    { key: 'projFin', code: 'BCSPR804',  label: 'Project Phase 2 (Final)',                        alias: 'Project-2', credits: 6 },
    { key: 'seminar', code: 'BCSSEM805', label: 'Technical Seminar',                              alias: 'Seminar',   credits: 1 },
    { key: 'pe',      code: 'BMNPHE809', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
};

const AIML_SEMS = {
  ...CS_DS_SEMS,
  4: [
    { key: 'ada',     code: 'BCSPCC401', label: 'Analysis & Design of Algorithms (ADA)',            alias: 'ADA',       credits: 4 },
    { key: 'ai',      code: 'BAIPCC402', label: 'Artificial Intelligence (AI)',                      alias: 'AI',        credits: 4 },
    { key: 'dbms',    code: 'BCSPCC403', label: 'Database Management Systems (DBMS)',                  alias: 'DBMS',      credits: 4 },
    { key: 'adaLab',  code: 'BCSPCL406', label: 'Analysis & Design of Algorithms Lab (ADA Lab)',      alias: 'ADA Lab',   credits: 1, hasLab: true },
    { key: 'la',      code: 'BSCESC404B',label: 'Linear Algebra (LA)',                               alias: 'LA',        credits: 3 },
    { key: 'daLab',   code: 'BAIAEC407D',label: 'Python for Data Analytics - Lab (Data Analytics Lab)',alias: 'Data Lab',  credits: 1, hasLab: true },
    { key: 'bio',     code: 'BBTBIO405', label: 'Biology for Computer Engineers',                    alias: 'Biology',   credits: 2 },
    { key: 'evs',     code: 'BHSENV408', label: 'Environmental Studies',                          alias: 'EVS',       credits: 1 },
    { key: 'pe',      code: 'BMNPHE409', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ]
};

const ECE_SEMS = {
  1: SEM1_PHYSICS, 2: SEM2_CHEM,
  3: [
    { key: 'nw',      code: 'BEC301',    label: 'Network Theory',                                 alias: 'Network',   credits: 4 },
    { key: 'edc',     code: 'BEC302',    label: 'Electronic Devices & Circuits',                  alias: 'EDC',       credits: 4 },
    { key: 'signals', code: 'BEC303',    label: 'Signals and Systems',                            alias: 'S&S',       credits: 3 },
    { key: 'dl',      code: 'BEC304',    label: 'Digital Logic Design',                           alias: 'DLD',       credits: 3 },
    { key: 'edcLab',  code: 'BECL305',   label: 'Electronic Devices & Circuits Lab',              alias: 'EDC Lab',   credits: 1, hasLab: true },
    { key: 'dlLab',   code: 'BECL306',   label: 'Digital Logic Design Lab',                       alias: 'DLD Lab',   credits: 1, hasLab: true },
    { key: 'scr',     code: 'BHS307',    label: 'Social Connect and Responsibility',              alias: 'SCR',       credits: 1 },
    { key: 'pe',      code: 'BMNPHE309', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
  4: [
    { key: 'emt',     code: 'BECPCC401', label: 'Electromagnetics Theory',                       alias: 'EMT',       credits: 4 },
    { key: 'pcs',     code: 'BECPCC402', label: 'Principles of Communication Systems',            alias: 'PCS',       credits: 4 },
    { key: 'cs',      code: 'BECPCC403', label: 'Control Systems',                               alias: 'CS',        credits: 4 },
    { key: 'mc',      code: 'BECESC404A',label: '8051 Microcontroller',                           alias: 'MC',        credits: 3 },
    { key: 'bio',     code: 'BBTBIO405', label: 'Biology for Engineers',                          alias: 'BIO',       credits: 2 },
    { key: 'cLab',    code: 'BECPCL406', label: 'Communication Lab',                            alias: 'C_LAB',     credits: 1, hasLab: true },
    { key: 'mcLab',   code: 'BECAEC407A',label: '8051 Microcontroller Lab',                       alias: 'MC_LAB',    credits: 1, hasLab: true },
    { key: 'evs',     code: 'BHSENV408', label: 'Environmental Studies',                          alias: 'EVS',       credits: 1 },
    { key: 'yoga',    code: 'BMNYOG409', label: 'Yoga',                                           alias: 'Yoga',      credits: 0 },
  ],
  5: [
    { key: 'dsp',     code: 'BEC501',    label: 'Digital Signal Processing',                      alias: 'DSP',       credits: 4 },
    { key: 'vlsi',    code: 'BEC502',    label: 'VLSI Design',                                    alias: 'VLSI',      credits: 4 },
    { key: 'emw',     code: 'BEC503',    label: 'Electromagnetic Waves',                          alias: 'EMW',       credits: 3 },
    { key: 'pe1',     code: 'BECE504',   label: 'Professional Elective 1',                        alias: 'PE-1',      credits: 3 },
    { key: 'oe1',     code: 'BECO505',   label: 'Open Elective 1',                               alias: 'OE-1',      credits: 3 },
    { key: 'dspLab',  code: 'BECL506',   label: 'DSP Lab',                                        alias: 'DSP Lab',   credits: 1, hasLab: true },
    { key: 'vLab',    code: 'BECL507',   label: 'VLSI Lab',                                       alias: 'VLSI Lab',  credits: 1, hasLab: true },
    { key: 'pe',      code: 'BMNPHE509', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
  6: [
    { key: 'antennas',code: 'BEC601',    label: 'Antennas & Propagation',                         alias: 'Antennas',  credits: 4 },
    { key: 'wireless',code: 'BEC602',    label: 'Wireless Communication',                         alias: 'Wireless',  credits: 4 },
    { key: 'pe2',     code: 'BECE603',   label: 'Professional Elective 2',                        alias: 'PE-2',      credits: 3 },
    { key: 'oe2',     code: 'BECO604',   label: 'Open Elective 2',                               alias: 'OE-2',      credits: 3 },
    { key: 'mini',    code: 'BECMP605',  label: 'Mini Project',                                   alias: 'Mini Proj', credits: 2 },
    { key: 'aLab',    code: 'BECL606',   label: 'Antenna & Propagation Lab',                      alias: 'Ant. Lab',  credits: 1, hasLab: true },
    { key: 'pe',      code: 'BMNPHE609', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
  7: [
    { key: 'emb',     code: 'BEC701',    label: 'Embedded Systems',                               alias: 'Embedded',  credits: 4 },
    { key: 'iot',     code: 'BEC702',    label: 'Internet of Things',                             alias: 'IoT',       credits: 4 },
    { key: 'pe3',     code: 'BECE703',   label: 'Professional Elective 3',                        alias: 'PE-3',      credits: 3 },
    { key: 'proj1',   code: 'BECPR704',  label: 'Project Phase 1',                               alias: 'Project-1', credits: 4 },
    { key: 'intern',  code: 'BECIT705',  label: 'Internship',                                    alias: 'Internship',credits: 2 },
    { key: 'pe',      code: 'BMNPHE709', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
  8: [
    { key: 'radar',   code: 'BEC801',    label: 'Radar & Navigation Systems',                     alias: 'Radar',     credits: 4 },
    { key: 'pe4',     code: 'BECE802',   label: 'Professional Elective 4',                        alias: 'PE-4',      credits: 3 },
    { key: 'proj2',   code: 'BECPR803',  label: 'Project Phase 2 (Final)',                        alias: 'Project-2', credits: 6 },
    { key: 'seminar', code: 'BECSEM804', label: 'Technical Seminar',                              alias: 'Seminar',   credits: 1 },
    { key: 'pe',      code: 'BMNPHE809', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
};

const ME_SEMS = {
  1: SEM1_PHYSICS, 2: SEM2_CHEM,
  3: [
    { key: 'mat',     code: 'BME301',    label: 'Material Science',                               alias: 'MatSci',    credits: 4 },
    { key: 'tom',     code: 'BME302',    label: 'Theory of Machines',                             alias: 'TOM',       credits: 4 },
    { key: 'fluid',   code: 'BME303',    label: 'Fluid Mechanics',                               alias: 'FM',        credits: 3 },
    { key: 'mfg',     code: 'BME304',    label: 'Manufacturing Process - I',                      alias: 'Mfg-I',     credits: 3 },
    { key: 'mLab',    code: 'BMEL305',   label: 'Manufacturing Lab',                              alias: 'Mfg Lab',   credits: 1, hasLab: true },
    { key: 'cad',     code: 'BMEL306',   label: 'CAD/CAM Lab',                                    alias: 'CAD Lab',   credits: 1, hasLab: true },
    { key: 'scr',     code: 'BHS307',    label: 'Social Connect and Responsibility',              alias: 'SCR',       credits: 1 },
    { key: 'pe',      code: 'BMNPHE309', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
  4: [
    { key: 'hmt',     code: 'BME401',    label: 'Heat & Mass Transfer',                           alias: 'HMT',       credits: 4 },
    { key: 'str',     code: 'BME402',    label: 'Strength of Materials',                          alias: 'SOM',       credits: 4 },
    { key: 'md',      code: 'BME403',    label: 'Machine Design',                               alias: 'MD',        credits: 4 },
    { key: 'mfg2',    code: 'BME404',    label: 'Manufacturing Process - II',                     alias: 'Mfg-II',    credits: 3 },
    { key: 'bio',     code: 'BBTBIO405', label: 'Biology for Engineers',                          alias: 'Biology',   credits: 2 },
    { key: 'mdLab',   code: 'BMEL406',   label: 'Machine Design Lab',                             alias: 'MD Lab',    credits: 1, hasLab: true },
    { key: 'mfgLab',  code: 'BMEL407',   label: 'Manufacturing Lab - II',                         alias: 'Mfg Lab-II',credits: 1, hasLab: true },
    { key: 'evs',     code: 'BHSENV408', label: 'Environmental Studies',                          alias: 'EVS',       credits: 1 },
    { key: 'pe',      code: 'BMNPHE409', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
  5: [
    { key: 'turbo',   code: 'BME501',    label: 'Turbomachinery',                                 alias: 'Turbo',     credits: 4 },
    { key: 'ic',      code: 'BME502',    label: 'IC Engines',                                     alias: 'IC Eng',    credits: 4 },
    { key: 'fe',      code: 'BME503',    label: 'Finite Element Analysis',                        alias: 'FEA',       credits: 3 },
    { key: 'pe1',     code: 'BMEE504',   label: 'Professional Elective 1',                        alias: 'PE-1',      credits: 3 },
    { key: 'oe1',     code: 'BMEO505',   label: 'Open Elective 1',                               alias: 'OE-1',      credits: 3 },
    { key: 'tLab',    code: 'BMEL506',   label: 'Turbomachinery Lab',                             alias: 'Turbo Lab', credits: 1, hasLab: true },
    { key: 'icLab',   code: 'BMEL507',   label: 'IC Engines Lab',                                 alias: 'IC Lab',    credits: 1, hasLab: true },
    { key: 'pe',      code: 'BMNPHE509', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
  6: [
    { key: 'ref',     code: 'BME601',    label: 'Refrigeration & Air Conditioning',               alias: 'RAC',       credits: 4 },
    { key: 'prod',    code: 'BME602',    label: 'Production Management',                          alias: 'Prod Mgmt', credits: 3 },
    { key: 'pe2',     code: 'BMEE603',   label: 'Professional Elective 2',                        alias: 'PE-2',      credits: 3 },
    { key: 'oe2',     code: 'BMEO604',   label: 'Open Elective 2',                               alias: 'OE-2',      credits: 3 },
    { key: 'mini',    code: 'BMEMP605',  label: 'Mini Project',                                   alias: 'Mini Proj', credits: 2 },
    { key: 'racLab',  code: 'BMEL606',   label: 'RAC Lab',                                        alias: 'RAC Lab',   credits: 1, hasLab: true },
    { key: 'pe',      code: 'BMNPHE609', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
  7: [
    { key: 'rob',     code: 'BME701',    label: 'Robotics & Automation',                          alias: 'Robotics',  credits: 4 },
    { key: 'pe3',     code: 'BMEE702',   label: 'Professional Elective 3',                        alias: 'PE-3',      credits: 3 },
    { key: 'proj1',   code: 'BMEPR703',  label: 'Project Phase 1',                               alias: 'Project-1', credits: 4 },
    { key: 'intern',  code: 'BMEIT704',  label: 'Internship',                                    alias: 'Internship',credits: 2 },
    { key: 'pe',      code: 'BMNPHE709', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
  8: [
    { key: 'pe4',     code: 'BMEE801',   label: 'Professional Elective 4',                        alias: 'PE-4',      credits: 3 },
    { key: 'proj2',   code: 'BMEPR802',  label: 'Project Phase 2 (Final)',                        alias: 'Project-2', credits: 6 },
    { key: 'seminar', code: 'BMESEM803', label: 'Technical Seminar',                              alias: 'Seminar',   credits: 1 },
    { key: 'pe',      code: 'BMNPHE809', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
};

const CIVIL_SEMS = {
  1: SEM1_PHYSICS, 2: SEM2_CHEM,
  3: [
    { key: 'sm',      code: 'BCV301',    label: 'Structural Mechanics',                           alias: 'Struct. Mech',credits: 4 },
    { key: 'fluid',   code: 'BCV302',    label: 'Fluid Mechanics',                               alias: 'FM',        credits: 4 },
    { key: 'survey',  code: 'BCV303',    label: 'Surveying',                                      alias: 'Survey',    credits: 3 },
    { key: 'build',   code: 'BCV304',    label: 'Building Materials & Construction',              alias: 'BMC',       credits: 3 },
    { key: 'sLab',    code: 'BCVL305',   label: 'Surveying Lab',                                  alias: 'Survey Lab',credits: 1, hasLab: true },
    { key: 'fLab',    code: 'BCVL306',   label: 'Fluid Mechanics Lab',                            alias: 'FM Lab',    credits: 1, hasLab: true },
    { key: 'scr',     code: 'BHS307',    label: 'Social Connect and Responsibility',              alias: 'SCR',       credits: 1 },
    { key: 'pe',      code: 'BMNPHE309', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
  4: [
    { key: 'rcc',     code: 'BCV401',    label: 'Design of RCC Structures',                       alias: 'RCC',       credits: 4 },
    { key: 'geo',     code: 'BCV402',    label: 'Geotechnical Engineering',                       alias: 'Geo Eng',   credits: 4 },
    { key: 'trans',   code: 'BCV403',    label: 'Transportation Engineering',                     alias: 'Trans Eng', credits: 4 },
    { key: 'envEng',  code: 'BCV404',    label: 'Environmental Engineering',                      alias: 'Env Eng',   credits: 3 },
    { key: 'bio',     code: 'BBTBIO405', label: 'Biology for Engineers',                          alias: 'Biology',   credits: 2 },
    { key: 'geoLab',  code: 'BCVL406',   label: 'Geotechnical Lab',                               alias: 'Geo Lab',   credits: 1, hasLab: true },
    { key: 'transLab',code: 'BCVL407',   label: 'Transportation Engg Lab',                        alias: 'Trans Lab', credits: 1, hasLab: true },
    { key: 'evs',     code: 'BHSENV408', label: 'Environmental Studies',                          alias: 'EVS',       credits: 1 },
    { key: 'pe',      code: 'BMNPHE409', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
  5: [
    { key: 'prestress',code: 'BCV501',   label: 'Prestressed Concrete Structures',                alias: 'PSC',       credits: 4 },
    { key: 'hydro',   code: 'BCV502',    label: 'Hydraulics & Water Resources',                   alias: 'Hydro',     credits: 4 },
    { key: 'pe1',     code: 'BCVE503',   label: 'Professional Elective 1',                        alias: 'PE-1',      credits: 3 },
    { key: 'oe1',     code: 'BCVO504',   label: 'Open Elective 1',                               alias: 'OE-1',      credits: 3 },
    { key: 'compre',  code: 'BCV505',    label: 'Comprehension / MOOC',                           alias: 'MOOC',      credits: 2 },
    { key: 'conLab',  code: 'BCVL506',   label: 'Concrete Technology Lab',                        alias: 'Conc Lab',  credits: 1, hasLab: true },
    { key: 'hydLab',  code: 'BCVL507',   label: 'Hydraulics Lab',                                 alias: 'Hydro Lab', credits: 1, hasLab: true },
    { key: 'pe',      code: 'BMNPHE509', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
  6: [
    { key: 'pm',      code: 'BCV601',    label: 'Project Management & Entrepreneurship',          alias: 'PM&E',      credits: 3 },
    { key: 'pe2',     code: 'BCVE602',   label: 'Professional Elective 2',                        alias: 'PE-2',      credits: 3 },
    { key: 'oe2',     code: 'BCVO603',   label: 'Open Elective 2',                               alias: 'OE-2',      credits: 3 },
    { key: 'mini',    code: 'BCVMP604',  label: 'Mini Project',                                   alias: 'Mini Proj', credits: 2 },
    { key: 'drawLab', code: 'BCVL605',   label: 'Building Drawing Lab',                           alias: 'Drawing Lab',credits: 1, hasLab: true },
    { key: 'pe',      code: 'BMNPHE609', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
  7: [
    { key: 'found',   code: 'BCV701',    label: 'Foundation Engineering',                         alias: 'Found Eng', credits: 4 },
    { key: 'pe3',     code: 'BCVE702',   label: 'Professional Elective 3',                        alias: 'PE-3',      credits: 3 },
    { key: 'proj1',   code: 'BCVPR703',  label: 'Project Phase 1',                               alias: 'Project-1', credits: 4 },
    { key: 'intern',  code: 'BCVIT704',  label: 'Internship',                                    alias: 'Internship',credits: 2 },
    { key: 'pe',      code: 'BMNPHE709', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
  8: [
    { key: 'pe4',     code: 'BCVE801',   label: 'Professional Elective 4',                        alias: 'PE-4',      credits: 3 },
    { key: 'proj2',   code: 'BCVPR802',  label: 'Project Phase 2 (Final)',                        alias: 'Project-2', credits: 6 },
    { key: 'seminar', code: 'BCVSEM803', label: 'Technical Seminar',                              alias: 'Seminar',   credits: 1 },
    { key: 'pe',      code: 'BMNPHE809', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
};

const TEXTILE_SEMS = {
  1: SEM1_PHYSICS, 2: SEM2_CHEM,
  3: [
    { key: 'yarn',    code: 'BTX301',    label: 'Yarn Manufacture - I',                           alias: 'Yarn-I',    credits: 4 },
    { key: 'fabric',  code: 'BTX302',    label: 'Fabric Manufacture - I',                         alias: 'Fabric-I',  credits: 4 },
    { key: 'tChem',   code: 'BTX303',    label: 'Textile Chemistry',                              alias: 'Tex Chem',  credits: 3 },
    { key: 'mech',    code: 'BTX304',    label: 'Mechanics of Textile Machinery',                  alias: 'Tex Mech',  credits: 3 },
    { key: 'yarnLab', code: 'BTXL305',   label: 'Yarn Manufacture Lab',                           alias: 'Yarn Lab',  credits: 1, hasLab: true },
    { key: 'fabLab',  code: 'BTXL306',   label: 'Fabric Manufacture Lab',                         alias: 'Fabric Lab',credits: 1, hasLab: true },
    { key: 'scr',     code: 'BHS307',    label: 'Social Connect and Responsibility',              alias: 'SCR',       credits: 1 },
    { key: 'pe',      code: 'BMNPHE309', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
  4: [
    { key: 'yarn2',   code: 'BTX401',    label: 'Yarn Manufacture - II',                          alias: 'Yarn-II',   credits: 4 },
    { key: 'fabric2', code: 'BTX402',    label: 'Fabric Manufacture - II',                        alias: 'Fabric-II', credits: 4 },
    { key: 'dyeing',  code: 'BTX403',    label: 'Textile Wet Processing',                         alias: 'Dyeing',    credits: 4 },
    { key: 'testing', code: 'BTX404',    label: 'Textile Testing & Quality Control',              alias: 'Testing',   credits: 3 },
    { key: 'bio',     code: 'BBTBIO405', label: 'Biology for Engineers',                          alias: 'Biology',   credits: 2 },
    { key: 'dyeLab',  code: 'BTXL406',   label: 'Wet Processing Lab',                             alias: 'Dye Lab',   credits: 1, hasLab: true },
    { key: 'testLab', code: 'BTXL407',   label: 'Textile Testing Lab',                            alias: 'Test Lab',  credits: 1, hasLab: true },
    { key: 'evs',     code: 'BHSENV408', label: 'Environmental Studies',                          alias: 'EVS',       credits: 1 },
    { key: 'pe',      code: 'BMNPHE409', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
  5: [
    { key: 'garment', code: 'BTX501',    label: 'Garment Technology',                             alias: 'Garment',   credits: 4 },
    { key: 'manmade', code: 'BTX502',    label: 'Man-Made Fibres',                                alias: 'MMF',       credits: 4 },
    { key: 'pe1',     code: 'BTXE503',   label: 'Professional Elective 1',                        alias: 'PE-1',      credits: 3 },
    { key: 'oe1',     code: 'BTXO504',   label: 'Open Elective 1',                               alias: 'OE-1',      credits: 3 },
    { key: 'gLab',    code: 'BTXL505',   label: 'Garment Lab',                                    alias: 'Garment Lab',credits: 1, hasLab: true },
    { key: 'mmLab',   code: 'BTXL506',   label: 'Man-Made Fibres Lab',                            alias: 'MMF Lab',   credits: 1, hasLab: true },
    { key: 'pe',      code: 'BMNPHE509', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
  6: [
    { key: 'nonWoven',code: 'BTX601',    label: 'Non-Woven Technology',                           alias: 'Non-Woven', credits: 4 },
    { key: 'pe2',     code: 'BTXE602',   label: 'Professional Elective 2',                        alias: 'PE-2',      credits: 3 },
    { key: 'oe2',     code: 'BTXO603',   label: 'Open Elective 2',                               alias: 'OE-2',      credits: 3 },
    { key: 'mini',    code: 'BTXMP604',  label: 'Mini Project',                                   alias: 'Mini Proj', credits: 2 },
    { key: 'nvLab',   code: 'BTXL605',   label: 'Non-Woven Lab',                                  alias: 'NW Lab',    credits: 1, hasLab: true },
    { key: 'pe',      code: 'BMNPHE609', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
  7: [
    { key: 'techTex', code: 'BTX701',    label: 'Technical Textiles',                             alias: 'Tech Tex',  credits: 4 },
    { key: 'pe3',     code: 'BTXE702',   label: 'Professional Elective 3',                        alias: 'PE-3',      credits: 3 },
    { key: 'proj1',   code: 'BTXPR703',  label: 'Project Phase 1',                               alias: 'Project-1', credits: 4 },
    { key: 'intern',  code: 'BTXIT704',  label: 'Internship',                                    alias: 'Internship',credits: 2 },
    { key: 'pe',      code: 'BMNPHE709', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
  8: [
    { key: 'pe4',     code: 'BTXE801',   label: 'Professional Elective 4',                        alias: 'PE-4',      credits: 3 },
    { key: 'proj2',   code: 'BTXPR802',  label: 'Project Phase 2 (Final)',                        alias: 'Project-2', credits: 6 },
    { key: 'seminar', code: 'BTXSEM803', label: 'Technical Seminar',                              alias: 'Seminar',   credits: 1 },
    { key: 'pe',      code: 'BMNPHE809', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
};

const EEE_SEMS = {
  1: SEM1_PHYSICS, 2: SEM2_CHEM,
  3: [
    { key: 'circuits',code: 'BEE301',    label: 'Electrical Circuit Analysis',                    alias: 'Circuits',  credits: 4 },
    { key: 'emach',   code: 'BEE302',    label: 'Electrical Machines - I',                        alias: 'EM-I',      credits: 4 },
    { key: 'meas',    code: 'BEE303',    label: 'Electrical Measurements',                        alias: 'Measurements',credits: 3 },
    { key: 'cont',    code: 'BEE304',    label: 'Control Engineering',                            alias: 'Control',   credits: 3 },
    { key: 'emLab',   code: 'BEEL305',   label: 'Electrical Machines Lab',                        alias: 'EM Lab',    credits: 1, hasLab: true },
    { key: 'measLab', code: 'BEEL306',   label: 'Measurements Lab',                               alias: 'Meas Lab',  credits: 1, hasLab: true },
    { key: 'scr',     code: 'BHS307',    label: 'Social Connect and Responsibility',              alias: 'SCR',       credits: 1 },
    { key: 'pe',      code: 'BMNPHE309', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
  4: [
    { key: 'em2',     code: 'BEE401',    label: 'Electrical Machines - II',                       alias: 'EM-II',     credits: 4 },
    { key: 'power',   code: 'BEE402',    label: 'Power Systems - I',                              alias: 'Power-I',   credits: 4 },
    { key: 'pe_syst', code: 'BEE403',    label: 'Power Electronics',                              alias: 'Power Elec',credits: 4 },
    { key: 'sig',     code: 'BEE404',    label: 'Signals & Systems',                             alias: 'S&S',       credits: 3 },
    { key: 'bio',     code: 'BBTBIO405', label: 'Biology for Engineers',                          alias: 'Biology',   credits: 2 },
    { key: 'em2Lab',  code: 'BEEL406',   label: 'Electrical Machines Lab - II',                   alias: 'EM Lab-II', credits: 1, hasLab: true },
    { key: 'peLab',   code: 'BEEL407',   label: 'Power Electronics Lab',                          alias: 'PE Lab',    credits: 1, hasLab: true },
    { key: 'evs',     code: 'BHSENV408', label: 'Environmental Studies',                          alias: 'EVS',       credits: 1 },
    { key: 'pe',      code: 'BMNPHE409', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
  5: [
    { key: 'ps2',     code: 'BEE501',    label: 'Power Systems - II',                             alias: 'Power-II',  credits: 4 },
    { key: 'drives',  code: 'BEE502',    label: 'Electrical Drives',                              alias: 'Drives',    credits: 4 },
    { key: 'pe1',     code: 'BEEE503',   label: 'Professional Elective 1',                        alias: 'PE-1',      credits: 3 },
    { key: 'oe1',     code: 'BEEO504',   label: 'Open Elective 1',                               alias: 'OE-1',      credits: 3 },
    { key: 'psLab',   code: 'BEEL505',   label: 'Power Systems Lab',                              alias: 'PS Lab',    credits: 1, hasLab: true },
    { key: 'dLab',    code: 'BEEL506',   label: 'Drives Lab',                                     alias: 'Drives Lab',credits: 1, hasLab: true },
    { key: 'pe',      code: 'BMNPHE509', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
  6: [
    { key: 'utilz',   code: 'BEE601',    label: 'Utilisation of Electrical Energy',               alias: 'Utilization',credits: 3 },
    { key: 'pe2',     code: 'BEEE602',   label: 'Professional Elective 2',                        alias: 'PE-2',      credits: 3 },
    { key: 'oe2',     code: 'BEEO603',   label: 'Open Elective 2',                               alias: 'OE-2',      credits: 3 },
    { key: 'mini',    code: 'BEEMP604',  label: 'Mini Project',                                   alias: 'Mini Proj', credits: 2 },
    { key: 'simLab',  code: 'BEEL605',   label: 'Simulation Lab',                                 alias: 'Sim Lab',   credits: 1, hasLab: true },
    { key: 'pe',      code: 'BMNPHE609', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
  7: [
    { key: 're',      code: 'BEE701',    label: 'Renewable Energy Systems',                       alias: 'Renew Eng', credits: 4 },
    { key: 'pe3',     code: 'BEEE702',   label: 'Professional Elective 3',                        alias: 'PE-3',      credits: 3 },
    { key: 'proj1',   code: 'BEEPR703',  label: 'Project Phase 1',                               alias: 'Project-1', credits: 4 },
    { key: 'intern',  code: 'BEEIT704',  label: 'Internship',                                    alias: 'Internship',credits: 2 },
    { key: 'pe',      code: 'BMNPHE709', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
  8: [
    { key: 'pe4',     code: 'BEEE801',   label: 'Professional Elective 4',                        alias: 'PE-4',      credits: 3 },
    { key: 'proj2',   code: 'BEEPR802',  label: 'Project Phase 2 (Final)',                        alias: 'Project-2', credits: 6 },
    { key: 'seminar', code: 'BEESEM803', label: 'Technical Seminar',                              alias: 'Seminar',   credits: 1 },
    { key: 'pe',      code: 'BMNPHE809', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
  ],
};

const TEMPLATE_MAP = {
  'cs-ds': CS_DS_SEMS,
  'cse':   CS_DS_SEMS,
  'aiml':  AIML_SEMS,
  'ise':   CS_DS_SEMS,
  'csd':   CS_DS_SEMS,
  'csbs':  CS_DS_SEMS,
  'ece':   ECE_SEMS,
  'eie':   ECE_SEMS,
  'vlsi':  ECE_SEMS,
  'eee':   EEE_SEMS,
  'me':    ME_SEMS,
  'auto':  ME_SEMS,
  'ipe':   ME_SEMS,
  'cv':    CIVIL_SEMS,
  'et':    CIVIL_SEMS,
  'tx':    TEXTILE_SEMS,
  'txd':   TEXTILE_SEMS,
  'bt':    CS_DS_SEMS,
  'ch':    ME_SEMS,
};

export function getPredefinedCurriculum(branch, semester) {
  const branchMap = TEMPLATE_MAP[branch] || CS_DS_SEMS;
  return branchMap[Number(semester)] || [];
}

export const EXPLICIT_TEMPLATES = [
  { id: 'current', label: '⭐ Selected Branch & Semester Default' },
  { id: 'phy_cycle', label: 'Physics Cycle (1st Sem)' },
  { id: 'chem_cycle', label: 'Chemistry Cycle (2nd Sem)' },
  { id: 'cs_ds_4', label: 'Computer Science / DS / ISE - 4th Sem' },
  { id: 'aiml_4', label: 'AI & Machine Learning (AIML) - 4th Sem' },
  { id: 'ece_4', label: 'Electronics & Communication (ECE) - 4th Sem' },
  { id: 'me_4', label: 'Mechanical Engineering - 4th Sem' },
  { id: 'cv_4', label: 'Civil Engineering - 4th Sem' },
  { id: 'tx_4', label: 'Textile Technology - 4th Sem' },
];

export function getExplicitTemplateSubjects(templateId, currentBranch, currentSem) {
  switch (templateId) {
    case 'current':
      return getPredefinedCurriculum(currentBranch, currentSem);
    case 'phy_cycle':
      return SEM1_PHYSICS;
    case 'chem_cycle':
      return SEM2_CHEM;
    case 'cs_ds_4':
      return CS_DS_SEMS[4];
    case 'aiml_4':
      return AIML_SEMS[4];
    case 'ece_4':
      return ECE_SEMS[4];
    case 'me_4':
      return ME_SEMS[4];
    case 'cv_4':
      return CIVIL_SEMS[4];
    case 'tx_4':
      return TEXTILE_SEMS[4];
    default:
      return [];
  }
}
