// A small "you are here" dot, distinct from the orange branch/order pin —
// purely informational, not draggable, just for orientation. Shared by
// LocationPicker (placing a branch) and OrderLocationMap (viewing an
// order's delivery pin).
export function createGeolocationDot(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.width = "14px";
  el.style.height = "14px";
  el.style.borderRadius = "50%";
  el.style.background = "#4285F4";
  el.style.border = "2px solid white";
  el.style.boxShadow = "0 0 0 4px rgba(66,133,244,0.35)";
  return el;
}
