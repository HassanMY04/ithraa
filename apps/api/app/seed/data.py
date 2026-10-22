"""Static content for the demo school, taken from the Ithraa platform prototype."""

PASSWORD = "ithraa123"

ADMIN = {"first": "Hiba", "last": "Nassar", "title": "Ms.", "email": "hiba@ithraa.school",
         "job": "program coordinator", "color": "#16133A", "ar": "هبة نصّار"}

# id, first, last, title, email, color, short, role, teaches, available, extra, Arabic name
TEACHERS = [
    ("rana", "Rana", "Khoury", "Ms.", "#1F6FEB", "Cyber Awareness · 7–9", "Cyber Awareness, Grades 7–9 · 3 groups",
     "Cyber Awareness, Grades 7–9", ["mon", "tue", "wed", "thu"], "", "رنا خوري"),
    ("omar", "Omar", "Saleh", "Mr.", "#7B3FF2", "AI · 7–9 & AI & Data",
     "AI Awareness, Grades 7–9 · AI & Data, Grades 10–12", "AI Awareness 7–9 · AI & Data 10–12",
     ["mon", "tue", "wed"], " + 30 min capstone mentoring", "عمر صالح"),
    ("nada", "Nada", "Aoun", "Ms.", "#D2461F", "Design · 7–9 & 10–12",
     "Digital Design, Grades 7–9 · Digital Design, Grades 10–12", "Digital Design 7–9 · Design 10–12",
     ["mon", "wed", "thu"], " + 30 min capstone mentoring", "ندى عون"),
    ("sami", "Sami", "Daher", "Mr.", "#0B7D60", "Coding · 7–9 & Software",
     "Coding & Logic, Grades 7–9 · Software Development, Grades 10–12", "Coding 7–9 · Software Dev 10–12",
     ["tue", "wed", "thu"], " + 30 min capstone mentoring", "سامي ضاهر"),
    ("marc", "Marc", "Habib", "Mr.", "#14509E", "Cybersecurity · 10–12", "Cybersecurity, Grades 10–12 · 1 group",
     "Cybersecurity 10–12", ["wed"], " + 30 min capstone mentoring", "مارك حبيب"),
    ("ziad", "Ziad", "Karam", "Mr.", "#B26B00", "Robotics & IoT · 10–12", "Robotics & IoT, Grades 10–12 · 1 group",
     "Robotics & IoT 10–12", ["wed"], " + 30 min capstone mentoring", "زياد كرم"),
]

TEACHER_SURVEY = {
    "rana": [4.7, 4.6, 4.4], "omar": [4.5, 4.6, 4.4], "nada": [4.4, 4.5, 4.0],
    "sami": [4.3, 4.6, 4.5], "marc": [4.8, 4.7, 4.6], "ziad": [3.9, 4.6, 3.8],
}
# Average days between due date and grading, used to generate realistic grading history.
GRADING_DELAY = {"rana": 2.1, "omar": 1.5, "nada": 3.0, "sami": 2.4, "marc": 1.8, "ziad": 4.2}

TRACKS = [
    {"id": "cyber", "name": "Cyber Awareness", "name_ar": "التوعية السيبرانية", "short": "Cyber",
     "short_ar": "سيبراني", "letter_ar": "س", "color": "#1F6FEB", "tint": "#E4EEFF", "ink": "#14509E",
     "teacher": "rana", "start": 1, "room": "Lab 2",
     "majors": ["Cybersecurity", "Computer & Communication Eng.", "Computer Science", "Digital Forensics"],
     "careers": "Security analyst · Penetration tester · Network engineer"},
    {"id": "ai", "name": "AI Awareness & Usage", "name_ar": "الذكاء الاصطناعي: توعية واستخدام", "short": "AI",
     "short_ar": "الذكاء الاصطناعي", "letter_ar": "ذ", "color": "#7B3FF2", "tint": "#EFE7FF", "ink": "#5A27C2",
     "teacher": "omar", "start": 8, "room": "Lab 1",
     "majors": ["Artificial Intelligence", "Data Science", "Computer Science", "Computational Linguistics"],
     "careers": "ML engineer · Data analyst · AI product designer"},
    {"id": "design", "name": "Digital Design", "name_ar": "التصميم الرقمي", "short": "Design",
     "short_ar": "التصميم", "letter_ar": "ت", "color": "#D2461F", "tint": "#FFEAE2", "ink": "#A8361A",
     "teacher": "nada", "start": 15, "room": "Design studio",
     "majors": ["Graphic Design", "UX/UI Design", "Architecture", "Digital Media"],
     "careers": "UX designer · Brand designer · Motion designer"},
    {"id": "coding", "name": "Coding & Logic", "name_ar": "البرمجة والمنطق", "short": "Coding",
     "short_ar": "البرمجة", "letter_ar": "ب", "color": "#0B7D60", "tint": "#DCF4EA", "ink": "#0A6B52",
     "teacher": "sami", "start": 22, "room": "Lab 1",
     "majors": ["Computer Science", "Software Engineering", "Computer & Communication Eng.", "Mechatronics"],
     "careers": "Software developer · Game developer · Web developer"},
]
TRACK_KEY = {"cyber": "c", "ai": "a", "design": "d", "coding": "p"}

# level id -> (title, badge, skills)
LEVELS = {
    "c1": ("Safe Online", "Safe Surfer", ["Strong passwords", "Spotting phishing", "Privacy settings"]),
    "c2": ("Defend Your Data", "Data Defender", ["2FA & password managers", "Social engineering", "Safe public Wi-Fi"]),
    "c3": ("Think Like a Defender", "Threat Modeler", ["Network basics", "Threat modelling", "Intro to ethical hacking"]),
    "a1": ("Meet AI", "AI Explorer", ["What AI is (and isn’t)", "First prompts", "AI in daily life"]),
    "a2": ("Use AI Well", "Prompt Crafter", ["Prompt crafting", "Fact-checking AI answers", "AI image tools"]),
    "a3": ("Build with AI", "AI Builder", ["Train an image classifier", "Data and bias", "AI ethics debate"]),
    "d1": ("Visual Basics", "Visual Starter", ["Colour and type", "Layout", "Poster design"]),
    "d2": ("Design Tools", "Toolsmith", ["Vector graphics", "Photo editing", "Brand identity"]),
    "d3": ("Design for People", "People Designer", ["User interviews", "Wireframing", "Clickable prototype"]),
    "p1": ("Think in Steps", "Step Thinker", ["Algorithms", "Block coding", "Debugging"]),
    "p2": ("First Real Code", "First Coder", ["Python basics", "Loops and logic", "Mini game"]),
    "p3": ("Make Real Things", "Maker", ["Web pages with HTML & CSS", "Data with Python", "Team project"]),
}

