"""Family letters for intake decisions. Families see the decision and next steps only,
never the AI category or scores."""

DECISION_LABEL = {"accept": "Accepted", "waitlist": "Waitlist", "interview": "Interview",
                  "refer": "Referred", "notyet": "Not this year"}

_EN = {
    "accept": "We are delighted to offer {first} a place in Ithraa from Grade 7. We will share the start date and "
              "a short welcome guide in June.",
    "waitlist": "{first} is on the waiting list for Ithraa. If a seat opens, we will offer it automatically and "
                "contact you straight away.",
    "interview": "We would like to invite {first} to a short, friendly 10-minute conversation with our team. "
                 "We will contact you to agree on a time.",
    "refer": "{first} showed real strengths that fit another program especially well. We will share details of "
             "programs we recommend, and we are happy to talk them through with you.",
    "notyet": "This year we are not offering {first} a place. We would love {first} to join the Friday open club "
              "and to reassess in the spring.",
}
_AR = {
    "accept": "يسعدنا أن نعرض على {first} مقعدًا في برنامج إثراء ابتداءً من الصف السابع. سنشارككم موعد البدء ودليل ترحيب قصيرًا في حزيران.",
    "waitlist": "{first} على قائمة الانتظار في برنامج إثراء. إذا توفّر مقعد سنعرضه تلقائيًا ونتواصل معكم فورًا.",
    "interview": "نودّ دعوة {first} إلى محادثة ودّية قصيرة لمدة 10 دقائق مع فريقنا. سنتواصل معكم لتحديد الموعد.",
    "refer": "أظهر {first} نقاط قوة تناسب برنامجًا آخر بشكل خاص. سنشارككم تفاصيل البرامج التي نوصي بها ويسعدنا مناقشتها معكم.",
    "notyet": "لن نعرض على {first} مقعدًا هذا العام. يسعدنا انضمام {first} إلى النادي المفتوح أيام الجمعة وإعادة التقييم في الربيع.",
}


def family_letter(name: str, decision: str) -> tuple[str, str]:
    first = name.split()[0]
    en = f"Dear family of {name},\n\n{_EN[decision].format(first=first)}\n\nWarm regards,\nThe Ithraa team"
    ar = f"إلى عائلة {name} الكريمة،\n\n{_AR[decision].format(first=first)}\n\nمع أطيب التحيات،\nفريق إثراء"
    return en, ar
