# Calendar behavior

- Timed events use UTC instants. All-day events retain date-only starts and exclusive ends. Google expands recurrence within bounded windows; there is no local recurrence engine.
- Each selected source is fetched with complete pagination, including empty intermediate pages. A new immutable snapshot becomes active only after every page succeeds. Publication checks connection credentials and source access again under database locks.
- A successful replacement removes canceled events and occurrences moved out of range. Event detail references survive snapshot replacement. Superseded data is cleaned up by the daily worker job.
- Filtering happens before duplicate grouping. Invitation identity uses `iCalUID` and normalized original recurrence start; shared-calendar identity falls back to Google calendar and event IDs. Matching names and times alone never establish identity. Materially different copies remain separate variants.
- Overlaps use half-open intervals. Adjacent events do not conflict; canceled, declined, and explicitly free observations do not block availability. An accepted copy remains busy when another account declines. All-day busy behavior is a preference. Tentative and unanswered responses remain available in details.
- Missing, restricted, reconnecting, and stale sources produce explicit coverage notices. An empty array never proves availability when coverage is incomplete.
- The application refreshes active ranges toward a two-minute freshness target, pauses background polling when hidden, and supports manual refresh. Durable jobs deduplicate requests, back off retryable failures, and respect provider rate-limit delays. Discovery runs on connect, reconnect, manual refresh, and daily maintenance.
- Calendar filters and user preferences are stored in PostgreSQL in live mode. Mobile and desktop remember their time views separately. Search is explicitly limited to a selected window of at most 62 days.