LESSON_TITLES = {
    "c1": ["What is online safety?", "Strong passwords", "Spotting phishing", "Privacy settings", "Safe sharing",
           "Your digital footprint", "Safety poster workshop"],
    "c2": ["Your data, your rules", "Password managers & 2FA", "Social engineering", "Scam calls & messages",
           "Safe public Wi-Fi", "Backups that work", "Scam-call role-play"],
    "c3": ["How data travels", "Your home network", "IP addresses & DNS", "Routers & firewalls", "Mapping a network",
           "Threat modelling", "Ethical hacking challenge"],
}

SPEC_TRACKS = [
    {"id": "cyber", "name": "Cybersecurity", "name_ar": "الأمن السيبراني", "short": "Cybersecurity",
     "color": "#1F6FEB", "tint": "#E4EEFF", "ink": "#14509E", "light": "#6FA4FF", "teacher": "marc", "room": "Lab 2",
     "pitch": "Learn how systems are attacked so you can defend them: networks, Linux, and capture-the-flag challenges.",
     "years": [{"g": "Grade 10 · Foundations", "t": "Networks, Linux and secure systems"},
               {"g": "Grade 11 · Applied", "t": "Defensive security and CTF competitions"},
               {"g": "Grade 12 · Capstone", "t": "Security audit of a real school system"}],
     "majors": ["Cybersecurity", "Computer & Communication Eng.", "Computer Science", "Digital Forensics"],
     "per_grade": [5, 4, 3]},
    {"id": "ai", "name": "AI & Data", "name_ar": "الذكاء الاصطناعي والبيانات", "short": "AI & Data",
     "color": "#7B3FF2", "tint": "#EFE7FF", "ink": "#5A27C2", "light": "#A98BFF", "teacher": "omar", "room": "Lab 1",
     "pitch": "Work with data, train models and build AI tools that solve real problems, with ethics built in.",
     "years": [{"g": "Grade 10 · Foundations", "t": "Python, statistics and data"},
               {"g": "Grade 11 · Applied", "t": "Machine learning projects"},
               {"g": "Grade 12 · Capstone", "t": "An AI tool for a school problem"}],
     "majors": ["Artificial Intelligence", "Data Science", "Computer Science", "Computational Linguistics"],
     "per_grade": [5, 5, 4]},
    {"id": "software", "name": "Software Development", "name_ar": "تطوير البرمجيات", "short": "Software Dev",
     "color": "#0B7D60", "tint": "#DCF4EA", "ink": "#0A6B52", "light": "#3CC79F", "teacher": "sami",
     "room": "Room 204",
     "pitch": "Design, build and ship apps and websites in teams, the way real software teams work.",
     "years": [{"g": "Grade 10 · Foundations", "t": "Web and app fundamentals"},
               {"g": "Grade 11 · Applied", "t": "Team software projects"},
               {"g": "Grade 12 · Capstone", "t": "Ship an app used by real people"}],
     "majors": ["Computer Science", "Software Engineering", "Computer & Communication Eng."],
     "per_grade": [4, 3, 4]},
    {"id": "design", "name": "Digital Design", "name_ar": "التصميم الرقمي", "short": "Digital Design",
     "color": "#D2461F", "tint": "#FFEAE2", "ink": "#A8361A", "light": "#FF8B66", "teacher": "nada",
     "room": "Design studio",
     "pitch": "From visual identity to user experience: design products and brands people love to use.",
     "years": [{"g": "Grade 10 · Foundations", "t": "Visual design and typography"},
               {"g": "Grade 11 · Applied", "t": "UX and product design"},
               {"g": "Grade 12 · Capstone", "t": "Brand and product for a local business"}],
     "majors": ["Graphic Design", "UX/UI Design", "Architecture", "Digital Media"],
     "per_grade": [2, 3, 3]},
    {"id": "robotics", "name": "Robotics & IoT", "name_ar": "الروبوتات وإنترنت الأشياء", "short": "Robotics & IoT",
     "color": "#B26B00", "tint": "#FFF1DE", "ink": "#8A4600", "light": "#FFB547", "teacher": "ziad",
     "room": "Makerspace",
     "pitch": "Electronics, sensors and code together: build connected devices and robots that act in the real world.",
     "years": [{"g": "Grade 10 · Foundations", "t": "Electronics and microcontrollers"},
               {"g": "Grade 11 · Applied", "t": "Sensors and connected devices"},
               {"g": "Grade 12 · Capstone", "t": "A working smart-device prototype"}],
     "majors": ["Mechatronics", "Electrical Engineering", "Computer & Communication Eng.", "Mechanical Engineering"],
     "per_grade": [2, 2, 2]},
]

SPEC_LESSONS = {
    "ai": ["Python refresher", "Tables and data types", "Cleaning messy data", "Charts that tell a story",
           "Statistics basics", "Capstone check-ins", "Your first model", "Train and test"],
    "cyber": ["Linux basics", "Users and permissions", "Networks deep dive", "Packet capture",
              "Hardening a server", "Capture-the-flag practice", "Web vulnerabilities", "Incident response"],
    "software": ["Git and teamwork", "HTML and CSS refresher", "JavaScript basics", "Working with APIs",
                 "Code review practice", "Shipping a release", "Databases 101", "Testing your code"],
    "design": ["Typography deep dive", "Grids and layout", "Colour systems", "User research",
               "Personas and journeys", "Prototyping", "Usability testing", "Design critique"],
    "robotics": ["Circuits and safety", "Your first microcontroller", "Sensors 101", "Motors and movement",
                 "Reading sensor data", "Connected devices", "Wireless basics", "Build sprint"],
}

DAYS = [("mon", "Monday", "Mon", 0, "Grade 7", "7"), ("tue", "Tuesday", "Tue", 1, "Grade 8", "8"),
        ("wed", "Wednesday", "Wed", 2, "Grades 10–12", "10"), ("thu", "Thursday", "Thu", 3, "Grade 9", "9")]

WEEK_PATTERN = {
    "mon": ["c1", "c1", "a1", "d1", "jr"],
    "tue": ["a2", "a2", "c2", "p2", "jr"],
    "wed": ["spec", "spec", "talk", "spec", "cap"],
    "thu": ["c3", "c3", "p3", "d3", "jr"],
}

DEFAULT_TIMING = {"start": 510, "end": 780, "sess": 50, "brk": 20, "per": 2}
WEEK_OVERRIDES = {7: {"start": 540, "end": 780, "sess": 45, "brk": 15, "per": 2}}
WEEK_NOTES = {7: "Starts 9:00 because of the school assembly"}

