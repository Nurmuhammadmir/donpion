// "Кому" and "цвет" (ТЗ 3.1) — a small fixed list, not an admin-managed
// taxonomy like Occasion: TOR gives these as a short, specific set rather
// than something the admin is expected to grow or edit, so a plain enum
// on Product (see models/Product.js) is enough — no separate collection/
// CRUD page for four or seven fixed values. Shared between the model
// (schema enum) and the controller (filter validation) so they can't drift.
export const RECIPIENTS = ["mom", "wife", "girlfriend", "colleague"];

export const RECIPIENT_LABELS = {
  mom: "Маме",
  wife: "Жене",
  girlfriend: "Девушке",
  colleague: "Коллеге",
};

export const COLORS = ["red", "white", "pink", "yellow", "purple", "orange", "mixed"];

export const COLOR_LABELS = {
  red: "Красный",
  white: "Белый",
  pink: "Розовый",
  yellow: "Жёлтый",
  purple: "Фиолетовый",
  orange: "Оранжевый",
  mixed: "Микс",
};
