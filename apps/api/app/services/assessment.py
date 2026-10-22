"""Adaptive discovery assessment for Grade 6 nominees.

Every question depends on the answers before it: right answers on guessable questions
get a "why?" follow-up, wrong answers get a clarifying question to tell a misread from
a real gap, and the interest question routes to a tech-flavored or a bridging problem.
"""
from datetime import datetime

KW_PAD = ["fake", "scam", "lie", "anyone", "false", "wrong", "trick", "steal", "connection", "hack",
          "check", "private", "password", "مزيف", "احتيال", "كذب", "سرقة", "كلمة السر", "الاتصال"]

SKILLS = [("Reasoning", "#4E3CF5"), ("Digital awareness", "#1F6FEB"), ("Creativity", "#D2461F"),
          ("Persistence", "#0B7D60"), ("Communication", "#7B3FF2")]

INTERESTS = ["Coding (build a game)", "Cyber (how accounts get hacked)", "Design (posters, characters)",
             "AI (teach a computer)", "Life sciences (experiments)", "Arts & music (stories, music)"]
INTEREST_DOMAIN = ["Coding", "Cyber", "Design", "AI", "Life sciences", "Arts & music"]
INTEREST_PICK = ["Build a game", "Account hacking", "Design a character", "Teach a computer", "Experiments",
                 "Story or music"]

TYPE_LABEL = {"mcq": "Multiple choice", "tf": "True or false", "interest": "Pick what fits you",
              "open": "In your own words", "short": "Short answer"}