# ----------------------------------------------------------------- students
# Grade 9 gradebook (Cyber L3): name, class, W1–W5 homework (/20, M = missing), Cyber L3 attendance, quiz avg
GRADE9 = [
    ("Karim", "Haddad", "9-B", [17, 18, 19, 17, 18], "PPPPP", 88),
    ("Lea", "Mansour", "9-A", [19, 19, 18, 20, 19], "PPPPP", 94),
    ("Jad", "Frem", "9-C", [15, 14, 13, "M", "M"], "PPPLA", 61),
    ("Maya", "Khalil", "9-A", [18, 17, 18, 18, 17], "PPPPP", 85),
    ("Ali", "Hamdan", "9-D", [16, 15, 17, 16, 15], "PPPPL", 74),
    ("Sara", "Nassif", "9-B", [18, 19, 18, 19, 20], "PPPPP", 91),
    ("Hadi", "Tannous", "9-C", [14, 15, 16, 15, 16], "PPAPP", 70),
    ("Nour", "Saad", "9-D", [17, 16, 14, 12, 11], "PPPPP", 58),
    ("Yara", "Aoun", "9-A", [19, 18, 19, 19, 18], "PPPPP", 90),
    ("Omar", "Kassem", "9-B", [16, 17, 16, 17, 17], "PPPPP", 79),
    ("Tala", "Rizk", "9-C", [18, 18, 17, 19, 18], "PPPPP", 87),
    ("Elie", "Sfeir", "9-D", [13, 15, 14, 15, 14], "PLPPP", 66),
    ("Rayan", "Chamoun", "9-A", [17, 17, 18, 16, 17], "PPPPP", 81),
    ("Lina", "Azar", "9-B", [20, 19, 19, 20, 19], "PPPPP", 96),
    ("Karl", "Bou Saab", "9-C", [15, 16, 15, 16, 16], "PPPAP", 72),
    ("Zeina", "Haidar", "9-D", [18, 17, 18, 18, 19], "PPPPP", 86),
    ("Fadi", "Merhi", "9-A", [16, 16, 15, 17, 16], "PPPPP", 77),
    ("Joelle", "Najjar", "9-C", [17, 18, 17, 17, 18], "PPPPP", 84),
]
# Week 5 journals still waiting for Ms. Khoury
GRADE9_W5_UNGRADED = ["Tala", "Elie", "Rayan", "Lina", "Zeina", "Joelle"]
GRADE9_W1_4_TITLES = [
    ("journal", "Week 1 journal: how data reaches you", "Sat"),
    ("homework", "Draw your home network", "Sat"),
    ("journal", "Week 3 journal: what DNS knows about you", "Sat"),
    ("homework", "Check your router’s settings", "Sat"),
    ("journal", "Week 5 journal: your first network map", "Sat"),
]

# Named students with full profiles (admin Students screen)
PROFILES = {
    "Karim Haddad": {
        "parent": "Hala Haddad", "joined": "2024-09-01", "hw": 96, "streak": 28,
        "bio": "I like taking things apart to see how they work — networks especially. Next year I want to "
               "learn how to defend them properly.",
        "notes": [("rana", "Strong analytical thinker. Recommended for the Cybersecurity track."),
                  ("omar", "Careful and critical when checking AI answers.")],
        "activity": [("2026-10-21 17:10", "Read the tip from Ms. Khoury"),
                     ("2026-10-17 15:20", "Submitted week 5 journal · 18/20"),
                     ("2026-10-15 13:00", "Attended 4 of 4 sessions"),
                     ("2026-10-14 19:00", "Quiz “IP & DNS” · 9/10")],
        "name_ar": "كريم حداد",
    },
    "Jad Frem": {
        "parent": "Georges Frem", "joined": "2024-09-01", "hw": 60,
        "notes": [("rana", "Engaged in class discussions but not handing work in. Parent call planned for Monday.")],
        "activity": [("2026-10-15 08:30", "Absent · 4 sessions"),
                     ("2026-10-14 23:59", "Week 4 homework not submitted"),
                     ("2026-10-08 08:40", "Late to session 1"),
                     ("2026-10-01 18:00", "Quiz “Routers” · 6/10")],
        "no_survey": True,
    },
    "Nour Saad": {
        "parent": "Rima Saad", "joined": "2024-09-01", "hw": 90, "prev_cyber": 85,
        "notes": [("rana", "Hands in every homework on time; struggling with networking concepts. "
                           "Offered Friday catch-up.")],
        "activity": [("2026-10-17 12:00", "Submitted week 5 journal · 15/20"),
                     ("2026-10-14 18:30", "Quiz “IP & DNS” · 5/10"),
                     ("2026-10-08 18:00", "Quiz “Routers” · 6/10"),
                     ("2026-10-01 13:00", "Attended 4 of 4 sessions")],
    },
    "Lea Mansour": {
        "parent": "Carla Mansour", "joined": "2024-09-01", "hw": 100,
        "notes": [("omar", "Helps classmates with prompts. Could mentor Grade 7.")],
        "activity": [("2026-10-16 17:00", "Submitted week 5 journal · 19/20"),
                     ("2026-10-15 13:00", "Attended 4 of 4 sessions"),
                     ("2026-10-14 17:30", "Quiz “IP & DNS” · 10/10"),
                     ("2026-10-12 16:00", "Added project to portfolio")],
    },
    "Rami Gerges": {
        "grade": 8, "cls": "8-A", "parent": "Nadia Gerges", "joined": "2025-09-01", "hw": 70, "quiz": 72,
        "notes": [("rana", "Usually reliable. Absences are new; worth a call home.")],
        "activity": [("2026-10-20 08:30", "Absent · 4 sessions"), ("2026-10-13 08:30", "Absent · 4 sessions"),
                     ("2026-10-10 15:00", "Submitted homework · 14/20"), ("2026-10-06 11:30", "Late to session 3")],
        "absent_weeks": [5, 6], "late": {3: "c2"}, "levels_done_avg": {"cyber": 78, "ai": 74, "design": 70, "coding": 81},
    },
    "Ahmad Saleh": {
        "grade": 7, "cls": "7-B", "parent": "Mona Saleh", "joined": "2026-09-01", "hw": 92, "quiz": 81,
        "notes": [("rana", "Settling in well; very curious about how hackers think.")],
        "activity": [("2026-10-19 13:00", "Attended 4 of 4 sessions"),
                     ("2026-10-18 16:00", "Submitted “Strong passwords” homework · 18/20"),
                     ("2026-10-12 11:30", "Absent session 4 (dentist, excused)"),
                     ("2026-10-05 13:00", "Earned first badge")],
    },
    "Elias Nader": {
        "grade": 11, "cls": "11-A", "spec": "cyber", "parent": "Joseph Nader", "joined": "2022-09-01", "hw": 88,
        "quiz": 84, "stage": "Applied",
        "stages": [{"name": "Cybersecurity · Foundations", "pct": 100, "note": "Avg 88%"},
                   {"name": "Cybersecurity · Applied", "pct": 25, "note": "In progress"},
                   {"name": "Capstone", "pct": 0, "note": "Grade 12"}],
        "spec_note": ("Competitions", "School CTF team, placed 3rd in the regional student challenge in May."),
        "notes": [("marc", "Leads his CTF team. Ready for harder Linux challenges.")],
        "activity": [("2026-10-21 13:00", "Attended 4 of 4 sessions"), ("2026-10-18 17:00", "Submitted lab report · 17/20"),
                     ("2026-10-14 08:40", "Late to session 1"), ("2026-10-10 20:00", "Solved 6 CTF challenges")],
        "late_weeks": [5], "general_avg": 86,
    },
    "Sara Daou": {
        "grade": 12, "cls": "12-B", "spec": "ai", "parent": "Maha Daou", "joined": "2021-09-01", "hw": 97,
        "quiz": 91, "stage": "Capstone",
        "stages": [{"name": "AI & Data · Foundations", "pct": 100, "note": "Avg 91%"},
                   {"name": "AI & Data · Applied", "pct": 100, "note": "Avg 87%"},
                   {"name": "Capstone", "pct": 40, "note": "Prototype stage"}],
        "spec_note": ("Capstone project", "Predicting cafeteria food waste from menu and attendance data. "
                                          "Demo day in May."),
        "notes": [("omar", "Applying to Data Science programs. Asked for a recommendation letter.")],
        "activity": [("2026-10-21 12:30", "Capstone check-in · on schedule"),
                     ("2026-10-19 18:00", "Uploaded data-cleaning notebook"),
                     ("2026-10-14 13:00", "Attended 4 of 4 sessions"), ("2026-10-07 10:30", "Late to session 3")],
        "late_weeks": [4], "general_avg": 90,
    },
    "Tony Kfoury": {
        "grade": 10, "cls": "10-C", "spec": "robotics", "parent": "Rita Kfoury", "joined": "2023-09-01", "hw": 80,
        "quiz": 77, "stage": "Foundations",
        "stages": [{"name": "Robotics & IoT · Foundations", "pct": 20, "note": "In progress"},
                   {"name": "Robotics & IoT · Applied", "pct": 0, "note": "Grade 11"},
                   {"name": "Capstone", "pct": 0, "note": "Grade 12"}],
        "spec_note": ("Specialization", "Chose Robotics & IoT in April 2026 after the Try-a-track day."),
        "notes": [("ziad", "Great with hardware; needs support with the coding part.")],
        "activity": [("2026-10-21 13:00", "Attended 4 of 4 sessions"), ("2026-10-17 16:00", "Submitted sensor log · 15/20"),
                     ("2026-10-07 11:30", "Absent session 4"), ("2026-09-30 12:00", "Built first circuit")],
        "late_weeks": [4], "general_avg": 79,
    },
    "Yasmine Chidiac": {
        "grade": 12, "cls": "12-A", "spec": "software", "parent": "Paul Chidiac", "joined": "2021-09-01", "hw": 94,
        "quiz": 89, "stage": "Capstone",
        "stages": [{"name": "Software Dev · Foundations", "pct": 100, "note": "Avg 92%"},
                   {"name": "Software Dev · Applied", "pct": 100, "note": "Avg 89%"},
                   {"name": "Capstone", "pct": 55, "note": "Beta live"}],
        "spec_note": ("Capstone project", "A club sign-up app for the school, now used by 140 students."),
        "notes": [("sami", "Ships fast and writes clean code. Strong candidate for Computer Science.")],
        "activity": [("2026-10-21 12:00", "Released version 0.4 of the club app"),
                     ("2026-10-14 13:00", "Attended 4 of 4 sessions"), ("2026-10-10 16:00", "Code review · 19/20"),
                     ("2026-10-07 12:00", "Presented to Grade 9 open session")],
        "general_avg": 88,
    },
}

