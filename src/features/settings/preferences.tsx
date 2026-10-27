"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Sun,
  Moon,
  Monitor,
  Globe,
  ShieldCheck,
  ArrowUpRight,
  RotateCcw,
  Command,
  Settings2,
  Database,
  ExternalLink,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace";
import { Button, Modal } from "@/components/ui";
import { DEFAULT_PREFERENCES, type Preferences } from "@/lib/shared/types";
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`toggle ${checked ? "on" : ""}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}
export function PreferencesPage() {
  const {
    preferences,
    updatePreferences,
    setupRequired,
    missing,
    notify,
    hydrated,
  } = useWorkspace();
  const [draft, setDraft] = useState(preferences),
    [saving, setSaving] = useState(false);
  useEffect(() => setDraft(preferences), [preferences]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(preferences);
  const zones = useMemo(
    () => [
      ...new Set([
        "Asia/Kolkata",
        "UTC",
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        "America/New_York",
        "America/Los_Angeles",
        "Europe/London",
        "Europe/Berlin",
        "Asia/Dubai",
        "Asia/Singapore",
        "Asia/Tokyo",
        "Australia/Sydney",
        ...Intl.supportedValuesOf("timeZone"),
      ]),
    ],
    [],
  );
  function patch(p: Partial<Preferences>) {
    setDraft((d) => ({ ...d, ...p }));
  }
  async function save() {
    setSaving(true);
    try {
      await updatePreferences(draft);
      notify("A little more you. Your preferences are saved.");
    } catch {
      notify("Your preferences couldn’t be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }
  if (!hydrated)
    return (
      <div className="content-page settings-page">
        <section className="page-heading">
          <div>
            <h1>Make yourself at home.</h1>
            <p>Loading your preferences…</p>
          </div>
        </section>
      </div>
    );
  return (
    <div className="content-page settings-page">
      <section className="page-heading">
        <div>
          <h1>
            Make yourself at home<span className="heading-period">.</span>
          </h1>
          <p>A few small details. A workspace that feels like you.</p>
        </div>
        <Button variant="primary" disabled={!dirty || saving} onClick={save}>
          <Check size={16} />
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </section>
      <div className="settings-layout">
        <div className="settings-main">
          <section className="settings-section">
            <div className="settings-section-heading">
              <h2>Your time, your way</h2>
              <p>The right perspective on every part of your day.</p>
            </div>
            <div className="setting-row">
              <div>
                <label htmlFor="time-zone">Time zone</label>
                <p>
                  Your events adjust automatically. All-day dates stay as
                  intended.
                </p>
              </div>
              <select
                id="time-zone"
                value={draft.timeZone}
                onChange={(e) => patch({ timeZone: e.target.value })}
              >
                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="setting-row">
              <div>
                <label htmlFor="clock-format">Clock format</label>
                <p>Choose the way you read the time.</p>
              </div>
              <select
                id="clock-format"
                value={draft.clock}
                onChange={(e) =>
                  patch({ clock: e.target.value as "12" | "24" })
                }
              >
                <option value="12">12-hour · 3:00 PM</option>
                <option value="24">24-hour · 15:00</option>
              </select>
            </div>
            <div className="setting-row">
              <div>
                <label htmlFor="week-start">Start the week on</label>
                <p>A fresh start, on your terms.</p>
              </div>
              <select
                id="week-start"
                value={draft.weekStart}
                onChange={(e) =>
                  patch({ weekStart: Number(e.target.value) as 0 | 1 })
                }
              >
                <option value={1}>Monday</option>
                <option value={0}>Sunday</option>
              </select>
            </div>
            <div className="setting-row">
              <div>
                <b>Show weekends</b>
                <p>A complete week, or a little more focus on workdays.</p>
              </div>
              <Toggle
                label="Show weekends"
                checked={draft.showWeekends}
                onChange={(showWeekends) => patch({ showWeekends })}
              />
            </div>
          </section>
          <section className="settings-section">
            <div className="settings-section-heading">
              <h2>Room for focused work</h2>
              <p>Set the boundaries that make your day feel better.</p>
            </div>
            <div className="setting-row">
              <div>
                <b>Working hours</b>
                <p>A visual guide for your calendar. No events are hidden.</p>
              </div>
              <div className="working-hours">
                <input
                  type="time"
                  aria-label="Working day starts"
                  value={draft.workingStart}
                  onChange={(e) => patch({ workingStart: e.target.value })}
                />
                <span>to</span>
                <input
                  type="time"
                  aria-label="Working day ends"
                  value={draft.workingEnd}
                  onChange={(e) => patch({ workingEnd: e.target.value })}
                />
              </div>
            </div>
            <div className="setting-row">
              <div>
                <b>Group duplicate invitations</b>
                <p>
                  One meeting, one event. Every original source stays visible.
                </p>
              </div>
              <Toggle
                label="Group duplicate invitations"
                checked={draft.groupDuplicates}
                onChange={(groupDuplicates) => patch({ groupDuplicates })}
              />
            </div>
            <div className="setting-row">
              <div>
                <b>All-day events count as busy</b>
                <p>
                  Include busy all-day commitments when checking for overlaps.
                </p>
              </div>
              <Toggle
                label="Count all-day events as busy"
                checked={draft.allDayBusy}
                onChange={(allDayBusy) => patch({ allDayBusy })}
              />
            </div>
          </section>
          <section className="settings-section">
            <div className="settings-section-heading">
              <h2>A comfortable view</h2>
              <p>Set the mood for your workspace.</p>
            </div>
            <div className="appearance-options">
              {(
                [
                  ["light", "Light", Sun],
                  ["dark", "Dark", Moon],
                  ["system", "System", Monitor],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  className={`${key} ${draft.appearance === key ? "active" : ""}`}
                  aria-pressed={draft.appearance === key}
                  onClick={() => patch({ appearance: key })}
                >
                  <span className="appearance-preview">
                    <i className="preview-rail" />
                    <i className="preview-line p1" />
                    <i className="preview-line p2" />
                    <i className="preview-event" />
                  </span>
                  <span>
                    <Icon size={15} />
                    {label}
                    {draft.appearance === key ? <Check size={14} /> : null}
                  </span>
                </button>
              ))}
            </div>
          </section>
          <section className="settings-section setup-section" id="setup">
            <div className="settings-section-heading">
              <h2>Your private workspace</h2>
              <p>
                {setupRequired
                  ? "Connect your Google calendars when your workspace is configured."
                  : "Your connected accounts stay yours."}
              </p>
            </div>
            <div className="workspace-security">
              <ShieldCheck size={22} />
              <div>
                <b>
                  {setupRequired
                    ? "Workspace setup required"
                    : "Read-only. Owner-only. Private."}
                </b>
                <p>
                  {setupRequired
                    ? "Your calendar is empty. Configure your private workspace to connect Google accounts. Preferences are saved on this device until setup is complete."
                    : "Calendar credentials are encrypted on the server. Private event data is never persisted in browser storage."}
                </p>
              </div>
            </div>
            {setupRequired ? (
              <>
                <p className="setup-instructions">
                  Follow the project README to start PostgreSQL, apply
                  migrations, create your Google OAuth client, and run the
                  calendar worker.
                </p>
                <div className="setup-checklist">
                  {[
                    ["Database", "DATABASE_URL"],
                    ["Owner identity", "OWNER_EMAIL"],
                    ["Google authorization", "GOOGLE_CLIENT_ID"],
                    ["Application session", "BETTER_AUTH_SECRET"],
                    ["Token encryption", "TOKEN_ENCRYPTION_KEY"],
                  ].map(([label, key]) => (
                    <div key={key}>
                      <span
                        className={
                          missing.includes(key)
                            ? "setup-pending"
                            : "setup-ready"
                        }
                      >
                        {missing.includes(key) ? "○" : <Check size={12} />}
                      </span>
                      <span>{label}</span>
                      <small>
                        {missing.includes(key)
                          ? "Needs configuration"
                          : "Configured"}
                      </small>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <a
                className="text-link"
                href="https://myaccount.google.com/connections"
                target="_blank"
                rel="noreferrer"
              >
                Manage Google permissions <ExternalLink size={13} />
              </a>
            )}
          </section>
          <div className="settings-save-footer">
            <span>
              {dirty
                ? "You have unsaved changes."
                : "Everything is just the way you left it."}
            </span>
            <Button
              variant="ghost"
              disabled={!dirty}
              onClick={() => setDraft(preferences)}
            >
              Discard
            </Button>
            <Button
              variant="primary"
              disabled={!dirty || saving}
              onClick={save}
            >
              {saving ? "Saving…" : "Save preferences"}
            </Button>
          </div>
        </div>
        <aside className="settings-aside">
          <span className="settings-aside-icon">
            <Settings2 size={23} strokeWidth={1.5} />
          </span>
          <h3>
            Small things.
            <br />A calmer day.
          </h3>
          <p>
            Your preferences follow you across your calendars. Your phone and
            desktop each remember their own calendar view.
          </p>
          <div className="settings-aside-divider" />
          <span className="aside-footnote">
            <ShieldCheck size={16} />
            Your event data stays private.
          </span>
        </aside>
      </div>
    </div>
  );
}
