# CrewMatrix

  

A browser-based production crew scheduling application designed to automate employee assignments for manufacturing environments.

  

CrewMatrix reads employee qualification data from CSV files, applies scheduling rules, and generates a completed crewing schedule that can be downloaded as a CSV file.

  

---
## Try me
https://calvinperrycoding.github.io/portfolio/2026/06-29-2026_production_crew_scheduler/

---

  

## Features

  

- Web-based (HTML, CSS, JavaScript)

- Runs entirely in the browser

- No installation required

- Generates a production crewing schedule

- CSV import/export

- Employee qualification matrix

- Automatic line lead assignment

- Trainer prioritization

- Automatic trainee pairing

- Employee call-off / PTO handling

- User-defined production line priorities

- Optional floaters for each production line

- Automatic assignment of remaining employees to Rework or Cleaning

  

---

  

## Scheduling Rules

  

### Line Leads

  

- Must be marked as a Line Lead

- Must have a proficiency level of **3** on the assigned line

  

### Trainers

  

- Trainers are prioritized over non-trainers during employee assignment.

- Trainers must have a proficiency level of **3** on the assigned production line.

  

### Trainees

  

- Trainees are identified using the **Is Trainee** column.

- Trainees are assigned only to production lines.

- Trainees are paired with qualified trainers whenever possible.

  

### Production Lines

  

Each production line consists of:

  

- 1 Line Lead

- 5 Employees

- Optional Floater (user selectable)

  

### Floaters

  

The user can enable or disable a floater independently for:

  

- Line 1

- Line 2

- Line 3

  

If a floater is not requested, remaining employees are assigned to Rework or Cleaning.

  

### Rework

  

The user specifies how many employees should be assigned to Rework.

  

### Cleaning

  

The user specifies how many employees should be assigned to Cleaning.

  

### Absent Employees

  

Employees listed in **absent_list.csv** are excluded before scheduling.

  

---

  

## CSV Format

  

### employee_list.csv

  

| Column | Description |

|---------|-------------|

| Seniority | Lower number = more senior employee |

| Name | Employee name |

| Is Line Lead? | y/n |

| Is Trainer? | y/n |

| Is Trainee | y/n |

| Line 1 Proficiency | 0–3 |

| Line 2 Proficiency | 0–3 |

| Line 3 Proficiency | 0–3 |

  

### Proficiency Levels

  

| Value | Meaning |

|-------:|---------|

| 0 | Not qualified |

| 1 | Beginner |

| 2 | Intermediate |

| 3 | Advanced |

  

### absent_list.csv

  

```csv

Name

John Smith

Jane Doe

```

  

---

  

## User Settings

  

The application allows the user to configure:

  

- Production line priority

- Number of Rework employees

- Number of Cleaning employees

- Floater enabled/disabled for each production line

  

---

  

## Technology

  

- HTML5

- CSS3

- JavaScript (ES6)

  

No external libraries or frameworks are required.

  

---

  

## Future Improvements

  

Planned enhancements include:

  

- Multi-day scheduling

- Shift scheduling

- Skill balancing

- Employee workload balancing

- Vacation calendar integration

- Production demand forecasting

- Export to Excel (.xlsx)

- Database support

- Employee availability tracking

- Drag-and-drop schedule editing

- Schedule history

- Printable production schedule

  

---

  

## Motivation

  

CrewMatrix was developed as a proof-of-concept to demonstrate how production crew scheduling can be automated using employee qualification data.

  

The project was inspired by real-world manufacturing scheduling challenges where employee skills, training requirements, line priorities, and staffing constraints must all be considered when creating daily production crews.

  

---

  

## Author

  

**Calvin E. Perry**

  

GitHub: https://github.com/calvinPerryCoding