# Level mastery for Karim (knowledge tree / badges)
KARIM_LEVELS = {"c1": 96, "c2": 94, "a1": 88, "a2": 90, "d1": 85, "d2": 82, "p1": 93, "p2": 91}

# Karim's portfolio: track, level, title, kind, made_on, score, feedback, featured, art, skills
KARIM_PORTFOLIO = [
    ("cyber", "c3", "Home network map", "Diagram", "2026-10-17", "18/20",
     "Clear and neat. Mark guest devices next time.", False, [58, 34], ["Network mapping"]),
    ("ai", "a2", "Library FAQ chatbot", "Chatbot", "2026-03-20", "18/20",
     "The librarian actually uses it. Great testing with real questions.", True, [62, 30],
     ["Prompt crafting", "Python", "Debugging"]),
    ("coding", "p2", "Maze game in Python", "Game", "2026-05-22", "18/20",
     "Clean loops and a level editor nobody asked for — loved it.", True, [50, 22], ["Python", "Debugging"]),
    ("cyber", "c1", "Phishing awareness poster", "Poster", "2024-11-14", "19/20",
     "Now hanging in the Grade 7 corridor.", True, [64, 40], ["Spotting phishing"]),
    ("cyber", "c2", "Scam-call role-play script", "Script", "2025-10-16", "19/20",
     "Realistic and funny. The class remembered every red flag.", False, [54, 28],
     ["Spotting phishing", "Network mapping"]),
    ("design", "d2", "Robotics club logo redesign", "Branding", "2026-02-12", "16/20",
     "Strong mark; push contrast on the small version.", False, [60, 36], ["Brand identity"]),
    ("ai", "a1", "AI around me photo diary", "Journal", "2025-01-23", "17/20",
     "Sharp eye for where AI hides in daily apps.", False, [56, 26], ["Prompt crafting", "Spotting phishing"]),
    ("design", "d1", "School event poster", "Poster", "2025-03-13", "17/20",
     "Good hierarchy — the date is impossible to miss.", False, [52, 32], []),
    ("coding", "p1", "Animated story in blocks", "Animation", "2025-05-15", "19/20",
     "Debugged the timing bug on your own. Well done.", False, [60, 24], ["Debugging"]),
]

# Specialization inputs: student -> track -> (performance, interest, teacher_base, reasons)
KARIM_SPEC = {
    "cyber": (92, 85, 50, ["Your Cyber Level 1 and 2 scores are among the top in your grade (96% and 94%).",
                           "In the interest survey, “figuring out how things break” was your strongest answer.",
                           "Ms. Khoury recommended you for this track."]),
    "ai": (89, 72, 45, ["Your library FAQ chatbot is one of your featured projects.", "You scored 90% in AI Level 2.",
                        "Mr. Saleh noted your careful fact-checking of AI answers."]),
    "software": (92, 60, 50, ["93% and 91% in Coding Levels 1 and 2.",
                              "Your maze game went beyond the brief with a level editor.",
                              "Teacher recommendation still pending from Mr. Daher."]),
    "design": (84, 32, 40, ["Solid Design results (85% and 82%).",
                            "Design ranked lower in your interest survey than technical tracks.",
                            "Ms. Aoun suggests trying the UX module before deciding."]),
    "robotics": (80, 30, 20, ["No Robotics level in Grades 7–9, so results come from your Coding and Cyber work.",
                              "The Try-a-track day in March is the best way to test this one."]),
}
NOUR_SPEC = {"design": (90, 85, 55), "ai": (86, 72, 35), "cyber": (79, 50, 40), "software": (83, 45, 40),
             "robotics": (75, 30, 20)}
