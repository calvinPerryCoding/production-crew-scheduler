let generatedCsv="";
const employeeInput=document.getElementById("employeeFile");
const absentInput=document.getElementById("absentFile");
const generateBtn=document.getElementById("generateBtn");
const downloadBtn=document.getElementById("downloadBtn");
const statusText=document.getElementById("status");
const scheduleTable=document.getElementById("scheduleTable");
generateBtn.addEventListener("click",generateSchedule);
downloadBtn.addEventListener("click",downloadCsv);

// Main entry point.
// Reads the uploaded CSV files, gathers user settings from the GUI,
// generates the production schedule, displays it, and prepares the CSV download.
async function generateSchedule()
{
  statusText.textContent=""; generatedCsv=""; downloadBtn.disabled=true; scheduleTable.innerHTML="";
  if(!employeeInput.files[0]){setStatus("Please upload the employee list CSV.",true);return;}
  try
  {
    const employeeText=await employeeInput.files[0].text();
    const absentText=absentInput.files[0]?await absentInput.files[0].text():"Name\n";
    const employees=parseEmployees(employeeText);
    const absentNames=parseAbsent(absentText);
    const settings={
      priorities:getPriorities(),
      reworkCount:numberValue("reworkCount"),
      cleaningCount:numberValue("cleaningCount"),
      floaters:
      {
        1:document.getElementById("line1Floater").value==="yes",
        2:document.getElementById("line2Floater").value==="yes",
        3:document.getElementById("line3Floater").value==="yes"
      }
    };
    const result=buildSchedule(employees,absentNames,settings);
    renderSchedule(result.schedule);
    generatedCsv=scheduleToCsv(result.schedule);
    downloadBtn.disabled=false;
    const absentMessage=absentNames.length>0?` Absent/PTO excluded: ${absentNames.join(", ")}.`:"";
    if(result.warnings.length>0){setStatus("Schedule generated with warnings: "+result.warnings.join(" | ")+absentMessage,true);}
    else{setStatus("Schedule generated successfully."+absentMessage,false);}
  }catch(error){setStatus(error.message,true);}
}

// Returns the production line order based on the priorities selected
// by the user in the interface (1 = highest priority).
function getPriorities()
{
  return [
    {line:1,priority:numberValue("line1Priority")},
    {line:2,priority:numberValue("line2Priority")},
    {line:3,priority:numberValue("line3Priority")}
  ].sort((a,b)=>a.priority-b.priority||a.line-b.line).map(x=>x.line);
}

// Returns the numeric value from an HTML input element.
function numberValue(id){return Number(document.getElementById(id).value||0);}

// Parses a CSV string into a two-dimensional array.
// Handles quoted values and embedded commas.
function parseCsv(text)
{
  const rows=[]; let current=[]; let value=""; let insideQuotes=false;
  for(let i=0;i<text.length;i++)
    {
    const char=text[i], next=text[i+1];
    if(char==='"'&&insideQuotes&&next==='"'){value+='"';i++;}
    else if(char==='"'){insideQuotes=!insideQuotes;}
    else if(char===","&&!insideQuotes){current.push(value.trim());value="";}
    else if((char==="\n"||char==="\r")&&!insideQuotes)
      {
      if(value||current.length>0){current.push(value.trim());rows.push(current);current=[];value="";}
      if(char==="\r"&&next==="\n")i++;
    }else{value+=char;}
  }
  if(value||current.length>0){current.push(value.trim());rows.push(current);}
  return rows.filter(row=>row.some(cell=>cell!==""));
}

// Normalizes column names so different header formats
// (spaces, punctuation, capitalization) are treated the same.
function normalizeHeader(value){return String(value||"").toLowerCase().replace(/[^a-z0-9]/g,"");}

// Converts employee names to a consistent format for comparisons.
function normalizeName(name){return String(name||"").trim().toLowerCase();}

// Converts common yes/no values (Y/N, Yes/No, 1/0, True/False)
// into JavaScript boolean values.
function yesNo(value){const text=String(value||"").trim().toLowerCase();return text==="y"||text==="yes"||text==="1"||text==="true";}

// Searches an object for one of several possible column names.
// Allows the program to accept slightly different CSV headers.
function getColumn(item,possibleNames)
{
  const normalized={}; Object.keys(item).forEach(key=>normalized[normalizeHeader(key)]=item[key]);
  for(const name of possibleNames){const key=normalizeHeader(name); if(key in normalized)return normalized[key];}
  return "";
}

// Reads the employee CSV and converts each row into an employee object
// containing qualifications, training status, and proficiency levels.
function parseEmployees(text)
{
  const rows=parseCsv(text);
  if(rows.length<2)throw new Error("Employee CSV has no employee rows.");
  const header=rows[0].map(h=>h.trim());
  return rows.slice(1).map(row=>{
    const item={}; header.forEach((h,i)=>item[h]=row[i]||"");
    return {
      seniority:Number(getColumn(item,["Seniority"])),
      name:getColumn(item,["Name"]),
      isLineLead:yesNo(getColumn(item,["Is Line Lead?","Is Line Lead"])),
      isTrainer:yesNo(getColumn(item,["Is Trainer?","Is Trainer"])),
      isTrainee:yesNo(getColumn(item,["Is Trainee","Is Trainee?"])),
      proficiency:{
        1:Number(getColumn(item,["Line 1 Proficiency","Line 1 Pro"])),
        2:Number(getColumn(item,["Line 2 Proficiency","Line 2 Pro"])),
        3:Number(getColumn(item,["Line 3 Proficiency","Line 3 Pro"]))
      }
    };
  }).filter(e=>e.name);
}

