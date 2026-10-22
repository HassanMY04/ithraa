"""School-local clock and calendar helpers.

All timestamps are stored as naive school-local datetimes. In demo mode the
clock is frozen at ITHRAA_DEMO_NOW so seeded data stays meaningful.
"""
from datetime import date, datetime, timedelta

from app.core.config import get_settings

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August",
               "September", "October", "November", "December"]
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
MONTHS_AR = ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول",
             "تشرين الأول", "تشرين الثاني", "كانون الأول"]
DAYS_AR = ["الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"]


def now() -> datetime:
    s = get_settings()
    if s.demo_mode and s.demo_now:
        return s.demo_now
    return datetime.now().replace(microsecond=0)


def today() -> date:
    return now().date()


def week_of(d: date) -> int:
    """Program week number (1-based) for a date. Weekends belong to the week before."""
    delta = (d - get_settings().week1_monday).days
    return delta // 7 + 1


def current_week() -> int:
    return max(1, min(get_settings().total_weeks, week_of(today())))


def monday_of(week: int) -> date:
    return get_settings().week1_monday + timedelta(days=(week - 1) * 7)


def date_of(week: int, day_offset: int) -> date:
    return monday_of(week) + timedelta(days=day_offset)


def fmt_clock(minutes: int) -> str:
    """510 -> '8:30' (12-hour, no suffix), as the schedule grid shows it."""
    h, m = divmod(minutes, 60)
    return f"{h - 12 if h > 12 else h}:{m:02d}"


def fmt_time(minutes: int) -> str:
    """780 -> '1:00 PM'."""
    h, m = divmod(minutes, 60)
    suffix = "PM" if h >= 12 else "AM"
    return f"{h - 12 if h > 12 else h}:{m:02d} {suffix}"


def fmt_range(start: int, end: int) -> str:
    """Time range with a single suffix: '8:30–10:10 AM', '12:30–1:00 PM'."""
    s_suffix = "PM" if start >= 720 else "AM"
    e_suffix = "PM" if end >= 720 else "AM"
    if s_suffix == e_suffix:
        return f"{fmt_clock(start)}–{fmt_clock(end)} {e_suffix}"
    return f"{fmt_time(start)}–{fmt_time(end)}"


def fmt_day(d: date) -> str:
    """'Thu 22 Oct'."""
    return f"{DAYS_SHORT[d.weekday()]} {d.day} {MONTHS[d.month - 1]}"


def fmt_long(d: date) -> str:
    """'Wednesday, 21 October'."""
    return f"{DAYS[d.weekday()]}, {d.day} {MONTHS_LONG[d.month - 1]}"


def fmt_long_ar(d: date) -> str:
    return f"{DAYS_AR[d.weekday()]}، {d.day} {MONTHS_AR[d.month - 1]}"


def fmt_dm(d: date) -> str:
    """'19 Oct'."""
    return f"{d.day} {MONTHS[d.month - 1]}"


def fmt_month_year(d: date) -> str:
    return f"{MONTHS[d.month - 1]} {d.year}"


def relative(ts: datetime) -> str:
    """Short relative time: '2 h ago', 'Today', 'Mon', '12 Oct'."""
    n = now()
    delta = n - ts
    if delta < timedelta(minutes=1):
        return "just now"
    if delta < timedelta(hours=1):
        return f"{int(delta.total_seconds() // 60)} min ago"
    if ts.date() == n.date():
        return f"{int(delta.total_seconds() // 3600)} h ago"
    if delta < timedelta(days=7):
        return DAYS_SHORT[ts.weekday()]
    return fmt_dm(ts.date())


def relative_ar(ts: datetime) -> str:
    n = now()
    delta = n - ts
    if ts.date() == n.date():
        h = int(delta.total_seconds() // 3600)
        return "منذ ساعتين" if h == 2 else (f"منذ {h} ساعات" if h > 2 else "منذ قليل")
    if delta < timedelta(days=7):
        return DAYS_AR[ts.weekday()]
    return f"{ts.day} {MONTHS_AR[ts.month - 1]}"


def greeting(lang: str = "en") -> str:
    h = now().hour
    if lang == "ar":
        return "صباح الخير" if h < 12 else "مساء الخير"
    if h < 12:
        return "Good morning"
    if h < 17:
        return "Good afternoon"
    return "Good evening"