LEA_SPEC = {"ai": (93, 95, 55), "software": (90, 85, 70), "cyber": (97, 60, 50), "design": (95, 40, 40),
            "robotics": (80, 35, 20)}
# Grade 9 shortlists (excluding Karim, who hasn't saved one yet)
SHORTLIST_COUNTS = {"cyber": 7, "ai": 5, "software": 3, "design": 2, "robotics": 1}

# ------------------------------------------------------------------- lesson content
C3_W6_BLOCKS = [
    {"kind": "talk", "min": 10, "t": "Warm-up: how many devices?", "d": "Students share their home device counts"},
    {"kind": "teach", "min": 20, "t": "The four questions", "d": "Slides 1–9 · examples from a school network"},
    {"kind": "act", "min": 25, "t": "Threat hunt in a smart home", "d": "Teams of 3 · threat cards · floor plan",
     "desc": "Teams of 3 get a floor plan of a connected house. Find as many weak spots as you can in 25 minutes, "
             "then defend your top three to the class.", "badge": "Counts toward Threat Modeler badge"},
    {"kind": "talk", "min": 15, "t": "Defend your top three", "d": "Each team presents; class votes"},
    {"kind": "quiz", "min": 10, "t": "Exit ticket", "d": "3 questions · auto-graded · updates skill"},
    {"kind": "wrap", "min": 10, "t": "Homework briefing", "d": "Show rubric and due date"},
]
C3_LAST_YEAR_BLOCKS = [
    {"kind": "teach", "min": 30, "t": "The four questions", "d": "Slides 1–12 · lecture"},
    {"kind": "act", "min": 30, "t": "Threat hunt on paper", "d": "Pairs · worksheet"},
    {"kind": "talk", "min": 20, "t": "Class discussion", "d": "Whole class"},
    {"kind": "wrap", "min": 10, "t": "Homework briefing", "d": "Show rubric and due date"},
]
ESCAPE_ROOM_BLOCKS = [
    {"kind": "act", "min": 30, "t": "Phishing escape room", "d": "Teams of 4 · 5 locked envelopes · timer",
     "desc": "Teams crack five clues hidden in fake emails and texts to escape before the timer runs out."},
]
C3_W6_SLIDES = [
    {"title": "Threat modelling", "bullets": ["Week 6 · Cyber Awareness Level 3"]},
    {"title": "Why defenders think ahead", "bullets": ["Attackers look for the easiest way in",
                                                       "Defenders list the ways first"]},
    {"title": "Threat modelling in four questions", "bullets": ["What are we protecting?", "What can go wrong?",
                                                                "What will we do about it?", "Did it work?"]},
    {"title": "1 · What are we protecting?", "bullets": ["Devices", "Accounts", "Data", "People"]},
    {"title": "2 · What can go wrong?", "bullets": ["Weak passwords", "Old firmware", "Strangers on the network"]},
    {"title": "3 · What will we do about it?", "bullets": ["Fix it", "Reduce it", "Accept it"]},
    {"title": "4 · Did it work?", "bullets": ["Test the fix", "Check again next month"]},
    {"title": "Example: a school network", "bullets": ["Printers", "Smart boards", "Guest Wi-Fi"]},
    {"title": "Your turn", "bullets": ["Pick one device you use every day"]},
    {"title": "Threat hunt in a smart home", "bullets": ["Teams of 3", "25 minutes", "Floor plan + threat cards"]},
    {"title": "Scoring the threats", "bullets": ["How likely?", "How bad?"]},
    {"title": "Defend your top three", "bullets": ["One minute per team"]},
    {"title": "Exit ticket", "bullets": ["3 questions"]},
    {"title": "Homework", "bullets": ["Map the threats on your home Wi-Fi", "Due Wed 28 Oct"]},
]
C3_W6_HOMEWORK = {
    "title": "Map the threats on your home Wi-Fi", "title_ar": "ارسم خريطة التهديدات لشبكة الواي فاي في منزلك",
    "description": "Use the four questions from class on your own home network. Draw or list your devices, then pick "
                   "the three biggest risks and say what your family could do about each.",
    "rubric": [{"c": "At least 5 devices mapped", "p": 4}, {"c": "Three realistic risks identified", "p": 6},
               {"c": "A fix your family could actually do", "p": 6}, {"c": "Clear and neat presentation", "p": 4}],
}
RECAP_QUIZ = [
    {"text": "Which device connects your home network to the internet and directs traffic between them?",
     "options": ["Router", "Printer", "Smart TV", "Keyboard"], "a": 0,
     "why": "The router sits between your home devices and the internet, deciding where each packet goes."},
    {"text": "What does DNS do when you type a website name?",
     "options": ["Encrypts your password", "Turns the name into an IP address", "Makes Wi-Fi faster",
                 "Blocks every virus"], "a": 1,
     "why": "DNS is the internet’s phone book: it looks up the IP address behind a name like school.edu.lb."},
    {"text": "Your smart speaker gets a new IP address every morning. Which service hands it out?",
     "options": ["VPN", "HTTPS", "DHCP", "USB"], "a": 2,
     "why": "DHCP, usually running on your router, gives each device an address when it joins the network."},
    {"text": "Which is the safest choice for your home Wi-Fi password?",
     "options": ["The default printed on the router", "Your pet’s name", "12345678",
                 "A long passphrase of random words"], "a": 3,
     "why": "Length beats complexity: a long phrase of unrelated words is hard to guess and easy to remember."},
    {"text": "A firewall’s main job is to…",
     "options": ["Allow or block traffic based on rules", "Make downloads faster", "Back up your photos",
                 "Cool down the router"], "a": 0,
     "why": "A firewall checks traffic against rules and blocks what isn’t allowed."},
]
WEEKLY_QUIZ_TITLES = ["How data travels check", "Home network check", "Quiz “IP & DNS”", "Quiz “Routers”",
                      "Mapping a network check"]

TIPS = [
    # teacher, grades, when, text, text_ar
    ("rana", [9], "2026-10-21 16:30",
     "Before Thursday, sit with a parent and open your router’s admin page. Count the connected devices — we’ll use "
     "your number in the activity.",
     "قبل الخميس، اجلس مع أحد والديك وافتح صفحة إعدادات الراوتر. عُدّ الأجهزة المتّصلة، فسنستخدم هذا الرقم في نشاط الحصة."),
    ("omar", [9], "2026-10-19 10:00",
     "Our AI module starts in week 8 and you’ll train your own image classifier. Until then, notice which apps sort "
     "your photos automatically.",
     "تبدأ وحدة الذكاء الاصطناعي في الأسبوع 8 وستدرّب نموذجك الخاص للتعرّف على الصور. حتى ذلك الحين، لاحظ أيّ التطبيقات ترتّب صورك تلقائيًا."),
    ("rana", [8], "2026-10-19 09:15", "Set up your password manager before Tuesday — bring any questions to class.",
     None),
    ("rana", [7], "2026-10-16 12:00", "Try making a passphrase of four random words. Don’t share it with anyone!",
     None),
]

