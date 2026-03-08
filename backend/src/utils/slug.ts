import slugify from "slugify";

export async function generateUniqueSlug(
  rawName: string,
  exists: (slug: string) => Promise<boolean>
) {
  const baseSlug = slugify(rawName, {
    lower: true,
    strict: true,
    trim: true
  }) || "loja";

  let attempt = baseSlug;
  let index = 1;

  while (await exists(attempt)) {
    attempt = `${baseSlug}-${index}`;
    index += 1;
  }

  return attempt;
}