"""Read-only access to the user's macOS Calendar via EventKit.

First use triggers a one-time macOS permission prompt (attributed to the
terminal app hosting the backend). Denied or missing access returns a
friendly instruction string instead of raising — the calendar tool must
never break a chat or voice reply.
"""
import asyncio
import datetime
import logging
import threading

logger = logging.getLogger(__name__)

_ACCESS_HINT = (
    "Calendar access is not granted. Open System Settings → Privacy & "
    "Security → Calendars and enable access for the app that runs ARIA "
    "(usually Terminal), then try again."
)

_MAX_EVENTS = 50


def _fetch_events_sync(days_ahead: int) -> str:
    from EventKit import EKEventStore, EKEntityTypeEvent
    from Foundation import NSDate

    store = EKEventStore.alloc().init()

    done = threading.Event()
    outcome = {"granted": False}

    def _completion(granted, error):
        outcome["granted"] = bool(granted)
        done.set()

    # macOS 14 renamed the request API; keep the older selector as fallback.
    if store.respondsToSelector_("requestFullAccessToEventsWithCompletion:"):
        store.requestFullAccessToEventsWithCompletion_(_completion)
    else:
        store.requestAccessToEntityType_completion_(EKEntityTypeEvent, _completion)

    if not done.wait(timeout=30) or not outcome["granted"]:
        return _ACCESS_HINT

    start = NSDate.date()
    end = NSDate.dateWithTimeIntervalSinceNow_(days_ahead * 86400)
    predicate = store.predicateForEventsWithStartDate_endDate_calendars_(start, end, None)
    events = store.eventsMatchingPredicate_(predicate) or []
    events = sorted(events, key=lambda e: e.startDate().timeIntervalSince1970())

    if not events:
        return f"No calendar events in the next {days_ahead} day(s)."

    lines = [f"Calendar events for the next {days_ahead} day(s):"]
    for event in events[:_MAX_EVENTS]:
        start_dt = datetime.datetime.fromtimestamp(event.startDate().timeIntervalSince1970())
        end_dt = datetime.datetime.fromtimestamp(event.endDate().timeIntervalSince1970())
        if event.isAllDay():
            when = f"{start_dt:%a %b %-d} (all day)"
        else:
            when = f"{start_dt:%a %b %-d %H:%M}–{end_dt:%H:%M}"
        line = f"- {when}: {event.title()}"
        if event.location():
            line += f" @ {event.location()}"
        calendar = event.calendar()
        if calendar is not None:
            line += f" [{calendar.title()}]"
        lines.append(line)
    if len(events) > _MAX_EVENTS:
        lines.append(f"[showing {_MAX_EVENTS} of {len(events)} events]")
    return "\n".join(lines)


async def get_upcoming_events(days_ahead: int = 7) -> str:
    """Formatted upcoming events, or a friendly error string. Never raises."""
    try:
        return await asyncio.to_thread(_fetch_events_sync, days_ahead)
    except ImportError:
        return (
            "Calendar support isn't installed — run: "
            "pip install pyobjc-framework-EventKit in backend/.venv"
        )
    except Exception as e:
        logger.warning(f"Calendar lookup failed: {e}")
        return f"Calendar lookup failed: {e}"
