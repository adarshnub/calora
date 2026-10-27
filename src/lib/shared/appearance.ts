import type { Preferences } from "./types";
export const APPEARANCE_KEY = "calora-appearance-v1";
export function applyAppearance(appearance: Preferences["appearance"]) {
  const root = document.documentElement;
  root.classList.add("theme-changing");
  const resolved =
    appearance === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : appearance;
  root.dataset.theme = resolved;
  root.dataset.colorScheme = resolved;
  root.style.colorScheme = resolved;
  try {
    localStorage.setItem(APPEARANCE_KEY, appearance);
  } catch {}
  requestAnimationFrame(() =>
    requestAnimationFrame(() => root.classList.remove("theme-changing")),
  );
}
// Runs before the body is painted, including on the sign-in and setup screens.
// Only the appearance choice is migrated; old sample accounts and selections are discarded.
export const APPEARANCE_BOOTSTRAP = `(()=>{try{const k='${APPEARANCE_KEY}';let a=localStorage.getItem(k);if(!a){try{a=JSON.parse(localStorage.getItem('calora-demo-v1')||'null')?.preferences?.appearance}catch{}}if(!['light','dark','system'].includes(a))a='light';localStorage.setItem(k,a);localStorage.removeItem('calora-demo-v1');const t=a==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):a;const r=document.documentElement;r.dataset.theme=t;r.dataset.colorScheme=t;r.style.colorScheme=t}catch{}})()`;
