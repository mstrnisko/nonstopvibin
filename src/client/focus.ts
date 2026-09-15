// Window activation and programmatic focus are not keyboard navigation.
const root = document.documentElement;
const clearKeyboardFocus = () => root.removeAttribute("data-keyboard-focus");
const onKeyDown = (event: KeyboardEvent) => {
  if (
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !["Shift", "Control", "Alt", "Meta"].includes(event.key)
  )
    root.setAttribute("data-keyboard-focus", "");
};
document.addEventListener("keydown", onKeyDown, true);
document.addEventListener("pointerdown", clearKeyboardFocus, true);
window.addEventListener("blur", clearKeyboardFocus);

if (import.meta.hot)
  import.meta.hot.dispose(() => {
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("pointerdown", clearKeyboardFocus, true);
    window.removeEventListener("blur", clearKeyboardFocus);
    clearKeyboardFocus();
  });
