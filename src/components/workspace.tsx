"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import {
  CalendarDays,
  Users,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  PanelLeftClose,
  Menu as MenuIcon,
  ArrowUpRight,
  Sprout,
  CircleHelp,
  Command,
  Check,
  Globe,
  LogOut,
  Bookmark,
  MoreHorizontal,
  UserRound,
} from "lucide-react";
import {
  Button,
  CheckBox,
  IconButton,
  Logo,
  Menu,
  MenuItem,
  Modal,
} from "./ui";
import {
  addDays,
  addMonths,
  formatDate,
  monthDays,
  today,
} from "@/lib/shared/dates";
import type { Connection, Preferences, SavedView } from "@/lib/shared/types";
import { APPEARANCE_KEY, applyAppearance } from "@/lib/shared/appearance";
import { preferencesSchema } from "@/lib/shared/schemas";

type Boot = {
  ownerId: string;
  setupRequired: boolean;
  connections: Connection[];
  preferences: Preferences;
  name: string;
  missing: string[];
};
type WorkspaceState = Boot & {
  hydrated: boolean;
  date: string;
  setDate: (date: string) => void;
  selected: string[];
  setSelected: (ids: string[]) => void;
  updatePreferences: (patch: Partial<Preferences>) => Promise<void>;
  updateConnection: (id: string, patch: Partial<Connection>) => Promise<void>;
  removeConnection: (id: string) => Promise<void>;
  connect: (id?: string) => void;
  openSearch: () => void;
  openFilters: () => void;
  notify: (message: string) => void;
  savedViews: SavedView[];
  saveView: (view: SavedView) => void;
  deleteView: (id: string) => void;
  restoreSelection: () => void;
  applySavedView: (view: SavedView) => void;
};
const Context = createContext<WorkspaceState | null>(null);
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("Workspace missing");
  return value;
}
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      body.error?.message ??
        body.error?.code ??
        "Unable to complete this request",
    );
  return body;
}
export function Workspace({
  boot,
  children,
}: {
  boot: Boot;
  children: ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30000, retry: 1, refetchOnWindowFocus: true },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <WorkspaceInner boot={boot}>{children}</WorkspaceInner>
    </QueryClientProvider>
  );
}
function WorkspaceInner({
  boot,
  children,
}: {
  boot: Boot;
  children: ReactNode;
}) {
  const pathname = usePathname(),
    router = useRouter(),
    queryClient = useQueryClient();
  const [connections, setConnections] = useState(boot.connections),
    [preferences, setPreferences] = useState(boot.preferences);
  const [date, setDateState] = useState(() => today(boot.preferences.timeZone));
  const [selected, setSelectedState] = useState(() =>
    boot.connections.flatMap((c) =>
      c.sources.filter((s) => s.selected).map((s) => s.id),
    ),
  );
  const previousSelection = useRef<string[]>(selected);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]),
    [loaded, setLoaded] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false),
    [connectId, setConnectId] = useState<string>(),
    [connecting, setConnecting] = useState(false),
    [connectError, setConnectError] = useState("");
  const [help, setHelp] = useState(false),
    [filters, setFilters] = useState(false),
    [draft, setDraft] = useState<string[]>([]),
    [search, setSearch] = useState(false),
    [collapsed, setCollapsed] = useState(false);
  const knownSources = useRef(
    new Set(boot.connections.flatMap((c) => c.sources.map((s) => s.id))),
  );
  const connectionQuery = useQuery({
    queryKey: ["connections", boot.ownerId],
    queryFn: () => api<Connection[]>("/api/connections"),
    enabled: true,
    refetchInterval: 10000,
  });
  useEffect(() => {
    if (!connectionQuery.data) return;
    const next = connectionQuery.data;
    const ids = new Set(next.flatMap((c) => c.sources.map((s) => s.id)));
    const added = next.flatMap((c) =>
      c.sources
        .filter((s) => s.selected && !knownSources.current.has(s.id))
        .map((s) => s.id),
    );
    setConnections(next);
    setSelectedState((previous) => [
      ...new Set([...previous.filter((id) => ids.has(id)), ...added]),
    ]);
    knownSources.current = ids;
  }, [connectionQuery.data]);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  }, []);
  useEffect(() => {
    try {
      const url = new URL(window.location.href),
        d = url.searchParams.get("date");
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) setDateState(d);
      if (boot.setupRequired) {
        const stored = preferencesSchema.safeParse(
          JSON.parse(
            localStorage.getItem("calora-local-preferences-v1") ?? "{}",
          ),
        );
        const appearance = localStorage.getItem(APPEARANCE_KEY);
        setPreferences({
          ...boot.preferences,
          ...(stored.success ? stored.data : {}),
          ...(["light", "dark", "system"].includes(appearance ?? "")
            ? { appearance: appearance as Preferences["appearance"] }
            : {}),
        });
      }
      api<SavedView[]>("/api/saved-views")
        .then(setSavedViews)
        .catch(() => {});
      if (url.searchParams.has("connectionError"))
        notify(
          "Google authorization did not complete. Try again with the intended account.",
        );
      if (url.searchParams.has("connected"))
        notify("Account connected. Your calendars are being discovered.");
    } catch {}
    setLoaded(true);
    // Bootstrap device preferences once, without storing event content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!loaded) return;
    applyAppearance(preferences.appearance);
    if (boot.setupRequired) {
      try {
        localStorage.setItem(
          "calora-local-preferences-v1",
          JSON.stringify(preferences),
        );
      } catch {}
    }
  }, [preferences, loaded, boot.setupRequired]);
  const setDate = useCallback((value: string) => {
    setDateState(value);
    const url = new URL(window.location.href);
    url.searchParams.set("date", value);
    window.history.replaceState(null, "", url);
  }, []);
  const setSelected = useCallback(
    (ids: string[]) => {
      if (boot.setupRequired && connections.length === 0) return;
      previousSelection.current = selected;
      setSelectedState(ids);
      api("/api/preferences", {
        method: "PATCH",
        body: JSON.stringify({ selected: ids }),
      }).catch(() => {
        setSelectedState(selected);
        notify("Your selection could not be saved. Please try again.");
      });
    },
    [selected, boot.setupRequired, connections.length, notify],
  );
  async function updatePreferences(patch: Partial<Preferences>) {
    if (!boot.setupRequired)
      await api("/api/preferences", {
        method: "PATCH",
        body: JSON.stringify({ preferences: patch }),
      });
    setPreferences((p) => ({ ...p, ...patch }));
  }
  async function updateConnection(id: string, patch: Partial<Connection>) {
    await api(`/api/connections/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    setConnections((cs) =>
      cs.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
    await queryClient.invalidateQueries({ queryKey: ["events"] });
  }
  async function removeConnection(id: string) {
    const result = await api<{ revoked: boolean }>(`/api/connections/${id}`, {
      method: "DELETE",
    });
    const revoked = result.revoked;
    const ids =
      connections.find((c) => c.id === id)?.sources.map((s) => s.id) ?? [];
    setConnections((cs) => cs.filter((c) => c.id !== id));
    setSelectedState((s) => s.filter((id) => !ids.includes(id)));
    queryClient.removeQueries({ queryKey: ["events"] });
    notify(
      revoked
        ? "Account disconnected and local calendar data removed."
        : "Local data removed. Google revocation failed; remove Calora from your Google account permissions.",
    );
  }
  async function saveView(view: SavedView) {
    try {
      const v = await api<SavedView>("/api/saved-views", {
        method: "POST",
        body: JSON.stringify(view),
      });
      setSavedViews((s) => [...s, v]);
      notify("Calendar view saved.");
    } catch {
      notify("Unable to save this view. Try again.");
    }
  }
  async function deleteView(id: string) {
    try {
      await api(`/api/saved-views/${id}`, { method: "DELETE" });
      setSavedViews((s) => s.filter((v) => v.id !== id));
    } catch {
      notify("Unable to remove this view.");
    }
  }
  function connect(id?: string) {
    setConnectId(id);
    setConnectError("");
    setConnectOpen(true);
  }
  function openFilters() {
    setDraft(selected);
    setFilters(true);
  }
  async function startConnection() {
    setConnecting(true);
    try {
      const response = await api<{ url: string }>(
        "/api/integrations/google/start",
        {
          method: "POST",
          body: JSON.stringify({
            connectionId: connectId,
            returnPath: pathname === "/accounts" ? "/accounts" : "/",
          }),
        },
      );
      window.location.assign(response.url);
    } catch (error) {
      setConnectError(
        error instanceof Error ? error.message : "Unable to connect",
      );
      setConnecting(false);
    }
  }
  const restoreSelection = () => setSelected(previousSelection.current);
  const applySavedView = (view: SavedView) => {
    setSelected(view.sourceIds);
    router.push(`/?mode=${view.mode}&date=${date}`);
    window.dispatchEvent(new CustomEvent("calora-mode", { detail: view.mode }));
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      }
      if (
        e.key === "?" &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        )
      )
        setHelp(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const active =
    pathname === "/accounts"
      ? "Accounts"
      : pathname === "/settings"
        ? "Settings"
        : "Schedule";
  const value: WorkspaceState = {
    ...boot,
    hydrated: loaded,
    connections,
    preferences,
    date,
    setDate,
    selected,
    setSelected,
    updatePreferences,
    updateConnection,
    removeConnection,
    connect,
    openSearch: () => setSearch(true),
    openFilters,
    notify,
    savedViews,
    saveView,
    deleteView,
    restoreSelection,
    applySavedView,
  };
  return (
    <Context.Provider value={value}>
      <div
        className={`app-shell ${collapsed ? "rail-collapsed" : ""}`}
        data-hydrated={loaded}
      >
        <aside className="sidebar">
          <div className="sidebar-brand">
            <Link href="/" aria-label="Calora home">
              <Logo />
            </Link>
            <IconButton
              label="Collapse sidebar"
              onClick={() => setCollapsed(true)}
            >
              <PanelLeftClose size={16} />
            </IconButton>
          </div>
          <Menu
            trigger={
              <button className="workspace-switch">
                <span className="workspace-icon">
                  <CalendarDays size={14} />
                </span>
                <span>
                  {boot.name ? `${boot.name}’s workspace` : "Your workspace"}
                </span>
                <ChevronDown size={14} />
              </button>
            }
          >
            <MenuItem onSelect={() => router.push("/settings")}>
              <Settings size={15} />
              Workspace settings
            </MenuItem>
            <MenuItem onSelect={() => connect()}>
              <Plus size={15} />
              Connect an account
            </MenuItem>
          </Menu>
          <PrimaryNav active={active} />
          <div className="sidebar-divider" />
          <MiniCalendar />
          <div className="sidebar-calendars">
            <CalendarFilters selection={selected} onChange={setSelected} />
          </div>
          <div className="sidebar-bottom">
            <div className="breathing-room">
              <Sprout size={27} strokeWidth={1.4} />
              <span>
                A little more
                <br />
                breathing room.
              </span>
              <span className="sparkle">✧</span>
            </div>
            <button className="help-button" onClick={() => setHelp(true)}>
              <CircleHelp size={17} />
              <span>Help & shortcuts</span>
              <kbd>?</kbd>
            </button>
            <Menu
              trigger={
                <button className="profile-button">
                  <span className="avatar">
                    {boot.name ? (
                      boot.name[0].toUpperCase()
                    ) : (
                      <UserRound size={16} />
                    )}
                  </span>
                  <span>
                    <b>{boot.name || "Your profile"}</b>
                    <small>
                      {boot.setupRequired
                        ? "Setup required"
                        : "Private workspace"}
                    </small>
                  </span>
                  <ChevronDown size={14} />
                </button>
              }
            >
              <MenuItem onSelect={() => router.push("/settings")}>
                <Settings size={15} />
                Preferences
              </MenuItem>
              {!boot.setupRequired && (
                <MenuItem
                  onSelect={async () => {
                    await api("/api/auth/sign-out", {
                      method: "POST",
                      body: "{}",
                    });
                    queryClient.clear();
                    window.location.assign("/sign-in");
                  }}
                >
                  <LogOut size={15} />
                  Sign out
                </MenuItem>
              )}
            </Menu>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              {collapsed ? (
                <IconButton
                  label="Expand sidebar"
                  onClick={() => setCollapsed(false)}
                >
                  <MenuIcon size={18} />
                </IconButton>
              ) : null}
              <span className="desktop-only">Workspace</span>
              <span className="breadcrumb-slash desktop-only">/</span>
              <b>{active}</b>
            </div>
            <div className="topbar-actions">
              <span className="workspace-indicator">
                <i />
                {boot.setupRequired ? "Setup required" : "Private workspace"}
              </span>
              <button
                className="global-search"
                aria-label="Search anything..."
                onClick={() => setSearch(true)}
              >
                <Search size={16} />
                <span>Search anything...</span>
                <kbd>⌘ K</kbd>
              </button>
              <button
                className="avatar avatar-small"
                onClick={() => router.push("/settings")}
                aria-label="Open profile settings"
              >
                {boot.name ? (
                  boot.name[0].toUpperCase()
                ) : (
                  <UserRound size={15} />
                )}
              </button>
            </div>
          </header>
          <main className="main-content" id="main-content">
            {children}
          </main>
        </div>
        <PrimaryNav active={active} mobile />
        <Modal
          open={connectOpen}
          onOpenChange={setConnectOpen}
          title={
            boot.setupRequired
              ? "Make room for all your calendars."
              : connectId
                ? "Reconnect your Google account"
                : "Your calendars, in good company."
          }
          description={
            boot.setupRequired
              ? "Complete your private workspace setup to connect Google Calendar."
              : "Securely connect another Google account to your private Calora workspace."
          }
        >
          <div className="connect-visual">
            <span className="google-mark">G</span>
            <span className="connection-dots">······</span>
            <Logo small />
          </div>
          {boot.setupRequired ? (
            <>
              <p className="modal-copy">
                Connect your Google calendars after configuring your private
                workspace. No accounts or events have been added.
              </p>
              <div className="setup-list">
                <b>To enable live Google calendars</b>
                <span>
                  <Check size={15} /> Start PostgreSQL and apply the migration
                </span>
                <span>
                  <Check size={15} /> Add your owner email and Google OAuth
                  credentials
                </span>
                <span>
                  <Check size={15} /> Set the encryption key and start the sync
                  worker
                </span>
              </div>
              <p className="helper-text">
                The exact steps and callback URLs are in the project README.
              </p>
              <Button
                variant="primary"
                onClick={() => {
                  setConnectOpen(false);
                  router.push("/settings#setup");
                }}
              >
                View workspace setup <ArrowUpRight size={16} />
              </Button>
            </>
          ) : (
            <>
              <div className="permission-list">
                <span>
                  <Check size={16} /> View your calendars and events
                </span>
                <span>
                  <Check size={16} /> Keep each account’s identity clear
                </span>
                <span>
                  <Check size={16} /> Disconnect whenever you like
                </span>
              </div>
              <p className="helper-text">
                Calora has read-only access. Your event data stays in your
                private workspace.
              </p>
              {connectError && (
                <p role="alert" className="error-text">
                  {connectError}
                </p>
              )}
              <Button
                variant="primary"
                onClick={startConnection}
                disabled={connecting}
              >
                <span className="google-mark small">G</span>
                {connecting ? "Opening Google…" : "Continue with Google"}
                <ArrowUpRight size={16} />
              </Button>
            </>
          )}
        </Modal>
        <Modal
          open={filters}
          onOpenChange={setFilters}
          title="Your calendars"
          description="Choose what makes it into your day."
          className="filter-dialog"
        >
          <CalendarFilters selection={draft} onChange={setDraft} />
          <div className="dialog-footer">
            <Button
              variant="ghost"
              onClick={() =>
                setDraft(
                  connections.flatMap((c) =>
                    c.sources.filter((s) => s.primary).map((s) => s.id),
                  ),
                )
              }
            >
              Reset
            </Button>
            <Button onClick={() => setFilters(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                setSelected(draft);
                setFilters(false);
              }}
            >
              Apply · {draft.length} calendars
            </Button>
          </div>
        </Modal>
        <Modal
          open={help}
          onOpenChange={setHelp}
          title="A few helpful shortcuts"
          description="Less clicking. More room for your day."
        >
          <div className="shortcut-list">
            {[
              ["Search your schedule", "⌘ / Ctrl K"],
              ["Go to today", "T"],
              ["Previous / next period", "← / →"],
              ["Week / month / agenda", "W / M / A"],
              ["Close a dialog or event", "Esc"],
              ["Open this guide", "?"],
            ].map(([label, key]) => (
              <div key={label}>
                <span>{label}</span>
                <kbd>{key}</kbd>
              </div>
            ))}
          </div>
          <p className="helper-text">
            Shortcuts pause while you’re typing. Calora combines your calendars
            with read-only access.
          </p>
        </Modal>
        {search ? <SearchDialog onClose={() => setSearch(false)} /> : null}
        {toast ? (
          <div className="toast" role="status">
            <span className="toast-check">
              <Check size={15} />
            </span>
            {toast}
            <button
              aria-label="Dismiss notification"
              onClick={() => setToast("")}
            >
              ×
            </button>
          </div>
        ) : null}
      </div>
    </Context.Provider>
  );
}
function PrimaryNav({
  active,
  mobile = false,
}: {
  active: string;
  mobile?: boolean;
}) {
  return (
    <nav
      aria-label={mobile ? "Mobile navigation" : "Main navigation"}
      className={mobile ? "mobile-nav" : "primary-nav"}
    >
      {[
        ["Schedule", "/", CalendarDays],
        ["Accounts", "/accounts", Users],
        ["Settings", "/settings", Settings],
      ].map(([label, href, Icon]) => {
        const I = Icon as typeof CalendarDays;
        return (
          <Link
            key={String(label)}
            href={String(href)}
            aria-current={label === active ? "page" : undefined}
            className={label === active ? "active" : ""}
          >
            <I size={18} />
            <span>{String(label)}</span>
            {!mobile && label === active ? (
              <span className="nav-active-dot" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
export function MiniCalendar() {
  const { date, setDate } = useWorkspace();
  const [month, setMonth] = useState(date);
  useEffect(() => setMonth(date), [date]);
  const days = monthDays(month);
  return (
    <section className="mini-calendar">
      <div className="mini-heading">
        <b>{formatDate(month, { month: "long", year: "numeric" })}</b>
        <div>
          <IconButton
            label="Previous month"
            onClick={() => setMonth(addMonths(month, -1))}
          >
            <ChevronLeft size={14} />
          </IconButton>
          <IconButton
            label="Next month"
            onClick={() => setMonth(addMonths(month, 1))}
          >
            <ChevronRight size={14} />
          </IconButton>
        </div>
      </div>
      <div className="mini-grid">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span className="weekday" key={i}>
            {d}
          </span>
        ))}
        {days.map((d) => (
          <button
            key={d}
            aria-label={formatDate(d, { dateStyle: "full" })}
            aria-pressed={d === date}
            className={`${d.slice(0, 7) !== month.slice(0, 7) ? "outside" : ""} ${d === date ? "selected" : ""} ${d === today() ? "is-today" : ""}`}
            onClick={() => setDate(d)}
          >
            {Number(d.slice(-2))}
          </button>
        ))}
      </div>
    </section>
  );
}
export function CalendarFilters({
  selection,
  onChange,
}: {
  selection: string[];
  onChange: (ids: string[]) => void;
}) {
  const {
    connections,
    connect,
    savedViews,
    saveView,
    deleteView,
    applySavedView,
    restoreSelection,
  } = useWorkspace();
  const [expanded, setExpanded] = useState<string[]>([]),
    [saveOpen, setSaveOpen] = useState(false),
    [name, setName] = useState("");
  const all = connections.flatMap((c) =>
    c.sources.filter((s) => s.accessStatus === "available").map((s) => s.id),
  );
  if (!connections.length)
    return (
      <>
        <div className="filter-label">
          <span>MY CALENDARS</span>
        </div>
        <div className="filter-empty">
          <CalendarDays size={20} />
          <p>No calendars connected</p>
          <button className="text-link" onClick={() => connect()}>
            Connect Google account <Plus size={13} />
          </button>
        </div>
      </>
    );
  function toggle(ids: string[], checked: boolean) {
    onChange(
      checked
        ? [...new Set([...selection, ...ids])]
        : selection.filter((id) => !ids.includes(id)),
    );
  }
  return (
    <>
      <div className="filter-label">
        <span>MY CALENDARS</span>
        <IconButton label="Connect Google account" onClick={() => connect()}>
          <Plus size={15} />
        </IconButton>
      </div>
      <div className="all-calendars">
        <CheckBox
          label="Select all calendars"
          checked={
            all.length > 0 && all.every((id) => selection.includes(id))
              ? true
              : selection.length > 0
                ? "indeterminate"
                : false
          }
          onCheckedChange={(v) => onChange(v ? all : [])}
        />
        <span>All calendars</span>
        <small>
          {selection.length}/{all.length}
        </small>
      </div>
      <div className="account-filter-list">
        {connections.map((c) => {
          const ids = c.sources
            .filter((s) => s.accessStatus === "available")
            .map((s) => s.id);
          const isExpanded = expanded.includes(c.id);
          return (
            <div className="account-filter" key={c.id}>
              <div className="account-filter-top">
                <button
                  className="disclosure"
                  aria-label={`${isExpanded ? "Collapse" : "Expand"} ${c.label} calendars`}
                  aria-expanded={isExpanded}
                  onClick={() =>
                    setExpanded((v) =>
                      v.includes(c.id)
                        ? v.filter((x) => x !== c.id)
                        : [...v, c.id],
                    )
                  }
                >
                  {isExpanded ? (
                    <ChevronDown size={13} />
                  ) : (
                    <ChevronRight size={13} />
                  )}
                </button>
                <CheckBox
                  color={c.color}
                  label={`Select ${c.label} account`}
                  checked={
                    ids.length > 0 && ids.every((id) => selection.includes(id))
                      ? true
                      : ids.some((id) => selection.includes(id))
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={(v) => toggle(ids, v)}
                />
                <div className="account-filter-name">
                  <b>{c.label}</b>
                  <small>{c.email}</small>
                </div>
                <Menu
                  trigger={
                    <button
                      className="account-more"
                      aria-label={`${c.label} options`}
                    >
                      <MoreHorizontal size={15} />
                    </button>
                  }
                >
                  <MenuItem onSelect={() => onChange(ids)}>
                    Show only this account
                  </MenuItem>
                  <MenuItem onSelect={() => restoreSelection()}>
                    Restore previous selection
                  </MenuItem>
                  <MenuItem onSelect={() => connect(c.id)}>
                    Reconnect account
                  </MenuItem>
                </Menu>
              </div>
              {isExpanded ? (
                <div className="source-list">
                  {c.sources.map((s) => (
                    <label key={s.id}>
                      <CheckBox
                        label={`${c.label} · ${s.title}`}
                        checked={selection.includes(s.id)}
                        color={c.color}
                        onCheckedChange={(v) => toggle([s.id], v)}
                      />
                      <span>{s.title}</span>
                      {s.accessStatus !== "available" ? (
                        <span className="restricted-label">Restricted</span>
                      ) : null}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="saved-filter-heading">
        <span>SAVED VIEWS</span>
        <IconButton
          label="Save current selection"
          onClick={() => setSaveOpen(true)}
        >
          <Plus size={14} />
        </IconButton>
      </div>
      {savedViews.length ? (
        savedViews.map((v) => (
          <div className="saved-view" key={v.id}>
            <button onClick={() => applySavedView(v)}>
              <Bookmark size={14} />
              {v.name}
            </button>
            <button
              aria-label={`Delete ${v.name} view`}
              onClick={() => deleteView(v.id)}
            >
              ×
            </button>
          </div>
        ))
      ) : (
        <button className="save-selection" onClick={() => setSaveOpen(true)}>
          <Bookmark size={13} />
          <span>Save your perfect mix</span>
        </button>
      )}
      <Modal
        open={saveOpen}
        onOpenChange={setSaveOpen}
        title="Save this calendar mix"
        description="Come back to the right calendars in one click."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) {
              saveView({
                id: crypto.randomUUID(),
                name: name.trim(),
                sourceIds: selection,
                mode: "merged",
              });
              setName("");
              setSaveOpen(false);
            }
          }}
        >
          <label className="field">
            View name
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. A focused workday"
              maxLength={50}
              required
            />
          </label>
          <p className="helper-text">
            {selection.length} calendars in this view
          </p>
          <div className="dialog-footer">
            <Button type="button" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save view
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

import { useQuery } from "@tanstack/react-query";
import { SearchResults } from "@/features/calendar/search";
function SearchDialog({ onClose }: { onClose: () => void }) {
  return <SearchResults onClose={onClose} />;
}