// Reads the absent employee CSV and returns a list of names
// that should be excluded from scheduling.
function parseAbsent(text)
{
  const rows=parseCsv(text);
  if(rows.length===0)return [];
  const header=rows[0].map(h=>h.toLowerCase());
  const nameIndex=header.findIndex(h=>h.includes("name"));
  if(nameIndex===-1)throw new Error("Absent CSV must have a 'Name' column.");
  return rows.slice(1).map(row=>row[nameIndex]).filter(name=>name&&name.trim()!=="");
}

// Core scheduling algorithm.
//
// Responsibilities:
// • Remove absent employees.
// • Assign qualified line leads.
// • Staff production lines based on priority.
// • Prioritize trainers.
// • Pair trainees with qualified trainers.
// • Assign remaining employees to Rework, Cleaning, and optional Floaters.
// • Return the completed schedule and any warnings.
function buildSchedule(allEmployees,absentNames,settings)
{
  const absentSet=new Set(absentNames.map(normalizeName));
  const employees=allEmployees.filter(e=>!absentSet.has(normalizeName(e.name)));
  const trainees=employees.filter(e=>e.isTrainee);
  const regularEmployees=employees.filter(e=>!e.isTrainee);
  const used=new Set(), usedTrainees=new Set(), warnings=[];
  const schedule={1:emptyLine(),2:emptyLine(),3:emptyLine(),rework:[],cleaning:[]};

  const excludedEmployees=allEmployees.filter(e=>absentSet.has(normalizeName(e.name)));
  if(excludedEmployees.length>0)warnings.push(`${excludedEmployees.length} employee(s) excluded due to absence/PTO`);

  for(const line of settings.priorities)
  {
    const lead=regularEmployees.filter(e=>!used.has(e.name)).filter(e=>e.isLineLead&&e.proficiency[line]===3).sort(bySeniority)[0];
    if(lead){schedule[line].lead=lead;used.add(lead.name);}
    else warnings.push(`No qualified line lead found for Line ${line}`);
  }

  for(const line of settings.priorities){
    // Trainers are prioritized first for line staffing, regardless of seniority.
    // A trainer must still have proficiency 3 on that specific line to be prioritized.
    const available=regularEmployees.filter(e=>!used.has(e.name)).filter(e=>e.proficiency[line]>=1).sort((a,b)=>{
      const aQualifiedTrainer=a.isTrainer&&a.proficiency[line]===3;
      const bQualifiedTrainer=b.isTrainer&&b.proficiency[line]===3;

      if(aQualifiedTrainer!==bQualifiedTrainer){
        return bQualifiedTrainer-aQualifiedTrainer;
      }

      if(b.proficiency[line]!==a.proficiency[line]){
        return b.proficiency[line]-a.proficiency[line];
      }

      return a.seniority-b.seniority;
    });
    while(schedule[line].employees.length<5&&available.length>0){
      const employee=available.shift(); schedule[line].employees.push({employee,trainee:null}); used.add(employee.name);
    }
    if(schedule[line].employees.length<5)warnings.push(`Line ${line} has only ${schedule[line].employees.length} of 5 employees`);
  }

  for(const line of settings.priorities)
  {
    for(const slot of schedule[line].employees)
    {
      if(!slot.employee.isTrainer||slot.employee.proficiency[line]!==3)continue;
      const trainee=trainees.filter(t=>!usedTrainees.has(t.name)).sort(bySeniority)[0];
      if(trainee){slot.trainee=trainee; usedTrainees.add(trainee.name);}
    }
  }

  const unassignedTrainees=trainees.filter(t=>!usedTrainees.has(t.name));
  if(unassignedTrainees.length>0)warnings.push(`${unassignedTrainees.length} trainee(s) could not be assigned to a trainer`);

  const remaining=regularEmployees.filter(e=>!used.has(e.name)).sort(bySeniority);
  while(schedule.rework.length<settings.reworkCount&&remaining.length>0)schedule.rework.push(remaining.shift());
  while(schedule.cleaning.length<settings.cleaningCount&&remaining.length>0)schedule.cleaning.push(remaining.shift());
  if(schedule.rework.length<settings.reworkCount)warnings.push(`Rework has only ${schedule.rework.length} of ${settings.reworkCount} requested employees`);
  if(schedule.cleaning.length<settings.cleaningCount)warnings.push(`Cleaning has only ${schedule.cleaning.length} of ${settings.cleaningCount} requested employees`);

  // 5. Optional floaters. Only assign a floater if the user selected Yes for that line.
  for(const line of settings.priorities)
  {
    if(settings.floaters[line]&&remaining.length>0){
      schedule[line].floater=remaining.shift();
    }
  }

  // 6. Any employees not used as requested floaters are sent to Rework first, then Cleaning.
  while(remaining.length>0)
  {
    if(schedule.rework.length<=schedule.cleaning.length){
      schedule.rework.push(remaining.shift());
    }else{
      schedule.cleaning.push(remaining.shift());
    }
  }

  return {schedule,warnings};
}

