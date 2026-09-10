import baseSlugify from "slugify";

// Transliterates Cyrillic -> Latin so URLs stay ASCII (e.g. "Фиалка в горшке" -> "fialka-v-gorshke")
const CYRILLIC_MAP = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function slugifyRu(text) {
  const transliterated = text
    .toLowerCase()
    .split("")
    .map((ch) => (CYRILLIC_MAP[ch] !== undefined ? CYRILLIC_MAP[ch] : ch))
    .join("");

  return baseSlugify(transliterated, { lower: true, strict: true });
}

export default slugifyRu;
