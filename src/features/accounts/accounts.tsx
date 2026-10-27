"use client";
import { useState } from "react";
import {
  Plus,
  MoreHorizontal,
  RefreshCw,
  Pencil,
  Unplug,
  CalendarDays,
  ShieldCheck,
  ArrowUpRight,
  Check,
  Link2,
  ChevronDown,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace";
import {
  Button,
  CheckBox,
  EmptyState,
  IconButton,
  Menu,
  MenuItem,
  Modal,
} from "@/components/ui";
import type { Color, Connection } from "@/lib/shared/types";
export function Accounts() {
  const {
    connections,
    connect,
    selected,
    setSelected,
    updateConnection,
    removeConnection,
    notify,
  } = useWorkspace();
  const [editing, setEditing] = useState<Connection | null>(null),
    [disconnect, setDisconnect] = useState<Connection | null>(null),
    [label, setLabel] = useState(""),
    [color, setColor] = useState<Color>("green"),
    [saving, setSaving] = useState(false);
  function edit(c: Connection) {
    setEditing(c);
    setLabel(c.label);
    setColor(c.color);
  }
  async function save() {
    if (!editing || !label.trim()) return;
    setSaving(true);
    try {
      await updateConnection(editing.id, { label: label.trim(), color });
      setEditing(null);
      notify("Account details updated.");
    } catch {
      notify("We couldn’t save those changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="content-page accounts-page">
      <section className="page-heading">
        <div>
          <h1>
            Good company for your calendars
            <span className="heading-period">.</span>
          </h1>
          <p>Work, life, and everything in between. Bring them together.</p>
        </div>
        <Button variant="primary" onClick={() => connect()}>
          <Plus size={17} />
          Connect account
        </Button>
      </section>
      <div className="accounts-overview">
        <div>
          <span className="stacked-dots">
            {connections.map((c) => (
              <i className={c.color} key={c.id} />
            ))}
          </span>
          <b>{connections.length} accounts</b>
          <span className="context-dot">·</span>
          <span>
            {connections.reduce((n, c) => n + c.sources.length, 0)} calendars
          </span>
        </div>
        <span>
          <ShieldCheck size={15} />
          Read-only access. Always yours.
        </span>
      </div>
      <div className="connection-list">
        {connections.map((c) => (
          <section className="connection-card" key={c.id}>
            <div className="connection-header">
              <div className={`connection-avatar ${c.color}`}>
                <span className="google-mark">G</span>
              </div>
              <div className="connection-heading">
                <h2>
                  {c.label}
                  <span
                    className={`connection-status ${c.status === "reconnect" ? "warning" : ""}`}
                  >
                    <i />
                    {c.status === "connected"
                      ? "Connected"
                      : c.status === "reconnect"
                        ? "Reconnect needed"
                        : c.status}
                  </span>
                </h2>
                <p>{c.email}</p>
              </div>
              <span className={`connection-color ${c.color}`} />
              <Menu
                trigger={
                  <IconButton label={`${c.label} account actions`}>
                    <MoreHorizontal size={19} />
                  </IconButton>
                }
              >
                <MenuItem onSelect={() => edit(c)}>
                  <Pencil size={15} />
                  Edit label & color
                </MenuItem>
                <MenuItem onSelect={() => connect(c.id)}>
                  <RefreshCw size={15} />
                  Reconnect Google account
                </MenuItem>
                <MenuItem danger onSelect={() => setDisconnect(c)}>
                  <Unplug size={15} />
                  Disconnect account
                </MenuItem>
              </Menu>
            </div>
            {c.lastError ? (
              <div className="account-error">
                {c.status === "reconnect"
                  ? "Google needs your permission again. Reconnect to refresh this account."
                  : "This account could not finish refreshing. Other calendars remain available."}
                <button onClick={() => connect(c.id)}>Review connection</button>
              </div>
            ) : null}
            <div className="connection-calendars">
              <div className="calendar-table-heading">
                <span>CALENDAR</span>
                <span>ACCESS</span>
                <span>VISIBLE</span>
              </div>
              {c.sources.map((s) => (
                <div className="calendar-source-row" key={s.id}>
                  <div>
                    <span className={`source-icon ${c.color}`}>
                      <CalendarDays size={15} />
                    </span>
                    <b>{s.title}</b>
                    {s.primary ? (
                      <span className="primary-badge">Primary</span>
                    ) : null}
                    {s.accessStatus !== "available" ? (
                      <span className="warning-badge">Restricted</span>
                    ) : null}
                  </div>
                  <span>
                    {s.accessRole === "owner"
                      ? "Owner"
                      : s.accessRole === "writer"
                        ? "Can edit"
                        : s.accessRole === "reader"
                          ? "Can view"
                          : "Availability only"}
                  </span>
                  <CheckBox
                    label={`Show ${c.label} ${s.title}`}
                    color={c.color}
                    checked={selected.includes(s.id)}
                    onCheckedChange={(checked) =>
                      setSelected(
                        checked
                          ? [...selected, s.id]
                          : selected.filter((id) => id !== s.id),
                      )
                    }
                  />
                </div>
              ))}
            </div>
            <div className="connection-footer">
              <span>
                <Link2 size={13} />
                {c.sources.length} calendars discovered
              </span>
              <button onClick={() => edit(c)}>
                Customize account <Pencil size={12} />
              </button>
            </div>
          </section>
        ))}
      </div>
      {!connections.length ? (
        <EmptyState
          icon={<CalendarDays size={27} />}
          heading="Your first connection starts here."
          action={
            <Button variant="primary" onClick={() => connect()}>
              <Plus size={16} />
              Connect Google account
            </Button>
          }
        >
          Bring your calendars into one private workspace. Your events stay
          exactly where they are.
        </EmptyState>
      ) : (
        <button className="add-account-row" onClick={() => connect()}>
          <span>
            <Plus size={22} />
          </span>
          <div>
            <b>There’s room for one more.</b>
            <small>Connect another Google account</small>
          </div>
          <ArrowUpRight size={19} />
        </button>
      )}
      <p className="accounts-privacy">
        <ShieldCheck size={15} />
        Calora can read your calendar, but can’t create, change, or delete your
        events.
      </p>
      <Modal
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title="A name that feels like you."
        description="Make this account easy to spot across your schedule."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label className="field">
            Account label
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Work, Personal, A side project"
              maxLength={40}
              required
              autoFocus
            />
          </label>
          <div className="color-picker">
            <span>Account color</span>
            <div>
              {(["green", "orange", "purple", "blue"] as Color[]).map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`color-option ${c} ${color === c ? "active" : ""}`}
                  aria-label={`${c} account color`}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                >
                  {color === c ? <Check size={18} /> : null}
                </button>
              ))}
            </div>
          </div>
          <p className="helper-text">
            Your Google account and original calendar names stay the same.
          </p>
          <div className="dialog-footer">
            <Button type="button" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={saving || !label.trim()}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={!!disconnect}
        onOpenChange={(open) => {
          if (!open) setDisconnect(null);
        }}
        title={`Disconnect ${disconnect?.label ?? "account"}?`}
        description="Its calendars and cached events will be removed from Calora."
      >
        <p className="modal-copy">
          Your original Google calendars won’t change. You can connect this
          account again whenever you like.
        </p>
        <div className="dialog-footer">
          <Button onClick={() => setDisconnect(null)}>Keep account</Button>
          <Button
            variant="danger"
            disabled={saving}
            onClick={async () => {
              if (!disconnect) return;
              setSaving(true);
              try {
                await removeConnection(disconnect.id);
                setDisconnect(null);
              } catch {
                notify("We couldn’t disconnect this account. Try again.");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Disconnecting…" : "Disconnect account"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