TEACHER_LOGS = {
    "rana": [("2026-10-21 16:30", "Sent a tip to Grade 9", False),
             ("2026-10-21 11:00", "Published week 6 homework for Grade 9", False),
             ("2026-10-19 09:00", "Uploaded week 6 slides, 3 days early", False),
             ("2026-10-17 20:00", "Graded 12 Grade 9 journals", False),
             ("2026-10-15 15:00", "Flagged Jad Frem and messaged his parent", False)],
    "omar": [("2026-10-21 12:30", "Ran capstone check-ins for 4 Grade 12 students", False),
             ("2026-10-20 18:00", "Graded 17 Grade 8 prompt journals", False),
             ("2026-10-19 08:00", "Uploaded week 6 slides", False),
             ("2026-10-19 10:00", "Sent a tip to Grade 9 about week 8", False)],
    "nada": [("2026-10-21 12:00", "Session ran with no homework set", True),
             ("2026-10-19 07:45", "Uploaded week 6 slides on the day of class", False),
             ("2026-10-17 18:00", "Graded 8 Grade 10–12 briefs", False),
             ("2026-10-14 16:00", "Added a UX module to the shared library", False)],
    "sami": [("2026-10-21 14:00", "Reviewed 3 capstone pull requests", False),
             ("2026-10-20 08:00", "Uploaded week 6 slides", False),
             ("2026-10-18 17:00", "Graded 11 Grade 10–12 code reviews", False),
             ("2026-10-14 15:00", "Shared “Phishing escape room” in the library", False)],
    "marc": [("2026-10-21 12:00", "Ran a capture-the-flag practice", False),
             ("2026-10-19 09:00", "Uploaded week 6 lab guide", False),
             ("2026-10-17 17:00", "Graded 12 lab reports", False),
             ("2026-10-14 15:30", "Registered the team for the spring challenge", False)],
    "ziad": [("2026-10-21 12:30", "Session ran without slides uploaded", True),
             ("2026-10-20 19:00", "Graded 6 sensor logs (5 days after due)", True),
             ("2026-10-07 08:30", "Session moved for a school event", False),
             ("2026-09-30 16:00", "Ordered 6 microcontroller kits", False)],
}

# ----------------------------------------------------------------- admissions
INTAKE = {"label": "Grade 7 intake for 2027–28", "year": "2027–28", "seats": 4}

# name, class, nominated by, grade avg, interest /10, assessment /20, status
NOMINEES = [
    ("Ahmad Zein", "6-A", "Ms. Haddad", 88, 9, 18, "acc"), ("Rita Khoury", "6-A", "Ms. Haddad", 92, 8, 17, "acc"),
    ("Samir Itani", "6-A", "Mr. Farah", 85, 7, 15, "wait"), ("Mira Saliba", "6-B", "Ms. Rizk", 90, 9, 19, "acc"),
    ("Tarek Yassine", "6-B", "Ms. Rizk", 82, 9, 16, "pend"), ("Celine Abboud", "6-B", "Mr. Farah", 87, 6, 14, "pend"),
    ("Bilal Osman", "6-C", "Ms. Kanaan", 79, 10, 18, "pend"), ("Dana Fakhoury", "6-C", "Ms. Kanaan", 91, 8, 16, "acc"),
    ("Georges Matar", "6-C", "Mr. Farah", 84, 7, 12, "wait"), ("Hala Sabbagh", "6-D", "Mr. Issa", 89, 9, 17, "pend"),
    ("Wassim Jaber", "6-D", "Mr. Issa", 76, 8, 15, "pend"), ("Nadine Harb", "6-D", "Ms. Rizk", 93, 7, 18, "acc"),
    ("Sami Hojeij", "6-E", "Ms. Chahine", 86, 10, 19, "pend"), ("Rouba Ghanem", "6-E", "Ms. Chahine", 80, 9, 17, "pend"),
    ("Ziad Tabbara", "6-E", "Mr. Issa", 88, 8, 13, "pend"),
]
# More nominees so the intake has its real size (31): 7 accepted, 4 waitlisted, 5 still assessing
EXTRA_NOMINEES = [
    ("Jana Moussa", "6-A", "Ms. Haddad", "acc"), ("Karim Rahal", "6-A", "Mr. Farah", "acc"),
    ("Lara Hobeika", "6-B", "Ms. Rizk", "acc"), ("Fouad Nasr", "6-B", "Mr. Farah", "acc"),
    ("Maya Sleiman", "6-C", "Ms. Kanaan", "acc"), ("Hassan Ali", "6-D", "Mr. Issa", "acc"),
    ("Nay Daou", "6-E", "Ms. Chahine", "acc"), ("Rawad Khalil", "6-A", "Ms. Haddad", "wait"),
    ("Tia Abi Nader", "6-B", "Ms. Rizk", "wait"), ("Charbel Aoun", "6-C", "Mr. Farah", "wait"),
    ("Layal Hachem", "6-D", "Mr. Issa", "wait"), ("Ghady Sayegh", "6-A", "Ms. Haddad", "inprog"),
    ("Joy Karam", "6-B", "Mr. Farah", "inprog"), ("Adam Fares", "6-C", "Ms. Kanaan", "inprog"),
    ("Perla Zgheib", "6-D", "Mr. Issa", "inprog"), ("Omar Ghandour", "6-E", "Ms. Chahine", "inprog"),
]


def P(type_, label, res, note, follow=False):
    return {"type": type_, "label": label, "res": res, "note": note, "follow": follow,
            "tag": {"right": "✓ Right", "wrong": "✗ Wrong", "strong": "Strong answer",
                    "weak": "Unclear answer"}.get(res, res)}


