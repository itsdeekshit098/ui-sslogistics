/**
 * Reads the CSS that styled-components generated for an element, so a test can
 * assert real declarations. jest-styled-components' matcher can't be used: it
 * does not look inside `@layer ui { … }`, where every UI component's rules live.
 *
 *   styleOf(button)                                  // base rules
 *   styleOf(button, { state: ":disabled" })          // `.cls:disabled`
 *   styleOf(button, { media: "(max-width: 767.98px)" })
 *   styleOf(button, { state: ":hover", media: "(hover: hover)" })
 */

interface Rule {
  context: string[]; // enclosing at-rules, e.g. ["@layer ui", "@media (hover: hover)"]
  selector: string;
  declarations: Record<string, string>;
}

function parseBlock(css: string, context: string[], out: Rule[]) {
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open === -1) break;
    const prelude = css.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    const body = css.slice(open + 1, j - 1);
    if (prelude.startsWith("@")) {
      if (!prelude.startsWith("@keyframes")) {
        parseBlock(body, [...context, prelude.replace(/\s+/g, " ")], out);
      }
    } else {
      const declarations: Record<string, string> = {};
      for (const part of body.split(";")) {
        const colon = part.indexOf(":");
        if (colon === -1) continue;
        declarations[part.slice(0, colon).trim()] = part.slice(colon + 1).trim().replace(/\s+/g, " ");
      }
      out.push({ context, selector: prelude, declarations });
    }
    i = j;
  }
}

function allRules(): Rule[] {
  const text = Array.from(document.querySelectorAll("style"))
    .map((s) => s.textContent ?? "")
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: Rule[] = [];
  parseBlock(text, [], rules);
  return rules;
}

export function styleOf(
  el: Element,
  options: { state?: string; media?: string } = {},
): Record<string, string> {
  const { state = "", media } = options;
  const classes = Array.from(el.classList);
  const result: Record<string, string> = {};
  for (const rule of allRules()) {
    // `&&` doubles the class (.a.a); treat it as the same selector.
    const matches = rule.selector
      .split(",")
      .map((sel) => sel.trim().replace(/(\.[\w-]+)\1/g, "$1"))
      .some((sel) => classes.some((c) => sel === `.${c}${state}`));
    if (!matches) continue;
    const ats = rule.context.filter((c) => !c.startsWith("@layer"));
    const wanted = media ? [`@media ${media}`] : [];
    if (ats.length !== wanted.length || ats.some((a, k) => a !== wanted[k])) continue;
    Object.assign(result, rule.declarations);
  }
  return result;
}

/** True when the element's styles are declared inside the `ui` cascade layer. */
export function isInUiLayer(el: Element): boolean {
  const classes = Array.from(el.classList);
  return allRules().some(
    (r) =>
      r.context.includes("@layer ui") &&
      r.selector.split(",").some((s) => classes.some((c) => s.trim().startsWith(`.${c}`))),
  );
}

/** True when the element has a rule in the `utilities` layer at doubled-class strength (see `locked`). */
export function hasLockedRule(el: Element): boolean {
  const classes = Array.from(el.classList);
  return allRules().some(
    (r) =>
      r.context.length === 1 &&
      r.context[0] === "@layer utilities" &&
      r.selector.split(",").some((s) => classes.some((c) => s.trim() === `.${c}.${c}`)),
  );
}