// Creates an empty production line object used
// while building the schedule.
function emptyLine(){return {lead:null,employees:[],floater:null};}

// Sorts employees by seniority.
// Lower seniority number = more senior employee.
function bySeniority(a,b){return a.seniority-b.seniority;}

// Displays the completed production schedule
// as an HTML table in the browser.
function renderSchedule(schedule)
{
  let header=`<tr><th></th><th>Line 1</th><th>Trainee</th><th>Line 2</th><th>Trainee</th><th>Line 3</th><th>Trainee</th><th>Rework Line</th><th>Cleaning</th></tr>`;
  let body="";
  body+=rowHtml("Line Lead",schedule[1].lead?.name||"","",schedule[2].lead?.name||"","",schedule[3].lead?.name||"","","","");
  for(let i=0;i<5;i++){
    body+=rowHtml(`Employee ${i+1}`,
      schedule[1].employees[i]?.employee.name||"",schedule[1].employees[i]?.trainee?.name||"",
      schedule[2].employees[i]?.employee.name||"",schedule[2].employees[i]?.trainee?.name||"",
      schedule[3].employees[i]?.employee.name||"",schedule[3].employees[i]?.trainee?.name||"",
      schedule.rework[i]?.name||"",schedule.cleaning[i]?.name||"");
  }
  const maxExtraRows=Math.max(schedule.rework.length,schedule.cleaning.length,5);
  for(let i=5;i<maxExtraRows;i++)body+=rowHtml(`Extra ${i-4}`,"","","","","","",schedule.rework[i]?.name||"",schedule.cleaning[i]?.name||"");
  body+=rowHtml("Floater (Optional)",schedule[1].floater?.name||"","",schedule[2].floater?.name||"","",schedule[3].floater?.name||"","","","");
  scheduleTable.innerHTML=header+body;
}

// Generates a single HTML table row.
function rowHtml(role,line1,trainee1,line2,trainee2,line3,trainee3,rework,cleaning){
  return `<tr><td class="role-cell">${escapeHtml(role)}</td><td>${escapeHtml(line1)}</td><td>${escapeHtml(trainee1)}</td><td>${escapeHtml(line2)}</td><td>${escapeHtml(trainee2)}</td><td>${escapeHtml(line3)}</td><td>${escapeHtml(trainee3)}</td><td>${escapeHtml(rework)}</td><td>${escapeHtml(cleaning)}</td></tr>`;
}

// Converts the completed schedule into CSV format
// for downloading or importing into Excel.
function scheduleToCsv(schedule)
{
  const rows=[["","Line 1","Trainee","Line 2","Trainee","Line 3","Trainee","Rework Line","Cleaning"],
    ["Line Lead",schedule[1].lead?.name||"","",schedule[2].lead?.name||"","",schedule[3].lead?.name||"","","",""]];
  for(let i=0;i<5;i++){
    rows.push([`Employee ${i+1}`,
      schedule[1].employees[i]?.employee.name||"",schedule[1].employees[i]?.trainee?.name||"",
      schedule[2].employees[i]?.employee.name||"",schedule[2].employees[i]?.trainee?.name||"",
      schedule[3].employees[i]?.employee.name||"",schedule[3].employees[i]?.trainee?.name||"",
      schedule.rework[i]?.name||"",schedule.cleaning[i]?.name||""]);
  }
  const maxExtraRows=Math.max(schedule.rework.length,schedule.cleaning.length,5);
  for(let i=5;i<maxExtraRows;i++)rows.push([`Extra ${i-4}`,"","","","","","",schedule.rework[i]?.name||"",schedule.cleaning[i]?.name||""]);
  rows.push(["Floater (Optional)",schedule[1].floater?.name||"","",schedule[2].floater?.name||"","",schedule[3].floater?.name||"","","",""]);
  return rows.map(row=>row.map(csvEscape).join(",")).join("\n");
}

// Escapes special characters so values are written
// safely into a CSV file.
function csvEscape(value){const text=String(value??""); if(text.includes(",")||text.includes('"')||text.includes("\n"))return `"${text.replaceAll('"','""')}"`; return text;}

// Downloads the generated schedule as "crewing.csv".
function downloadCsv(){const blob=new Blob([generatedCsv],{type:"text/csv"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="crewing.csv"; a.click(); URL.revokeObjectURL(url);}

// Displays a success or warning message
// to the user in the application.
function setStatus(message,isWarning){statusText.textContent=message; statusText.className=isWarning?"warning":"success";}

// Escapes HTML characters before displaying user data,
// preventing broken HTML and script injection.
function escapeHtml(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