ASSESSMENTS = {
    "Bilal Osman": dict(
        cat="fit", conf="High", overall=90, qs=10, mins=24, suggest="accept",
        summary="Strong reasoning and curiosity, explains his thinking clearly, and learns quickly from hints.",
        dims=[92, 88, 90, 95, 85], interests=[["Coding", 45], ["AI", 30], ["Cyber", 15], ["Design", 10]],
        why=["Got the number pattern right and explained it: “each number is the two before it added together”.",
             "Right on the padlock question and gave a precise reason in the follow-up, so it wasn’t a guess.",
             "Canteen idea: order by phone before the break and pick up by number. Practical and original.",
             "Matches his teacher’s note: very curious, quieter in groups."],
        advice="Accept. In group activities, pair him with a talkative teammate; he contributes more in small teams.",
        context=["Average 79%", "Math 85%", "Science 88%", "Interest form 10/10"],
        note="Ms. Kanaan: “Always asks how things work. Quiet in group work.”",
        path=[P("MCQ", "Robot path", "right", "Right, so a harder pattern"),
              P("MCQ", "Number pattern", "right", "Right, so ask him to explain"),
              P("Open", "Explain the rule", "strong", "Clear, switch to digital awareness", True),
              P("T/F", "Padlock", "right", "50% guess rate, so ask why"),
              P("Open", "Why not trust it?", "strong", "Understands it, move to interests", True),
              P("Pick", "Interests", "Build a game", "Tech interest, so a tech creative problem"),
              P("Open", "Canteen idea", "strong", "Creative, raise the challenge"),
              P("MCQ", "Secret code", "right", "Right, so reverse the rule"),
              P("Short", "Decode IFMMP", "right", "Finish with reflection"),
              P("Open", "Reflection", "strong", "Done")]),
    "Sami Hojeij": dict(
        cat="fit", conf="High", overall=87, qs=9, mins=21, suggest="accept",
        summary="Sharp on digital safety; already thinks like a defender. Good reasoning, fast and accurate.",
        dims=[88, 94, 78, 90, 80], interests=[["Cyber", 55], ["Coding", 25], ["AI", 15], ["Design", 5]],
        why=["Gave the best padlock explanation in the group: “it protects the connection, not the truth”.",
             "Chose “find out how someone broke into a game account”.",
             "Solved the secret code and the reverse decode on the first try."],
        advice="Accept. Strong early cyber interest; a natural fit for the capture-the-flag club later on.",
        context=["Average 86%", "Math 90%", "Science 84%", "Interest form 9/10"],
        note="Ms. Chahine: “Helps classmates with their accounts and settings.”",
        path=[P("MCQ", "Robot path", "right", "Right, so a harder pattern"),
              P("MCQ", "Number pattern", "right", "Ask him to explain"),
              P("Open", "Explain the rule", "strong", "Switch to digital awareness", True),
              P("T/F", "Padlock", "right", "Ask why"), P("Open", "Why not trust it?", "strong", "Move to interests", True),
              P("Pick", "Interests", "Account hacking", "Tech creative problem"),
              P("Open", "Canteen idea", "strong", "Raise the challenge"),
              P("MCQ", "Secret code", "right", "Reverse the rule"), P("Short", "Decode IFMMP", "right", "Done")]),
    "Mira Saliba": dict(
        cat="fit", conf="High", overall=86, qs=10, mins=26, suggest="accept", decision="accept",
        summary="Most creative answers in the group, with solid reasoning. Strong design and AI interest.",
        dims=[82, 80, 95, 84, 90], interests=[["Design", 50], ["AI", 35], ["Coding", 10], ["Cyber", 5]],
        why=["Canteen idea included a screen showing wait times and a menu designed for younger students.",
             "Explained every answer in full sentences, in both Arabic and English.",
             "Needed a hint on the secret code, then solved it straight away."],
        advice="Accept. Already accepted on the nominee list.",
        context=["Average 90%", "Math 82%", "Art 97%", "Interest form 9/10"],
        note="Ms. Rizk: “Turns every project into something beautiful.”",
        path=[P("MCQ", "Robot path", "right", "Harder pattern"), P("MCQ", "Number pattern", "right", "Ask her to explain"),
              P("Open", "Explain the rule", "strong", "Switch topic", True), P("T/F", "Padlock", "right", "Ask why"),
              P("Open", "Why not trust it?", "strong", "Interests", True),
              P("Pick", "Interests", "Design a character", "Tech creative problem"),
              P("Open", "Canteen idea", "strong", "Raise the challenge"),
              P("MCQ", "Secret code", "wrong", "Give a hint and a retry"),
              P("MCQ", "Secret code + hint", "right", "Reflection", True), P("Open", "Reflection", "strong", "Done")]),
    "Hala Sabbagh": dict(
        cat="fit", conf="Medium", overall=84, qs=10, mins=28, suggest="accept",
        summary="Careful, methodical thinker with a clear interest in AI. Slower but very accurate.",
        dims=[85, 82, 80, 88, 86], interests=[["AI", 50], ["Coding", 30], ["Design", 15], ["Cyber", 5]],
        why=["Wrong on the robot question, then right on the simpler follow-up: the AI reads it as a misread, not a gap.",
             "Chose “teach a computer to recognize animals”.",
             "Reflection: “I read the question twice when I got it wrong.”"],
        advice="Accept. Confidence is medium only because of the first slip; everything after was strong.",
        context=["Average 89%", "Math 87%", "Science 92%", "Interest form 9/10"],
        note="Mr. Issa: “Never rushes. Checks her own work.”",
        path=[P("MCQ", "Robot path", "wrong", "Check: misread or gap?"),
              P("MCQ", "Turning follow-up", "right", "Misread, carry on", True), P("T/F", "Padlock", "right", "Ask why"),
              P("Open", "Why not trust it?", "strong", "Interests", True),
              P("Pick", "Interests", "Teach a computer", "Tech creative problem"),
              P("Open", "Canteen idea", "strong", "Raise the challenge"),
              P("MCQ", "Secret code", "right", "Reverse the rule"), P("Short", "Decode IFMMP", "right", "Reflection"),
              P("Open", "Reflection", "strong", "Done")]),
    "Tarek Yassine": dict(
        cat="unclear", conf="Low", overall=62, qs=11, mins=14, suggest="interview",
        summary="Right on most choice questions, but one-word answers whenever he had to explain. Could be guessing, "
                "shyness, or writing in English.",
        dims=[80, 70, 45, 60, 30], interests=[["Cyber", 50], ["Coding", 30], ["AI", 20]],
        why=["Right on 5 of 6 multiple-choice questions.",
             "Every “explain why” follow-up got one or two words (“i knew”, “idk”), so understanding couldn’t be "
             "confirmed.",
             "Wrong on the simpler scam-site re-check, which conflicts with his right true/false answer.",
             "Finished in 14 minutes, the fastest in the group."],
        advice="Invite him to a 10-minute interview in Arabic before deciding. He can also retake the assessment in "
               "Arabic.",
        context=["Average 82%", "Math 91%", "English 64%", "Interest form 9/10"],
        note="Ms. Rizk: “Brilliant at math. Answers more freely in Arabic.”",
        path=[P("MCQ", "Robot path", "right", "Harder pattern"), P("MCQ", "Number pattern", "right", "Ask him to explain"),
              P("Open", "Explain the rule", "weak", "Unclear, but keep going", True), P("T/F", "Padlock", "right", "Ask why"),
              P("Open", "Why not trust it?", "weak", "Re-check in a simpler format", True),
              P("MCQ", "Scam sites re-check", "wrong", "Conflicts with Q4", True),
              P("Pick", "Interests", "Account hacking", "Tech creative problem"),
              P("Open", "Canteen idea", "weak", "Challenge puzzle"), P("MCQ", "Secret code", "wrong", "Hint and retry"),
              P("MCQ", "Secret code + hint", "right", "Reflection", True), P("Open", "Reflection", "weak", "Done")]),
    "Celine Abboud": dict(
        cat="other", domain="Life sciences", conf="High", overall=81, qs=10, mins=25, suggest="refer",
        summary="A strong thinker whose real passion is biology. She doesn’t want computers involved, for now.",
        dims=[86, 75, 82, 80, 88], interests=[["Life sciences", 70], ["AI", 15], ["Design", 15]],
        why=["Strong reasoning: right on every puzzle, including the reverse decode.",
             "Chose “do an experiment with plants or animals”, then “not really” when offered a version with computers.",
             "Her open answers were rich and detailed, but always about nature and living things."],
        advice="Refer her to the school science club or a life-sciences program. Tell the family that AI & Data in "
               "Grade 10 includes biology projects, in case her interest grows.",
        context=["Average 87%", "Math 84%", "Science 98%", "Interest form 6/10"],
        note="Mr. Farah: “Runs the class plant project. Less excited about screens.”",
        path=[P("MCQ", "Robot path", "right", "Harder pattern"), P("MCQ", "Number pattern", "right", "Ask her to explain"),
              P("Open", "Explain the rule", "strong", "Switch topic", True), P("T/F", "Padlock", "right", "Ask why"),
              P("Open", "Why not trust it?", "strong", "Interests", True),
              P("Pick", "Interests", "Experiments", "Outside our tracks: look for a tech bridge"),
              P("Pick", "Link to tech?", "Not really", "No bridge: note the domain", True),
              P("MCQ", "Secret code", "right", "Reverse the rule"), P("Short", "Decode IFMMP", "right", "Reflection"),
              P("Open", "Reflection", "strong", "Done")]),
    "Ziad Tabbara": dict(
        cat="other", domain="Arts & music", conf="Medium", overall=74, qs=10, mins=27, suggest="refer",
        summary="Very creative storyteller and musician. Average on technical questions, open to tech only if it "
                "stays hands-on.",
        dims=[70, 65, 88, 72, 84], interests=[["Arts & music", 65], ["Design", 30], ["Coding", 5]],
        why=["The most imaginative canteen idea: a queue where each student picks the next song.",
             "Chose “write a story or make music”, then “maybe, if I can still do the hands-on part”.",
             "Average on reasoning and digital awareness."],
        advice="Two good options: refer him to the arts program, or accept him with a Digital Design focus if the "
               "family agrees. Worth a short call with the family.",
        context=["Average 88%", "Math 76%", "Music 99%", "Interest form 8/10"],
        note="Mr. Issa: “Plays oud at every school event.”",
        path=[P("MCQ", "Robot path", "right", "Harder pattern"),
              P("MCQ", "Number pattern", "wrong", "Move on to digital awareness"), P("T/F", "Padlock", "right", "Ask why"),
              P("Open", "Why not trust it?", "weak", "Simpler re-check", True),
              P("MCQ", "Scam sites re-check", "right", "Understands it", True),
              P("Pick", "Interests", "Story or music", "Look for a tech bridge"),
              P("Pick", "Link to tech?", "Maybe", "Partial bridge: Digital Design", True),
              P("MCQ", "Secret code", "right", "Reverse the rule"), P("Short", "Decode IFMMP", "wrong", "Reflection"),
              P("Open", "Reflection", "strong", "Done")]),
    "Wassim Jaber": dict(
        cat="support", conf="Medium", overall=52, qs=11, mins=35, suggest="notyet",
        summary="Struggled with reasoning and digital questions, but never gave up and made good use of every hint.",
        dims=[38, 45, 62, 85, 55], interests=[["Coding", 60], ["Design", 25], ["AI", 15]],
        why=["Wrong on the robot question and on the simpler follow-up, so this looks like a real gap, not a misread.",
             "Padlock: wrong, then an unclear explanation, then wrong on the simpler re-check.",
             "Secret code: wrong at first, then right after the hint. Strong persistence.",
             "Clearly wants to build games."],
        advice="Not this year. Offer the Friday open coding club and math support, then reassess in the spring. His "
               "persistence is a good sign.",
        context=["Average 76%", "Math 61%", "Science 72%", "Interest form 8/10"],
        note="Mr. Issa: “Loves computers, finds math hard. Works very hard.”",
        path=[P("MCQ", "Robot path", "wrong", "Check: misread or gap?"),
              P("MCQ", "Turning follow-up", "wrong", "Likely a gap", True),
              P("T/F", "Padlock", "wrong", "Teach the fact, then re-check"),
              P("Open", "Padlock fact", "weak", "Simpler format", True),
              P("MCQ", "Scam sites re-check", "wrong", "Move to interests", True),
              P("Pick", "Interests", "Build a game", "Tech creative problem"),
              P("Open", "Canteen idea", "strong", "Challenge puzzle"), P("MCQ", "Secret code", "wrong", "Hint and retry"),
              P("MCQ", "Secret code + hint", "right", "Reflection", True), P("Open", "Reflection", "strong", "Done")]),
}

