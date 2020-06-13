const express = require('express')
const Router = require('express').Router
const Request = require('express').Request

const pg = require('pg')

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}


const connectionName =
  process.env.INSTANCE_CONNECTION_NAME || 'openousd:us-central1:openousd-staging'
const dbUser = process.env.SQL_USER
const dbPassword = process.env.SQL_PASSWORD
const dbName = process.env.SQL_NAME
const dbHost = process.env.SQL_HOST || `/cloudsql/${connectionName}`

const pgConfig = {
  max: 1,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  host: dbHost
}

// This specifies that numeric types in PostgreSQL
// should be conversted to floats in js
// https://github.com/brianc/node-pg-types/issues/28
var types = require('pg').types
types.setTypeParser(1700, 'text', parseFloat)


// Connection pools reuse connections between invocations,
// and handle dropped or expired connections automatically.
let pgPool

if (!pgPool) {
        pgPool = new pg.Pool(pgConfig)
}

const router = Router()

router.get('/central-programs', async (req, res, next) => {

    var year = 2018

    if("year" in req.query) {
        year = req.query.year
    }

    var includeStaffRoles = true

    var centralProgramsQuery = `SELECT p.*,
                  staff.sum_fte as eoy_total_staff,
                  ROUND((1-(p.spending/NULLIF(p.budget,0)))*100,1) as remaining_budget_percent
                  FROM
                    (SELECT e.site_code as code, s.description as name, s.category,
                      SUM(e.ytd_actual) as spending,
                      SUM(e.budget) as budget,
                      e.year
                      FROM expenditures e
                      LEFT JOIN sites s ON e.site_code = s.code
                      WHERE e.site_code >= 900
                      AND e.site_code != 998
                      AND e.year = ${year}
                      GROUP BY e.site_code, s.description, e.year, s.category
                      HAVING SUM(e.ytd_actual) >= 0) p
                    LEFT JOIN (SELECT st.site_code, SUM(fte) as sum_fte
                      FROM
                        (SELECT position_id, MAX(assignment_id) as max_assignment
                        from staffing
                        GROUP BY position_id) m,
                        staffing st
                      WHERE m.position_id = st.position_id
                      AND m.max_assignment = st.assignment_id
                      GROUP BY st.site_code) staff ON p.code = staff.site_code
                  ORDER BY p.name`

    var staffRolesQuery = `SELECT st.site_code, st.job_class_description, CAST(COUNT(*) AS INT)
                            FROM
                                (SELECT position_id, MAX(assignment_id) as max_assignment
                                FROM staffing
                                 WHERE year = ${year}
                                GROUP BY position_id) m,
                            staffing st
                            WHERE m.position_id = st.position_id
                            AND m.max_assignment = st.assignment_id
                            AND st.site_code >= 900
                            AND year = ${year}
                            GROUP BY st.site_code, st.job_class_description`

    try {
        var programs = await pgPool.query(centralProgramsQuery)
        programs = programs.rows
        var staffRoles
        var rolesGroupedByProgram = {}

        if(includeStaffRoles) {
            var allStaffRoles = await pgPool.query(staffRolesQuery)
            staffRoles = allStaffRoles.rows
            // staffRoles = [{"code":936,"name":"Accounting","category":"Financial Operations","spending":1740442.23,"budget":1720738.16,"year":2018,"eoy_total_staff":11.4,"remaining_budget_percent":-1.1,"staff_roles":[{"job_class_description":"Controller","count":1},{"job_class_description":"Financial Accountant I","count":1},{"job_class_description":"Financial Accountant III","count":6},{"job_class_description":"Manager Program Accounting","count":2},{"job_class_description":"Mgr Central Office Accounting","count":1},{"job_class_description":"Office Manager II Confidential","count":1},{"job_class_description":"Receptionist","count":1},{"job_class_description":"Senior Computer Operator","count":1}]},{"code":902,"name":"Accounts Payable","category":"Financial Operations","spending":765519.5,"budget":734049.38,"year":2018,"eoy_total_staff":7,"remaining_budget_percent":-4.3,"staff_roles":[{"job_class_description":"Accounts Payable Technician II","count":5},{"job_class_description":"Director Accounts Payable","count":1},{"job_class_description":"Manager Accounts Payable","count":1}]},{"code":940,"name":"Board Of Education","category":"Administrative Offices","spending":763126.04,"budget":810055,"year":2018,"eoy_total_staff":10,"remaining_budget_percent":5.8,"staff_roles":[{"job_class_description":"Admin Coordinator Board of Edu","count":2},{"job_class_description":"Board Member","count":7},{"job_class_description":"Executive Assistant Board","count":1}]},{"code":951,"name":"Budget","category":"Financial Operations","spending":2515366.92,"budget":2662185.57,"year":2018,"eoy_total_staff":20.9,"remaining_budget_percent":5.5,"staff_roles":[{"job_class_description":"Administrative Assistant III","count":1},{"job_class_description":"Business Process Administrator","count":1},{"job_class_description":"Financial Analyst","count":15},{"job_class_description":"Financial Officer Budget Devel","count":2},{"job_class_description":"Financial Services Associate I","count":1},{"job_class_description":"Fin Svc Dir Budget Development","count":1},{"job_class_description":"Fin Svc Director Ops Reporting","count":1},{"job_class_description":"Receptionist","count":1},{"job_class_description":"Sr Dir Strategic Projects","count":1},{"job_class_description":"Sr. Executive Director Budget","count":1},{"job_class_description":"Sr Financial Analyst","count":1}]},{"code":988,"name":"Buildings & Grounds","category":"Facilities","spending":20215328.04,"budget":20529279.12,"year":2018,"eoy_total_staff":100,"remaining_budget_percent":1.5,"staff_roles":[{"job_class_description":"Administrative Assistant I","count":1},{"job_class_description":"Auto Mechanic","count":2},{"job_class_description":"Business Mgr Central Office","count":1},{"job_class_description":"Carpenter","count":11},{"job_class_description":"Coordinator Buildings/Grounds","count":1},{"job_class_description":"Director Buildings & Grounds","count":1},{"job_class_description":"Electrician","count":7},{"job_class_description":"Equipment Operator","count":1},{"job_class_description":"Financial Accountant II","count":1},{"job_class_description":"Gardener","count":10},{"job_class_description":"Glazier","count":2},{"job_class_description":"Lead Carpenter","count":1},{"job_class_description":"Lead Electrician","count":1},{"job_class_description":"Lead Gardener","count":1},{"job_class_description":"Lead Locksmith","count":1},{"job_class_description":"Lead Painter","count":1},{"job_class_description":"Lead Plumber & Irrigation","count":1},{"job_class_description":"Lead Steamfitter","count":1},{"job_class_description":"Locksmith","count":3},{"job_class_description":"Maintenance Control Specialist","count":1},{"job_class_description":"Manager Buildings & Grounds","count":6},{"job_class_description":"Painter","count":12},{"job_class_description":"Plumber","count":8},{"job_class_description":"Roofer","count":4},{"job_class_description":"Sheetmetal Worker","count":2},{"job_class_description":"Skilled Laborer","count":6},{"job_class_description":"Steamfitter","count":6},{"job_class_description":"Technician Alarm","count":3},{"job_class_description":"Technician Telecommunications","count":4}]},{"code":947,"name":"Charter Schools Office (Admin)","category":"Administrative Offices","spending":823544.88,"budget":1069793,"year":2018,"eoy_total_staff":5,"remaining_budget_percent":23,"staff_roles":[{"job_class_description":"Analytics Spec Chart Sch","count":1},{"job_class_description":"Director Qual Divers Providers","count":1},{"job_class_description":"Finan Acct Tech Rcvble/Billing","count":1},{"job_class_description":"Mgr Charter School Accounting","count":1},{"job_class_description":"Specialist Charter School Comp","count":1}]},{"code":980,"name":"Chief Financial Officer","category":"Administrative Offices","spending":1043900.65,"budget":1173543.91,"year":2018,"eoy_total_staff":1,"remaining_budget_percent":11,"staff_roles":[{"job_class_description":"Chief Financial Officer","count":1}]},{"code":913,"name":"Chief Of Operations","category":"Administrative Offices","spending":65246,"budget":65246.39,"year":2018,"eoy_total_staff":4,"remaining_budget_percent":0,"staff_roles":[{"job_class_description":"Business Process Administrator","count":1},{"job_class_description":"Coordinator Classified","count":1},{"job_class_description":"Dir Organization Effectiveness","count":1},{"job_class_description":"Project Manager","count":1}]},{"code":901,"name":"Chief Of Staff","category":"Administrative Offices","spending":1324555.57,"budget":1351792.38,"year":2018,"eoy_total_staff":5,"remaining_budget_percent":2,"staff_roles":[{"job_class_description":"Chief of Staff","count":1},{"job_class_description":"Coordinator Classified","count":2},{"job_class_description":"Dir AA Girls & Young Women Ach","count":1},{"job_class_description":"Exec Dir Org Effectiveness","count":1},{"job_class_description":"Ombudsperson","count":1}]},{"code":958,"name":"Communications","category":"Other Operations","spending":2115962.37,"budget":2373031.76,"year":2018,"eoy_total_staff":18.45,"remaining_budget_percent":10.8,"staff_roles":[{"job_class_description":"Classroom TSA 10 Months","count":1},{"job_class_description":"Dep Chief Commun & Pub Affairs","count":1},{"job_class_description":"Director Communications","count":1},{"job_class_description":"Director Community Engagement","count":1},{"job_class_description":"Manager KDOL Educational TV","count":1},{"job_class_description":"Mgr Publications","count":3},{"job_class_description":"Operations Engineer","count":1},{"job_class_description":"Prg Mgr Local Cntrl Acct Engag","count":1},{"job_class_description":"Producer","count":1},{"job_class_description":"Prog Mgr Translation Services","count":1},{"job_class_description":"Specialist Translator - Arabic","count":1},{"job_class_description":"Specialist Translator-Cambodia","count":1},{"job_class_description":"Specialist Translator-Chinese","count":2},{"job_class_description":"SpecialistTranslator-Spanish","count":4},{"job_class_description":"Specialist Translator-Vietname","count":2},{"job_class_description":"Video Technician","count":1}]},{"code":922,"name":"Community Schools & Student Services","category":"Student Services","spending":16666577.59,"budget":19033069.22,"year":2018,"eoy_total_staff":118.634,"remaining_budget_percent":12.4,"staff_roles":[{"job_class_description":"Administrative Assistant III","count":4},{"job_class_description":"Administrative Assist I Bil","count":1},{"job_class_description":"Asst Ombudsperson Intake Bill","count":1},{"job_class_description":"Case Manager 20","count":6},{"job_class_description":"Case Manager 24","count":3},{"job_class_description":"Classroom TSA 10 Months","count":1},{"job_class_description":"Classroom TSA 11 Months","count":1},{"job_class_description":"Classroom TSA 12 Months","count":1},{"job_class_description":"Clinic Liaison","count":2},{"job_class_description":"Commnty Coord/Program Assist","count":1},{"job_class_description":"Community Relations Asst I","count":1},{"job_class_description":"Coord After School Program","count":2},{"job_class_description":"Coord Attendance Discipline","count":1},{"job_class_description":"Coord Community School Leader","count":3},{"job_class_description":"Coordinator Health Services","count":1},{"job_class_description":"Coordinator Wellness","count":2},{"job_class_description":"Coord Juvenile Justice Center","count":2},{"job_class_description":"Coord Restorative Justice","count":1},{"job_class_description":"Coord Summer Learning Prog","count":1},{"job_class_description":"Dir Behavior Hlth Initiatives","count":3},{"job_class_description":"Director Health and Wellness","count":2},{"job_class_description":"Exec Dir Community Schools","count":1},{"job_class_description":"Instructional Supp Specialist","count":2},{"job_class_description":"Manager Community Partnership","count":2},{"job_class_description":"Noon Supervisor","count":1},{"job_class_description":"Pos Behav Supp Sys Coach","count":3},{"job_class_description":"Prog Assist McKinney Vento","count":1},{"job_class_description":"Prog Mgr Applied Behav Supp","count":1},{"job_class_description":"Prog Mgr Medi-Cal/LCL Edu Agnc","count":1},{"job_class_description":"Prog Mgr Restorative Justice","count":7},{"job_class_description":"Program Assistant III","count":2},{"job_class_description":"Program Manager After School","count":8},{"job_class_description":"Program Manager Certificated","count":2},{"job_class_description":"Program Manager Classified","count":1},{"job_class_description":"Program Manager Foster Youth","count":1},{"job_class_description":"Program Mgr Behavioral Health","count":6},{"job_class_description":"Program Mgr Community School","count":39},{"job_class_description":"Program Mgr HIV/STD Prevention","count":1},{"job_class_description":"Program Mgr Kinder Readiness","count":1},{"job_class_description":"Program Specialist-Health Educ","count":2},{"job_class_description":"Prog Specialist TSA 11 Months","count":1},{"job_class_description":"Receptionist Bilingual","count":2},{"job_class_description":"Restorative Justic Facilitator","count":21},{"job_class_description":"Social Worker","count":3},{"job_class_description":"Spec CSSS Data & Sys Mgmt","count":2},{"job_class_description":"Spec Homeless Youth Prog","count":1},{"job_class_description":"Specialist Behavior","count":5},{"job_class_description":"Specialist Wellness","count":2},{"job_class_description":"Teacher Education Enhancement","count":8}]},{"code":956,"name":"Continuous School Improvement","category":"Administrative Offices","spending":48823.22,"budget":2662.3,"year":2018,"eoy_total_staff":1.25,"remaining_budget_percent":-1733.9,"staff_roles":[{"job_class_description":"Program Mgr Behavioral Health","count":1},{"job_class_description":"Program Mgr Community School","count":1}]},{"code":989,"name":"Custodial Services","category":"Facilities","spending":958652.52,"budget":1201584.85,"year":2018,"eoy_total_staff":228.34998,"remaining_budget_percent":20.2,"staff_roles":[{"job_class_description":"Analyst Custodial Svc Faciliti","count":1},{"job_class_description":"Business Mgr Central Office","count":1},{"job_class_description":"Clerk Typist","count":1},{"job_class_description":"Custodian","count":179},{"job_class_description":"Custodian CDC","count":9},{"job_class_description":"Exec Dir Custodial Svcs Grnds","count":1},{"job_class_description":"Head Custodian 1","count":16},{"job_class_description":"Head Custodian 2","count":8},{"job_class_description":"Head Custodian 3","count":6},{"job_class_description":"Manager Custodial Services","count":1},{"job_class_description":"Manager Sustainability","count":1},{"job_class_description":"Supervisor Custodian Field","count":3},{"job_class_description":"Sweeper Operator","count":2}]},{"code":999,"name":"Districtwide Expenses","category":"Other","spending":27366646.43,"budget":29309956.87,"year":2018,"eoy_total_staff":3,"remaining_budget_percent":6.6,"staff_roles":[{"job_class_description":"Principal Alternative Ed","count":2},{"job_class_description":"Teacher Structured Eng Immersn","count":1}]},{"code":910,"name":"Early Childhood Development","category":"Instructional Programs","spending":7813420.95,"budget":9099376,"year":2018,"eoy_total_staff":56.2,"remaining_budget_percent":14.1,"staff_roles":[{"job_class_description":"Administrative Assist II Bil","count":2},{"job_class_description":"CDC Site Administrator","count":12},{"job_class_description":"Classroom TSA 11 Months","count":11},{"job_class_description":"Director ECE","count":2},{"job_class_description":"Director Enh Prof Development","count":2},{"job_class_description":"Financial Accountant II","count":2},{"job_class_description":"Prog Specialist TSA 11 Months","count":1},{"job_class_description":"Specialist Enrollment ECE","count":16},{"job_class_description":"Teacher TSA 11 Month - 12 Pay","count":1},{"job_class_description":"Trans Kinder Reading Tutor","count":91}]},{"code":915,"name":"Educator Effectiveness","category":"Instructional Programs","spending":660.56,"budget":0,"year":2018,"eoy_total_staff":null,"remaining_budget_percent":null},{"code":923,"name":"Elementary Network 4","category":"Instructional Programs","spending":1499671.93,"budget":1717930.29,"year":2018,"eoy_total_staff":7,"remaining_budget_percent":12.7,"staff_roles":[{"job_class_description":"Dir Continuous Sch Improvement","count":1},{"job_class_description":"Executive Office Assistant","count":2},{"job_class_description":"Liaison Family Parent","count":1},{"job_class_description":"Network Superintendent Pre-K5","count":1},{"job_class_description":"Partner Network","count":3},{"job_class_description":"Program Manager Grants","count":1}]},{"code":954,"name":"English Language Learner / Multilingual Achievement","category":"Instructional Programs","spending":4300131.87,"budget":4805140.84,"year":2018,"eoy_total_staff":33.55,"remaining_budget_percent":10.5,"staff_roles":[{"job_class_description":"Asst Newcomer Learning Lab","count":7},{"job_class_description":"Business Mgr Central Office","count":1},{"job_class_description":"Classroom TSA 11 Months","count":9},{"job_class_description":"Coord English Lang Dev Svc","count":2},{"job_class_description":"Coordinator Classified","count":2},{"job_class_description":"Coord Multilingual Pathway","count":2},{"job_class_description":"Counselor","count":1},{"job_class_description":"Dir Newcomer Eng Lang Lrn Prog","count":1},{"job_class_description":"Executive Director ELL","count":1},{"job_class_description":"Prog Mgr Newcomer & Refuge","count":1},{"job_class_description":"Program Mgr Behavioral Health","count":1},{"job_class_description":"Social Worker","count":4},{"job_class_description":"Spec Refugee/Asylee Prog","count":1},{"job_class_description":"Spec Unaccompanied Immig Child","count":7}]},{"code":918,"name":"Facilities Planning","category":"Facilities","spending":15554463.18,"budget":19123095.8,"year":2018,"eoy_total_staff":24.55,"remaining_budget_percent":18.7,"staff_roles":[{"job_class_description":"Administrative Assistant I","count":1},{"job_class_description":"Administrative Assistant II","count":2},{"job_class_description":"Administrative Assist III Bil","count":1},{"job_class_description":"Coordinator Facilities Mgmt","count":4},{"job_class_description":"Deputy Chief Facilities","count":2},{"job_class_description":"Director Community Engagement","count":1},{"job_class_description":"Director Facilities Management","count":2},{"job_class_description":"Financial Accountant II","count":3},{"job_class_description":"Financial Analyst Constr Bond","count":1},{"job_class_description":"Principal Account Clerk","count":1},{"job_class_description":"Project Manager Facilities Pln","count":6},{"job_class_description":"Spec Fac Contracts & Bids","count":1},{"job_class_description":"Special Community Engagement","count":1}]},{"code":991,"name":"Food Service","category":"Student Services","spending":4423574.67,"budget":5199898.31,"year":2018,"eoy_total_staff":13.25002,"remaining_budget_percent":14.9,"staff_roles":[{"job_class_description":"Accountant I","count":2},{"job_class_description":"Administrative Assistant I","count":1},{"job_class_description":"Administrative Assist I Bil","count":4},{"job_class_description":"Assistant Dir Food Service","count":3},{"job_class_description":"Exec Dir Nutrition Services","count":1},{"job_class_description":"Financial Accountant I","count":2},{"job_class_description":"Financial Accountant II","count":2},{"job_class_description":"Manager Sustainability","count":1},{"job_class_description":"Nutrition Svc Field Supervisor","count":6},{"job_class_description":"Specialist Nutrtn Svc Support","count":1},{"job_class_description":"Supervisor Menu Planning","count":2}]},{"code":968,"name":"Health Services (Nurses)","category":"Student Services","spending":2285013.37,"budget":3492187,"year":2018,"eoy_total_staff":38.8,"remaining_budget_percent":34.6,"staff_roles":[{"job_class_description":"Health Assistant","count":2},{"job_class_description":"Health Assistant Bilingual","count":1},{"job_class_description":"Health Svc Data & Sys Mgt","count":1},{"job_class_description":"Licensed Vocational Nurse","count":7},{"job_class_description":"Nurse","count":26},{"job_class_description":"Program Manager Health Service","count":1},{"job_class_description":"Technician Aide 10 Mos","count":2}]},{"code":964,"name":"High School Network","category":"Instructional Programs","spending":2889130.46,"budget":3156551.5,"year":2018,"eoy_total_staff":19.7,"remaining_budget_percent":8.5,"staff_roles":[{"job_class_description":"Deputy Network Superintendent","count":1},{"job_class_description":"Exec Director Alternative Ed","count":1},{"job_class_description":"Executive Director Instruction","count":3},{"job_class_description":"Network Superintendent HS","count":1},{"job_class_description":"Partner Network","count":1},{"job_class_description":"Program Mgr Home and Hospital","count":2},{"job_class_description":"Teacher Home/Hospital","count":13},{"job_class_description":"Teacher Tap","count":1}]},{"code":944,"name":"Human Resources","category":"People Operations","spending":7486705.14,"budget":9402025.97,"year":2018,"eoy_total_staff":42.5,"remaining_budget_percent":20.4,"staff_roles":[{"job_class_description":"Analyst Central Office Staff","count":2},{"job_class_description":"Analyst Empl Info & Mgmt Sys","count":1},{"job_class_description":"Assistant Empl Info & Mgmt Sys","count":1},{"job_class_description":"Assistant Staffing Support","count":2},{"job_class_description":"Associate Credentials","count":4},{"job_class_description":"Associate Systems","count":1},{"job_class_description":"Associate Talent Development","count":5},{"job_class_description":"Business Manager HR","count":1},{"job_class_description":"Business Mgr Central Office","count":1},{"job_class_description":"Coordinator Benefits Mgmt","count":2},{"job_class_description":"Coordinator Certificated","count":2},{"job_class_description":"Deputy Chief Talent Management","count":1},{"job_class_description":"Director Talent Development","count":1},{"job_class_description":"Manager HR Compliance","count":1},{"job_class_description":"Manager Recruitment","count":1},{"job_class_description":"Manager Substitute Services","count":1},{"job_class_description":"Manager Systems & Processes","count":1},{"job_class_description":"Mgr Employee Retent and Dev","count":1},{"job_class_description":"Mgr Leadership Growth & Develp","count":1},{"job_class_description":"Office Mgr Talent Development","count":1},{"job_class_description":"Partner Central Office","count":1},{"job_class_description":"Partner School","count":6},{"job_class_description":"Regional Staff Analyst II HR","count":4},{"job_class_description":"Regional Staffing Analyst I HR","count":3},{"job_class_description":"Secretary HRSS","count":2},{"job_class_description":"Spec Employee Retent/Dev","count":1},{"job_class_description":"Specialist Benefit","count":1},{"job_class_description":"Talent Recruiter","count":1},{"job_class_description":"Teacher Consulting Peer","count":4}]},{"code":959,"name":"Indian Education","category":"Instructional Programs","spending":43401,"budget":43401,"year":2018,"eoy_total_staff":null,"remaining_budget_percent":0},{"code":924,"name":"Instruction Support Specialist Network","category":"Instructional Programs","spending":68399.45,"budget":62284.46,"year":2018,"eoy_total_staff":null,"remaining_budget_percent":-9.8},{"code":932,"name":"Jr Reserve Officer Training Corp","category":"Instructional Programs","spending":19821.54,"budget":17074.9,"year":2018,"eoy_total_staff":0.25,"remaining_budget_percent":-16.1,"staff_roles":[{"job_class_description":"Teacher ROTC","count":1}]},{"code":942,"name":"Labor Relations","category":"People Operations","spending":3579.69,"budget":20000,"year":2018,"eoy_total_staff":null,"remaining_budget_percent":82.1},{"code":946,"name":"Legal Counsel","category":"Administrative Offices","spending":1703757.66,"budget":1830974,"year":2018,"eoy_total_staff":10,"remaining_budget_percent":6.9,"staff_roles":[{"job_class_description":"Assistant General Counsel","count":1},{"job_class_description":"Director Labor Relations","count":1},{"job_class_description":"ED Labor Relat & Alter Dis Res","count":1},{"job_class_description":"Executive Assistant Legal","count":1},{"job_class_description":"General Counsel","count":1},{"job_class_description":"Labor Relations Analyst III","count":1},{"job_class_description":"Legal Asst/Law Clerk III","count":1},{"job_class_description":"Legal Office Administrator","count":1},{"job_class_description":"Office Manager Labor/Legal","count":1},{"job_class_description":"Staff Attorney","count":2}]},{"code":912,"name":"Linked Learning","category":"Instructional Programs","spending":9160918.77,"budget":10633941.34,"year":2018,"eoy_total_staff":44.8,"remaining_budget_percent":13.9,"staff_roles":[{"job_class_description":"Administrative Assistant I","count":2},{"job_class_description":"Business Mgr Central Office","count":1},{"job_class_description":"Classroom TSA 12 Months","count":1},{"job_class_description":"Coach College/Career Pathways","count":14},{"job_class_description":"Commnty Coord/Program Assist","count":1},{"job_class_description":"Coordinator Business to School","count":1},{"job_class_description":"Coordinator Work-Base Learning","count":1},{"job_class_description":"Coordinatr Career/College Path","count":1},{"job_class_description":"Coord Measure N & Action Res","count":1},{"job_class_description":"Coord Skilled Trades & Apprent","count":1},{"job_class_description":"Dir College Career Pathw","count":1},{"job_class_description":"Director Comprehensive Comm HS","count":4},{"job_class_description":"Mgr CTE C&C Pathways Sec Sch","count":3},{"job_class_description":"Program Manager HS Operations","count":1},{"job_class_description":"Site Liaison Work-Based Lrning","count":4},{"job_class_description":"Spec College/Career Readiness","count":7},{"job_class_description":"Specialist Mstr Schd Developm","count":1},{"job_class_description":"Teacher Structured Eng Immersn","count":12}]},{"code":965,"name":"Middle School Network","category":"Instructional Programs","spending":431979.96,"budget":4941630.06,"year":2018,"eoy_total_staff":2,"remaining_budget_percent":91.3,"staff_roles":[{"job_class_description":"Network Superintendent Middle","count":1},{"job_class_description":"Partner Network","count":2}]},{"code":933,"name":"Oakland Athletic League","category":"Student Services","spending":1539296.56,"budget":1887380.68,"year":2018,"eoy_total_staff":2,"remaining_budget_percent":18.4,"staff_roles":[{"job_class_description":"Commissioner OAL","count":1},{"job_class_description":"Manager Athletics & Activities","count":1}]},{"code":903,"name":"Office Of Chief Academic Officer","category":"Administrative Offices","spending":1470381.47,"budget":1925326.65,"year":2018,"eoy_total_staff":4,"remaining_budget_percent":23.6,"staff_roles":[{"job_class_description":"Chief Academic Officer","count":1},{"job_class_description":"Coord Local Cntrl Accnt PLA","count":1},{"job_class_description":"Program Manager Classified","count":1},{"job_class_description":"Sr Exec Asst Superintendent","count":1}]},{"code":929,"name":"Office Of Equity","category":"Instructional Programs","spending":2570848.76,"budget":2865198.07,"year":2018,"eoy_total_staff":25.25,"remaining_budget_percent":10.3,"staff_roles":[{"job_class_description":"Administrative Assistant III","count":1},{"job_class_description":"Deputy Chief Equity","count":1},{"job_class_description":"Dir AA Girls & Young Women Ach","count":1},{"job_class_description":"Dir African American Male Ach","count":1},{"job_class_description":"Dir Asian Pacific Islander Ach","count":1},{"job_class_description":"Dir Student Achievement TS","count":1},{"job_class_description":"Dir Student and Family Engage","count":1},{"job_class_description":"Liaison Student Engagement","count":1},{"job_class_description":"PM API Student Achievement","count":1},{"job_class_description":"PM Latino/a Amer Student Ach","count":1},{"job_class_description":"Prog Mgr AA Female Excellence","count":1},{"job_class_description":"Program Manager AAMA","count":1},{"job_class_description":"Regional Fam Engage Liaison","count":5},{"job_class_description":"Specialist School Governance","count":1},{"job_class_description":"Teacher Structured Eng Immersn","count":10}]},{"code":905,"name":"Office Of Sr. Business Officer","category":"Administrative Offices","spending":915117.82,"budget":922210,"year":2018,"eoy_total_staff":2,"remaining_budget_percent":0.8,"staff_roles":[{"job_class_description":"Chief Business Officer","count":1},{"job_class_description":"Coordinator Classified","count":1}]},{"code":945,"name":"Office Of State Trustee","category":"Administrative Offices","spending":107880,"budget":107880,"year":2018,"eoy_total_staff":null,"remaining_budget_percent":0},{"code":941,"name":"Office Of The Superintendent","category":"Administrative Offices","spending":1594162.44,"budget":2010909.88,"year":2018,"eoy_total_staff":5,"remaining_budget_percent":20.7,"staff_roles":[{"job_class_description":"Admin Asst Superintendent Ofc","count":1},{"job_class_description":"Dep Chief Continuous Improve","count":1},{"job_class_description":"Sr Dir Strategic Projects","count":1},{"job_class_description":"Sr Exec Asst Superintendent","count":1},{"job_class_description":"Superintendent","count":1}]},{"code":906,"name":"Ombudsman","category":"People Operations","spending":1433.67,"budget":1436,"year":2018,"eoy_total_staff":null,"remaining_budget_percent":0.2},{"code":928,"name":"OPSR Counseling","category":"Student Services","spending":26678.71,"budget":82760.79,"year":2018,"eoy_total_staff":42.5,"remaining_budget_percent":67.8,"staff_roles":[{"job_class_description":"Coordinator College Access","count":1},{"job_class_description":"Coord Post Secondary Readi","count":1},{"job_class_description":"Counselor","count":40},{"job_class_description":"Mgr Master Sched Comp Stud Sup","count":2}]},{"code":994,"name":"OUSD Police Department","category":"Police","spending":2924781.83,"budget":3104985.72,"year":2018,"eoy_total_staff":102,"remaining_budget_percent":5.8,"staff_roles":[{"job_class_description":"Chief School Police","count":1},{"job_class_description":"Coordinator School Secur Off","count":2},{"job_class_description":"Fingerprint Technician","count":2},{"job_class_description":"Office Manager","count":1},{"job_class_description":"Police Sergeant","count":3},{"job_class_description":"Prog Mgr Emergncy Preparedness","count":1},{"job_class_description":"School Police Officer II","count":9},{"job_class_description":"School Security Officer I","count":75},{"job_class_description":"School Security Officer II","count":8},{"job_class_description":"Security and Safety Dispatcher","count":1}]},{"code":983,"name":"Payroll","category":"Financial Operations","spending":1383784.29,"budget":1361784.55,"year":2018,"eoy_total_staff":10,"remaining_budget_percent":-1.6,"staff_roles":[{"job_class_description":"Director Payroll","count":1},{"job_class_description":"Payroll Technician II","count":8},{"job_class_description":"Prog Mgr Payroll Customer Svc","count":1}]},{"code":961,"name":"Pre K-5 Network 1","category":"Instructional Programs","spending":0,"budget":7096,"year":2018,"eoy_total_staff":null,"remaining_budget_percent":100},{"code":962,"name":"Pre-K-5 Network 2","category":"Instructional Programs","spending":459776.34,"budget":465842.5,"year":2018,"eoy_total_staff":2.5,"remaining_budget_percent":1.3,"staff_roles":[{"job_class_description":"Executive Office Assistant","count":1},{"job_class_description":"Network Superintendent Pre-K5","count":1},{"job_class_description":"Partner Network","count":1}]},{"code":963,"name":"Pre-K-5 Network 3","category":"Instructional Programs","spending":467599.22,"budget":467220.02,"year":2018,"eoy_total_staff":2.5,"remaining_budget_percent":-0.1,"staff_roles":[{"job_class_description":"Executive Office Assistant","count":1},{"job_class_description":"Network Superintendent Pre-K5","count":1},{"job_class_description":"Partner Network","count":1}]},{"code":979,"name":"Printing And Mail Services","category":"Other Operations","spending":313302.14,"budget":355691,"year":2018,"eoy_total_staff":3,"remaining_budget_percent":11.9,"staff_roles":[{"job_class_description":"Lead Duplicating Equipmt Oper","count":1},{"job_class_description":"Lead Mail Services","count":1},{"job_class_description":"Mail Services Clerk","count":1}]},{"code":990,"name":"Procurement & Distribution","category":"Financial Operations","spending":534929.01,"budget":642833.97,"year":2018,"eoy_total_staff":3,"remaining_budget_percent":16.8,"staff_roles":[{"job_class_description":"Analyst Contract","count":1},{"job_class_description":"Buyer","count":1},{"job_class_description":"Operations Officer","count":1}]},{"code":948,"name":"Research Assessment & Data","category":"Other Operations","spending":2859186.77,"budget":2974307.65,"year":2018,"eoy_total_staff":17.3,"remaining_budget_percent":3.9,"staff_roles":[{"job_class_description":"Analytics Spec GIS Mapping","count":1},{"job_class_description":"Business Mgr Central Office","count":1},{"job_class_description":"Coord State/Local Assessment","count":1},{"job_class_description":"Data Analyst II","count":5},{"job_class_description":"Director Analytics","count":1},{"job_class_description":"Director State/Loc Assessments","count":1},{"job_class_description":"Executive Director RAD","count":1},{"job_class_description":"Manager Strategic Initiatives","count":1},{"job_class_description":"Research Assoc Disproportion","count":2},{"job_class_description":"Research Assoc Early Child","count":3},{"job_class_description":"Spec Human Capital Reporting","count":1},{"job_class_description":"Specialist State/Local Testing","count":1},{"job_class_description":"Statistician","count":1},{"job_class_description":"Strategic Fellow/Resident","count":2}]},{"code":987,"name":"Risk Management","category":"Risk Management","spending":70745641.72,"budget":83382799,"year":2018,"eoy_total_staff":13,"remaining_budget_percent":15.2,"staff_roles":[{"job_class_description":"Analyst Workers Comp Rea Acc","count":1},{"job_class_description":"Assist Risk Management","count":1},{"job_class_description":"Coord Disability Management","count":2},{"job_class_description":"Coordinator Leave Management","count":1},{"job_class_description":"Envirnmntl Health & Safety Mgr","count":1},{"job_class_description":"Financial Accountant III","count":1},{"job_class_description":"Legal Asst/Law Clerk III","count":1},{"job_class_description":"Legal Classified","count":1},{"job_class_description":"Manager Fixed Assets","count":1},{"job_class_description":"Mgr Fixed Assets & Insur Solu","count":1},{"job_class_description":"Risk Management Administrator","count":1},{"job_class_description":"Risk Management Officer","count":1},{"job_class_description":"Specialist Benefit","count":1}]},{"code":975,"name":"Special Education","category":"Special Education","spending":51885463.28,"budget":55214642.21,"year":2018,"eoy_total_staff":237.5,"remaining_budget_percent":6,"staff_roles":[{"job_class_description":"Administrative Assistant I","count":3},{"job_class_description":"Administrative Assist III Bil","count":1},{"job_class_description":"Anlyt PEC Financial Operations","count":1},{"job_class_description":"Case Manager 24","count":6},{"job_class_description":"Classroom TSA 10 Months","count":7},{"job_class_description":"Community Relations Asst II","count":2},{"job_class_description":"Community Service Worker I","count":1},{"job_class_description":"Coordinator Certificated","count":6},{"job_class_description":"Coordinator Special Education","count":2},{"job_class_description":"Director Legal Support Service","count":1},{"job_class_description":"Director Schools PEC","count":1},{"job_class_description":"Exective Director PEC","count":1},{"job_class_description":"Instructional Aide Special Ed","count":1},{"job_class_description":"Instructional Supp Specialist","count":5},{"job_class_description":"Interpreter For Deaf II","count":2},{"job_class_description":"Interpreter For Deaf III","count":1},{"job_class_description":"Job Coach/Workability","count":2},{"job_class_description":"Occupational Therapist","count":13},{"job_class_description":"Para Educator","count":41},{"job_class_description":"Prog Specialist TSA 11 Months","count":12},{"job_class_description":"Psychologist","count":49},{"job_class_description":"Social Worker","count":16},{"job_class_description":"Specialist Translator-Chinese","count":1},{"job_class_description":"Specialist Transportation","count":1},{"job_class_description":"Special SELPA Data Sys Mgt","count":1},{"job_class_description":"Speech Therapist","count":47},{"job_class_description":"Staff Attorney","count":1},{"job_class_description":"Tchr SDC Non Sevrly Handicapp","count":2},{"job_class_description":"Tchr SDC Severely Handicapped","count":14},{"job_class_description":"Teacher Adapted PE","count":4},{"job_class_description":"Teacher Hearing Imparied","count":2},{"job_class_description":"Teacher Orientation/Mobility","count":3},{"job_class_description":"Teacher RSP","count":13},{"job_class_description":"Teacher Visually Impaired","count":3}]},{"code":950,"name":"State and Federal Programs","category":"Administrative Offices","spending":1581468.38,"budget":2039341.82,"year":2018,"eoy_total_staff":8,"remaining_budget_percent":22.5,"staff_roles":[{"job_class_description":"Coordinator Compliance","count":5},{"job_class_description":"Officer Accountability Part","count":3},{"job_class_description":"Program Manager Compliance","count":12}]},{"code":907,"name":"Student Assignment","category":"Student Services","spending":1700384.57,"budget":1747551.84,"year":2018,"eoy_total_staff":14,"remaining_budget_percent":2.7,"staff_roles":[{"job_class_description":"Coord Regist and Enroll Proj","count":1},{"job_class_description":"Director Student Assignment","count":1},{"job_class_description":"Dir Enroll Planning & Policy","count":1},{"job_class_description":"Exec Dir Enroll & Regist Mgt","count":1},{"job_class_description":"Student Assignment Counselor","count":14}]},{"code":937,"name":"Summer Programs","category":"Instructional Programs","spending":3808516.15,"budget":3421658.04,"year":2018,"eoy_total_staff":0.3,"remaining_budget_percent":-11.3,"staff_roles":[{"job_class_description":"Program Mgr Kinder Readiness","count":1}]},{"code":909,"name":"Teaching & Learning","category":"Instructional Programs","spending":13545767.81,"budget":16295911.95,"year":2018,"eoy_total_staff":93.945,"remaining_budget_percent":16.9,"staff_roles":[{"job_class_description":"Business Mgr Central Office","count":3},{"job_class_description":"Classroom TSA 10 Months","count":2},{"job_class_description":"Classroom TSA 11 Months","count":46},{"job_class_description":"Classroom TSA 12 Months","count":1},{"job_class_description":"Coordinator Certificated","count":14},{"job_class_description":"Coordinator Classified","count":2},{"job_class_description":"Coordinator Element Science","count":1},{"job_class_description":"Coordinator Innova Programs","count":1},{"job_class_description":"Coordinator Instructional Tech","count":1},{"job_class_description":"Coordinator STEM","count":2},{"job_class_description":"Coord Social Emotional Learn","count":2},{"job_class_description":"Dir Continuous Sch Improvement","count":2},{"job_class_description":"Director Pre-K12 Science","count":1},{"job_class_description":"Dir Visual & Performing Arts","count":1},{"job_class_description":"Executive Director Instruction","count":1},{"job_class_description":"Instructional Supp Specialist","count":1},{"job_class_description":"Librarian","count":4},{"job_class_description":"Library Clerk","count":2},{"job_class_description":"Library Technician","count":14},{"job_class_description":"NULL","count":1},{"job_class_description":"Office Manager","count":1},{"job_class_description":"Prog Mgr District Library Svc","count":1},{"job_class_description":"Program Manager Certificated","count":1},{"job_class_description":"Program Manager Classified","count":2},{"job_class_description":"Senior Library Clerk","count":6},{"job_class_description":"Senior Library Clerk20","count":2},{"job_class_description":"Spec Instructional Materials","count":2},{"job_class_description":"Stock Clerk","count":1},{"job_class_description":"Teacher Structured Eng Immersn","count":13}]},{"code":986,"name":"Technology Services","category":"Other Operations","spending":6295103.7,"budget":7227529.78,"year":2018,"eoy_total_staff":31.5,"remaining_budget_percent":12.9,"staff_roles":[{"job_class_description":"Business Mgr Central Office","count":1},{"job_class_description":"Coordinator Instructional Tech","count":1},{"job_class_description":"Coord Sch, Data & Assessmt Sys","count":1},{"job_class_description":"ED Technology Services","count":1},{"job_class_description":"Enduser Support Specialist II","count":3},{"job_class_description":"Info Systems Specialist II","count":4},{"job_class_description":"Info Systems Specialist IV","count":3},{"job_class_description":"Network Administrator I","count":2},{"job_class_description":"Network Infrastructure Spec","count":1},{"job_class_description":"Senior Computer Technician","count":2},{"job_class_description":"Senior Network Administrator","count":2},{"job_class_description":"Senior Network Engineer","count":1},{"job_class_description":"Software Developer II","count":1},{"job_class_description":"Software Developer IV","count":2},{"job_class_description":"Specialist School Technology","count":6},{"job_class_description":"Technology Information Officer","count":1}]},{"code":995,"name":"Transportation","category":"Student Services","spending":14308022.74,"budget":14348152.21,"year":2018,"eoy_total_staff":3,"remaining_budget_percent":0.3,"staff_roles":[{"job_class_description":"Dir Transporation & Logistics","count":1},{"job_class_description":"ED Transportation & Logistics","count":1},{"job_class_description":"Specialist Transportation","count":1}]},{"code":992,"name":"Warehouse Distribution","category":"Other Operations","spending":1136215.75,"budget":1646076.01,"year":2018,"eoy_total_staff":12,"remaining_budget_percent":31,"staff_roles":[{"job_class_description":"Coord Warehouse Distribution","count":1},{"job_class_description":"Lead Truck Driver","count":2},{"job_class_description":"Stock Clerk","count":4},{"job_class_description":"Truck Driver I","count":12}]}]

            rolesGroupedByProgram = staffRoles.reduce((r,row) => {
                var code = row.site_code
                delete row.site_code
                r[code] = r[code] || []
                r[code].push(row)
                return r
            }, Object.create(null))

            programs = programs.map(program => {
                program.staff_roles = rolesGroupedByProgram[program.code]
                return program
            })

        }

        res.json(programs)
    } catch(e) {
        console.log(e)
        res.status(500).send(e)
    }

})