# Each node: type, skill, label, text, options/keywords, `next` rule, and the AI's reasoning (`why`).
N: dict[str, dict] = {
    "q1": {"type": "mcq", "skill": "Reasoning", "label": "Robot path",
           "text": "A robot walks 2 steps, then turns right. It does this 4 times. What shape does its path make?",
           "options": ["A square", "A triangle", "A straight line", "A circle"], "correct": 0,
           "why": "Warm-up on spatial reasoning, pitched for a Grade 6 student with {avg} average."},
    "q1c": {"type": "mcq", "skill": "Reasoning", "label": "Follow-up: turning", "clarify": True,
            "lead": "Let’s look at it another way",
            "text": "You face the board and turn right 4 times. Which way are you facing now?",
            "options": ["Toward the board again", "Toward the door", "To your left", "Behind you"], "correct": 0,
            "why": "Q1 was wrong. Before marking it as a gap, the AI checks whether {name} misread the steps or "
                   "really struggles with turns and direction."},
    "q2": {"type": "mcq", "skill": "Reasoning", "label": "Number pattern",
           "text": "What number comes next? 1, 1, 2, 3, 5, 8, …", "options": ["11", "13", "16", "10"], "correct": 1,
           "why": "Q1 was right, so difficulty goes up: each number depends on the two before it."},
    "q2o": {"type": "open", "skill": "Communication", "label": "Follow-up: explain the rule", "clarify": True,
            "lead": "Nice! One more thing",
            "text": "How did you find the rule? Explain it the way you would to a friend.",
            "keywords": ["add", "plus", "sum", "two", "before", "previous", "together", "+", "نجمع", "قبل"],
            "sample": ["Each number is the two numbers before it added together, so 5 + 8 = 13.", "i just knew it"],
            "why": "Follow-up on a right answer: multiple choice can be guessed, so the AI asks for the reasoning "
                   "and checks how clearly {name} explains."},
    "q3": {"type": "tf", "skill": "Digital awareness", "label": "Padlock true/false",
           "text": "True or false: if a website shows a padlock next to its address, everything on it is true and safe.",
           "options": ["True", "False"], "correct": 1,
           "why": "Switches to digital awareness, the starting point of Cyber Awareness Level 1."},
    "q3o": {"type": "open", "skill": "Digital awareness", "label": "Follow-up: why not?", "clarify": True,
            "lead": "Good thinking",
            "text": "Right, it can’t be fully trusted. What could still go wrong on a website with a padlock?",
            "keywords": KW_PAD,
            "sample": ["The padlock only means the connection is private. A scam site can have one too and still "
                       "lie or steal your password.", "idk"],
            "why": "True/false has a 50% guess rate. A right answer gets a “why” follow-up so a lucky guess isn’t "
                   "scored as knowledge."},
    "q3c": {"type": "open", "skill": "Digital awareness", "label": "Follow-up: padlock fact", "clarify": True,
            "lead": "Here’s a quick fact first",
            "text": "The padlock means nobody can spy on what you send to the site. Does that also mean the site’s "
                    "information is true? Explain in your own words.",
            "keywords": KW_PAD,
            "sample": ["No. It only protects the connection. A fake website can have a padlock and still trick you.",
                       "yes"],
            "why": "Q3 was wrong. Instead of just marking it, the AI teaches one fact and checks whether {name} can "
                   "reason with it. Learning on the spot is a strong signal."},
    "q3m": {"type": "mcq", "skill": "Digital awareness", "label": "Follow-up: scam sites", "clarify": True,
            "lead": "Let’s try it a different way", "text": "Which of these can a scam website ALSO have?",
            "options": ["A padlock icon", "A real bank’s logo", "A professional design", "All of these"], "correct": 3,
            "why": "The written answer was unclear. The same idea is checked in a simpler format, to separate a "
                   "writing difficulty from a knowledge gap."},
    "q4": {"type": "interest", "skill": "Interests", "label": "Interests",
           "text": "You have a free afternoon. Which sounds the most fun?",
           "options": ["Build a small game or app", "Find out how someone broke into a game account",
                       "Design a poster or a character", "Teach a computer to recognize animals",
                       "Do an experiment with plants or animals", "Write a story or make music"], "correct": -1,
           "why": "No right answer. Builds the interest profile, which helps spot students who would do better in a "
                  "domain the program doesn’t offer."},
    "q5t": {"type": "open", "skill": "Creativity", "label": "Canteen idea", "lead": "A real problem from your school",
            "text": "The canteen line is always long at break time. Describe an idea (an app, a game, a gadget, "
                    "anything) that could help.",
            "keywords": ["app", "order", "phone", "screen", "queue", "line", "robot", "time", "list", "number",
                         "online", "ticket", "game", "before", "تطبيق", "طلب", "شاشة"],
            "sample": ["An app where students order from their phone before the break, then pick up with a number "
                       "so nobody waits in line.", "make it faster"],
            "why": "{name}’s interest is in tech, so the creative question is a tech-flavored problem from their own "
                   "school. Open answers show imagination that multiple choice can’t."},
    "q5b": {"type": "interest", "skill": "Interests", "label": "Follow-up: link to tech", "clarify": True,
            "lead": "Great choice!",
            "text": "Would you enjoy using a computer for that too, like a program that counts birds in photos, or "
                    "an app that makes music?",
            "options": ["Yes, that sounds fun", "Maybe, if I can still do the hands-on part",
                        "Not really, I prefer it without computers"], "correct": -1,
            "why": "{name}’s interest is outside the program’s tracks. Before suggesting another domain, the AI "
                   "checks whether there is a bridge to tech."},
    "q6": {"type": "mcq", "skill": "Persistence", "label": "Secret code",
           "text": "Secret code: every letter moves one step forward in the alphabet, so CAT becomes DBU. "
                   "What does DOG become?",
           "options": ["EPH", "CNF", "DOH", "FQI"], "correct": 0,
           "why": "A harder puzzle to see how {name} handles a challenge. A wrong answer earns a hint and a second "
                  "try instead of a lower score."},
    "q6r": {"type": "mcq", "skill": "Persistence", "label": "Secret code, with hint", "clarify": True,
            "lead": "Almost! Here’s a hint",
            "hint": "Write the alphabet and move each letter one step forward: D → E, O → P.",
            "text": "Have another go. What does DOG become?", "options": ["EPH", "CNF", "DOH", "FQI"], "correct": 0,
            "why": "First try was wrong. Giving a hint and a retry measures persistence and how fast {name} learns "
                   "from help."},
    "q7": {"type": "short", "skill": "Reasoning", "label": "Decode IFMMP", "lead": "You cracked it!",
           "text": "Now go backwards: each letter moves one step BACK. Decode this word: IFMMP", "answer": "hello",
           "sample": ["HELLO", "IFMMP"],
           "why": "Right answer, so the challenge goes up: reversing a rule is harder than applying it."},
    "q8": {"type": "open", "skill": "Communication", "label": "Reflection", "lead": "Last one",
           "text": "Which question was hardest for you, and what did you do when you got stuck?",
           "keywords": ["tried", "again", "hint", "think", "slow", "wrote", "check", "alphabet", "guess", "read",
                        "paper", "step", "حاولت", "فكرت"],
           "sample": ["The secret code was hardest. I wrote the alphabet on paper and went letter by letter.", "none"],
           "why": "Reflection shows self-awareness and how a student copes with difficulty, which matters a lot in a "
                  "hands-on program."},
}