# Names for the rest of the student body
FIRST_NAMES = [
    "Adam", "Ahmad", "Aya", "Bachir", "Celine", "Charbel", "Christa", "Dalia", "Dany", "Elio", "Farah", "Georges",
    "Ghinwa", "Hadi", "Hiba", "Houssam", "Ibrahim", "Jana", "Jessy", "Joseph", "Joud", "Kamal", "Karen", "Khaled",
    "Lara", "Layla", "Lynn", "Majd", "Marc", "Mariam", "Maria", "Mazen", "Mohammad", "Nadim", "Nadine", "Nasri",
    "Noor", "Paula", "Rania", "Rawan", "Reem", "Rita", "Riad", "Roy", "Salim", "Samar", "Sarah", "Selim", "Serena",
    "Tamara", "Tarek", "Theo", "Walid", "Yara", "Youssef", "Zahra", "Ziad", "Zeina", "Rabih", "Mia", "Antoine",
    "Elsa", "Hassan", "Leen", "Nabil", "Ralph", "Sandy", "Wael", "Yasmina",
]
LAST_NAMES = [
    "Abboud", "Abou Jaoude", "Akl", "Assaf", "Atallah", "Ayoub", "Bassil", "Bitar", "Chahine", "Daher", "Dagher",
    "Eid", "Fakhry", "Farhat", "Ghanem", "Haddad", "Hajj", "Halabi", "Hamdan", "Hayek", "Itani", "Jaber", "Kanaan",
    "Karam", "Khalife", "Khoury", "Maalouf", "Makhoul", "Mansour", "Moawad", "Nasr", "Rahme", "Saab", "Salameh",
    "Sarkis", "Sleiman", "Tabet", "Wehbe", "Yammine", "Zein", "Zoghbi", "Harb", "Rizk", "Fares", "Baz", "Hobeika",
]
AVATARS = ["#4E3CF5", "#1F6FEB", "#7B3FF2", "#0B7D60", "#D2461F", "#B26B00"]