router.get('/central-programs/resources', async (req, res, next) => {

    var year = 2018

    if("year" in req.query) {
        year = req.query.year
    }

    var query = `SELECT e.resource_code as code, r.description as name, r.category,
                        SUM(e.ytd_actual) as spending,
                        SUM(e.budget) as budget,
                        e.year
                    FROM expenditures e
                    LEFT JOIN resources r ON e.resource_code = r.code
                    WHERE e.site_code >= 900
                    AND e.site_code != 998
                    AND e.year = ${year}
                    GROUP BY e.resource_code, r.description, e.year, r.category`

    let processor

    try {
        getData(query, res, processor)
    } catch(e) {
        res.status(500).send(e)
    }

})

router.get('/sankey', async (req, res, next) => {

    var year = 2018
    var minSpend = 100000
    var groupBy = null

    if("year" in req.query) {
        year = req.query.year
    }

    if("minSpend" in req.query) {
        minSpend = req.query.minSpend
    }

    if("groupBy" in req.query) {
        groupBy = req.query.groupBy
    }

    var nodesQuery = `SELECT r.category as id, 'resource' as type, SUM(ytd_actual) as total, string_agg(DISTINCT r.description, ', ') as subnodes --, e.resource_code as code, r.description
                      FROM expenditures e
                      LEFT JOIN resources r on r.code = e.resource_code
                      WHERE e.year = ${year}
                      AND e.site_code >= 900
                      AND e.site_code != 998
                      GROUP BY r.category
                      HAVING SUM(e.ytd_actual) > 0


                      UNION ALL

                      SELECT DISTINCT(s.category) as id, 'site' as type, SUM(ytd_actual) as total, string_agg(DISTINCT s.description, ', ') as subnodes --, e.site_code as code, s.category
                      FROM expenditures e
                      LEFT JOIN sites s on s.code = e.site_code
                      WHERE e.year = ${year}
                      AND e.site_code >= 900
                      AND e.site_code != 998
                      GROUP BY s.category
                      HAVING SUM(e.ytd_actual) > 0`

    var resourceCol = "category"
    if (groupBy === "restricted") resourceCol = "type"

    var linksQuery = `SELECT SUM(e.ytd_actual) as value, s.category as target, r.${resourceCol} as source
                      FROM expenditures e
                      LEFT JOIN sites s ON e.site_code = s.code
                      LEFT JOIN resources r ON e.resource_code = r.code
                      WHERE e.year = ${year}
                      AND e.site_code >= 900
                      AND e.site_code != 998
                      GROUP BY s.category, r.${resourceCol}
                      HAVING SUM(e.ytd_actual) >= ${minSpend}`

    var linksResourceTypeQuery = `UNION ALL

                      SELECT SUM(e.ytd_actual) as value, r.type as target, r.category as source
                      FROM expenditures e
                      LEFT JOIN sites s ON e.site_code = s.code
                      LEFT JOIN resources r ON e.resource_code = r.code
                      WHERE e.year = ${year}
                      AND e.site_code >= 900
                      AND e.site_code != 998
                      GROUP BY r.category, r.type
                      HAVING SUM(e.ytd_actual) >= ${minSpend}`

    if (groupBy === "restricted") linksQuery = linksQuery + linksResourceTypeQuery

    const resourceTypeNodes = [
        {
          "id": "Restricted",
          "type": "resource_type",
          "subnodes": ""
        },
        {
          "id": "Unrestricted",
          "type": "resource_type",
          "subnodes": ""
        }
    ]

    try {
        var nodes = await pgPool.query(nodesQuery)
        var links = await pgPool.query(linksQuery)

        nodes = nodes.rows
        if (groupBy === "restricted") nodes = nodes.concat(resourceTypeNodes)

        let result = {
          nodes: nodes,
          links: links.rows
        }

        res.json(result)
    } catch(e) {
        console.log(e.stack)
        throw new Error (e)
        res.status(500).send(e)
    }

})

const getData = (query, res, processor) => {

    // Initialize the pool lazily, in case SQL access isn't needed for this
    // GCF instance. Doing so minimizes the number of active SQL connections,
    // which helps keep your GCF instances under SQL connection limits.

    if (!pgPool) {
        pgPool = new pg.Pool(pgConfig)
    }

    pgPool.query(query, (err, results) => {
        if (err) {
          console.log(err)
          throw new Error (err)
        } else {
          res.json(results.rows)
        }
    })
}

module.exports = router