def next_node(cur: str, r: dict) -> str:
    match cur:
        case "q1":
            return "q2" if r["correct"] else "q1c"
        case "q1c":
            return "q3"
        case "q2":
            return "q2o" if r["correct"] else "q3"
        case "q2o":
            return "q3"
        case "q3":
            return "q3o" if r["correct"] else "q3c"
        case "q3o" | "q3c":
            return "q4" if r["quality"] == "good" else "q3m"
        case "q3m":
            return "q4"
        case "q4":
            return "q5t" if r["choice"] <= 3 else "q5b"
        case "q5t" | "q5b":
            return "q6"
        case "q6":
            return "q7" if r["correct"] else "q6r"
        case "q6r" | "q7":
            return "q8"
        case _:
            return "end"


def evaluate(cur: str, choice: int | None, text: str) -> dict:
    node = N[cur]
    r: dict = {"id": cur, "choice": choice, "text": text}
    t = node["type"]
    if t in ("mcq", "tf"):
        r["correct"] = choice == node["correct"]
        r["score"] = 100 if r["correct"] else 20
    elif t == "interest":
        r["score"] = None
        r["pick"] = node["options"][choice]
    elif t == "open":
        low = text.lower()
        good = len(text.strip()) >= 20 and any(k in low for k in node["keywords"])
        r["quality"] = "good" if good else "weak"
        r["score"] = 90 if good else 35
    elif t == "short":
        r["correct"] = text.strip().lower() == node["answer"]
        r["score"] = 100 if r["correct"] else 30
    if cur == "q6":
        r["score"] = 85 if r["correct"] else 30
    if cur == "q6r":
        r["score"] = 95 if r["correct"] else 55
    if cur == "q1c" and r.get("correct"):
        r["score"] = 70
    return r


def answered(node: dict, choice: int | None, text: str) -> bool:
    if node["type"] in ("mcq", "tf", "interest"):
        return choice is not None and 0 <= choice < len(node["options"])
    return bool(text.strip())


def signals(hist: list[dict]) -> list[dict]:
    out = []
    for name, color in SKILLS:
        xs = [h["score"] for h in hist if N[h["id"]]["skill"] == name and h.get("score") is not None]
        v = round(sum(xs) / len(xs)) if xs else None
        out.append({"name": name, "color": color, "v": v})
    return out


def interest_text(hist: list[dict]) -> str:
    q4 = next((h for h in hist if h["id"] == "q4"), None)
    q5b = next((h for h in hist if h["id"] == "q5b"), None)
    s = INTERESTS[q4["choice"]] if q4 else "not asked yet"
    if q5b:
        s += [" · open to tech", " · partly open to tech", " · prefers no computers"][q5b["choice"]]
    return s


def recommendation(hist: list[dict]) -> tuple[str, str]:
    """(category, label). Categories: fit | unclear | other | support."""
    vals = [s["v"] for s in signals(hist) if s["v"] is not None]
    overall = sum(vals) / len(vals) if vals else 0
    q4 = next((h for h in hist if h["id"] == "q4"), None)
    q5b = next((h for h in hist if h["id"] == "q5b"), None)
    tech = bool(q4) and (q4["choice"] <= 3 or bool(q5b and q5b["choice"] == 0))
    if q4 and not tech and q5b and q5b["choice"] == 2:
        return "other", "Better fit elsewhere · " + ("Life sciences" if q4["choice"] == 4 else "Arts & music")
    if tech and overall >= 75:
        return "fit", "Strong fit · accept"
    if overall < 50:
        return "support", "Not ready yet · support plan, reassess in spring"
    return "unclear", "Needs a closer look · suggest a short interview"


def tag_of(h: dict) -> dict:
    n = N[h["id"]]
    if n["type"] == "interest":
        return {"tag": n["options"][h["choice"]], "res": "pick"}
    if n["type"] == "open":
        return {"tag": "Strong answer" if h["quality"] == "good" else "Unclear answer",
                "res": "strong" if h["quality"] == "good" else "weak"}
    return {"tag": "✓ Right" if h["correct"] else "✗ Wrong", "res": "right" if h["correct"] else "wrong"}


NEXT_NOTE = {
    "q1": ("Right, so a harder pattern", "Check: misread or gap?"),
    "q1c": ("Misread, carry on", "Likely a gap"),
    "q2": ("Right, so ask for the rule", "Move on to digital awareness"),
    "q3": ("50% guess rate, so ask why", "Teach the fact, then re-check"),
    "q6": ("Right, so reverse the rule", "Give a hint and a retry"),
    "q6r": ("Reflection", "Reflection"),
    "q7": ("Finish with reflection", "Reflection"),
}


