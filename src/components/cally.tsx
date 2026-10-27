"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUp, CalendarDays, Clock3, Sparkles, X } from "lucide-react";
import { CallyOrb } from "./cally-orb";
import "./cally.css";

const suggestions = [
  { icon: CalendarDays, label: "Help me plan my day" },
  { icon: Clock3, label: "Find a little free time" },
  { icon: Sparkles, label: "Make sense of my week" },
];

/** A visual preview only: no messages, calendar access, or assistant API. */
export function Cally() {
  return (
    <Dialog.Root modal={false}>
      <Dialog.Trigger asChild>
        <button type="button" className="cally-launcher" aria-label="Open Cally">
          <CallyOrb />
          <span className="cally-name">Cally<span className="cally-name-sparkle" aria-hidden="true">✧</span></span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content className="cally-panel" aria-describedby="cally-description">
          <header className="cally-panel-header">
            <span className="cally-panel-brand"><Sparkles size={17} strokeWidth={1.6} aria-hidden="true" />Cally<span>Coming soon</span></span>
            <Dialog.Close asChild>
              <button type="button" className="icon-button" aria-label="Close Cally"><X size={18} /></button>
            </Dialog.Close>
          </header>
          <div className="cally-panel-body">
            <span className="cally-eyebrow">A LITTLE HELP, A LITTLE CALM.</span>
            <Dialog.Title>How can I help<br />you today?</Dialog.Title>
            <Dialog.Description id="cally-description">A little more breathing room for your day.<br />Something helpful is taking shape.</Dialog.Description>
            <div className="cally-suggestions" aria-label="Upcoming Cally features">
              {suggestions.map(({ icon: Icon, label }) => (
                <button type="button" key={label} disabled>
                  <Icon size={17} strokeWidth={1.5} aria-hidden="true" />
                  <span>{label}<small>Coming soon</small></span>
                  <span className="cally-option-arrow" aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
            <div className="cally-composer">
              <input aria-label="Message Cally — coming soon" placeholder="Ask Cally anything…" disabled />
              <button type="button" aria-label="Send message — coming soon" disabled><ArrowUp size={17} aria-hidden="true" /></button>
            </div>
            <p className="cally-footnote">Just a little hello for now. All features are coming soon.</p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
