"""Side effects shared by every role: activity timeline, notifications, parent messages."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import clock
from app.models import ActivityEvent, Notification, ParentMessage, StudentProfile, User


def log(db: Session, user_id: int, text: str, warn: bool = False) -> None:
    db.add(ActivityEvent(user_id=user_id, text=text, created_at=clock.now(), warn=warn))


def notify(db: Session, user_id: int, text: str, link: str | None = None, ref: str | None = None) -> bool:
    """Create a notification. With `ref`, it is created at most once per user."""
    if ref and db.scalar(select(Notification.id).where(Notification.user_id == user_id, Notification.ref == ref)):
        return False
    db.add(Notification(user_id=user_id, text=text, link=link, created_at=clock.now(), ref=ref))
    return True


def message_parent(db: Session, student_id: int, sender: User, text: str, kind: str = "message",
                   ref: str | None = None) -> ParentMessage | None:
    if ref and db.scalar(select(ParentMessage.id).where(ParentMessage.ref == ref)):
        return None
    m = ParentMessage(student_id=student_id, sender_id=sender.id, kind=kind, text=text,
                      created_at=clock.now(), ref=ref)
    db.add(m)
    return m


def parent_of(db: Session, student_id: int) -> str:
    s = db.get(StudentProfile, student_id)
    return s.parent_name if s else "the parent"