def path(hist: list[dict]) -> list[dict]:
    out = []
    for h in hist:
        n = N[h["id"]]
        t = {"mcq": "MCQ", "tf": "T/F", "open": "Open", "short": "Short", "interest": "Pick"}[n["type"]]
        tg = tag_of(h)
        if h["id"] in NEXT_NOTE:
            note = NEXT_NOTE[h["id"]][0 if h.get("correct") else 1]
        elif n["type"] == "open":
            note = "Clear, move on" if h["quality"] == "good" else "Unclear, re-check in a simpler format"
        elif h["id"] == "q4":
            note = "Tech interest, so a tech creative problem" if h["choice"] <= 3 else "Outside our tracks: look for a tech bridge"
        elif h["id"] == "q5b":
            note = ["Bridge found", "Partial bridge: Digital Design", "No bridge: note the domain"][h["choice"]]
        else:
            note = "Next"
        if h["id"] == "q8":
            note = "Done"
        out.append({"type": t, "label": n["label"], "res": tg["res"], "tag": tg["tag"], "note": note,
                    "follow": bool(n.get("clarify"))})
    return out


def finalize(hist: list[dict], name: str, started: datetime, finished: datetime) -> dict:
    """Turn an answer history into the admin report fields."""
    sig = signals(hist)
    vals = [s["v"] for s in sig if s["v"] is not None]
    overall = round(sum(vals) / len(vals)) if vals else 0
    dims = [s["v"] if s["v"] is not None else overall for s in sig]
    cat, _ = recommendation(hist)
    q4 = next((h for h in hist if h["id"] == "q4"), None)
    q5b = next((h for h in hist if h["id"] == "q5b"), None)
    weak = sum(1 for h in hist if h.get("quality") == "weak")
    wrong = sum(1 for h in hist if h.get("correct") is False)
    conf = "High" if weak == 0 and wrong <= 1 else ("Medium" if weak <= 1 else "Low")

    interests: list[list] = []
    domain = None
    if q4:
        main = INTEREST_DOMAIN[q4["choice"]]
        interests.append([main, 60])
        rest = [d for d in ("Coding", "AI", "Cyber", "Design") if d != main][:2]
        interests += [[rest[0], 25], [rest[1], 15]]
        if cat == "other":
            domain = main

    why: list[str] = []
    for h in hist:
        n = N[h["id"]]
        if h["id"] == "q2o" and h.get("quality") == "good":
            why.append(f"Got the number pattern right and explained it: “{h['text'].strip()[:90]}”.")
        elif h["id"] in ("q3o", "q3c") and h.get("quality") == "good":
            why.append("Explained the padlock question in their own words, so it wasn’t a guess.")
        elif n["type"] == "open" and h.get("quality") == "weak" and h["id"] != "q8":
            why.append(f"“{n['label']}” got a very short answer (“{h['text'].strip()[:20]}”), so understanding "
                       "couldn’t be confirmed.")
        elif h["id"] == "q5t" and h.get("quality") == "good":
            why.append(f"Canteen idea: {h['text'].strip()[:110]}")
        elif h["id"] == "q6r" and h.get("correct"):
            why.append("Secret code: wrong at first, then right after the hint. Strong persistence.")
        elif h["id"] == "q1c":
            why.append("Wrong on the robot question, then " + (
                "right on the simpler follow-up: reads as a misread, not a gap." if h["correct"]
                else "wrong on the simpler follow-up too, so this looks like a real gap."))
    if q4:
        why.append(f"Chose “{N['q4']['options'][q4['choice']].lower()}”" + (
            f", then “{N['q5b']['options'][q5b['choice']].lower()}” when offered a tech version." if q5b else "."))

    advice = {
        "fit": f"Accept. {name} showed strong reasoning and a clear interest in the program’s tracks.",
        "unclear": f"Invite {name} to a 10-minute interview before deciding. They can also retake the assessment "
                   "in Arabic.",
        "other": f"Refer {name} to a program in {domain or 'their area of interest'}, and tell the family how the "
                 "Ithraa tracks connect to it in case the interest grows.",
        "support": "Not this year. Offer the Friday open coding club and math support, then reassess in the spring.",
    }[cat]
    summary = {
        "fit": "Strong reasoning and curiosity across the assessment, with a clear interest in technology.",
        "unclear": "Mixed signals: right on several choice questions but short answers whenever an explanation "
                   "was needed.",
        "other": "A capable thinker whose strongest interest lies outside the program’s tech tracks.",
        "support": "Struggled with reasoning and digital questions, but kept going and used the hints.",
    }[cat]
    suggest = {"fit": "accept", "unclear": "interview", "other": "refer", "support": "notyet"}[cat]
    return {
        "category": cat, "domain": domain, "confidence": conf, "overall": overall, "dims": dims,
        "interests": interests, "why": why[:4] or ["Answered every question."], "advice": advice,
        "summary": summary, "suggest": suggest, "questions": len(hist),
        "minutes": max(1, round((finished - started).total_seconds() / 60)), "path": path(hist),
    }
