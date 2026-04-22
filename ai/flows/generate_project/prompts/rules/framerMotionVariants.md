## Rule: Framer Motion — type-safe `variants` (avoids TS build failures)

When using `framer-motion` (`motion`, `variants`, `AnimatePresence`, etc.), keep `transition` values compatible with the library’s `Variants` / `Transition` types so `pnpm run build` does not fail on Framer’s stricter `ease` typing.

### `transition.ease` and cubic-bezier arrays

- If you use a 4-number cubic-bezier, write it as a **tuple**, not a plain array — otherwise TypeScript infers `number[]` and the build errors with something like *Type 'number[]' is not assignable to type 'Easing'*.
  - **Preferred**: `ease: [0.42, 0, 0.58, 1] as const` (or any valid 4-tuple with `as const`).
  - **Alternative**: use a string easing Framer Motion accepts, e.g. `ease: "easeInOut"`.
- Use the same rule anywhere `ease` (or similar) is nested inside `variants`, `initial`, `animate`, or `transition` on `motion` components.

### CSS `steps()` / non-Framer easing strings

- **Do not** use strings like `ease: "steps(2)"` or other raw CSS `steps(...)` / `cubic-bezier(...)` text unless you know they are in Framer’s `Easing` union. TypeScript will fail with *Type '…' is not assignable to type 'Easing'*, even if the value would be valid in plain CSS.
  - **Preferred**: pick a **named** easing that Framer exports / documents (e.g. `linear`, `easeIn`, `easeInOut` — use the exact literals your `framer-motion` version types allow).
  - **If you must** approximate stepped motion: prefer a supported easing plus `times` / keyframe timing, or a documented Framer API for stepped animation — avoid inventing `steps(n)` as a string on `transition.ease`.
  - **Last resort** (only when you intentionally bypass types): `transition={... as const}` or a narrow `as` on the `ease` value **after** confirming runtime behavior; do not do this for generated marketing sections unless there is no supported alternative.

### `MotionValue` is not a `ReactNode`

- Values from `useMotionValue`, `useTransform`, `useSpring`, etc. are **`MotionValue<T>`**, not strings/numbers for JSX. **Never** put them in children: `{myMotionValue}` → TypeScript error: *Type 'MotionValue<string>' is not assignable to type 'ReactNode'*.
  - **Preferred**: keep **plain React state** (`useState`) for text/numbers you show in the DOM; drive updates with `useMotionValueEvent(mv, "change", setState)` (or `mv.on("change", setState)` in an effect) so `{displayString}` is always a `string`.
  - **Alternative**: bind `MotionValue` only to **`style` / `animate` props** on `motion.*` (where the API accepts `MotionValue`), not as element children.
  - For a counting animation without low-level `MotionValue`, prefer `animate` + `onUpdate` or a small `useEffect` with `requestAnimationFrame` / Framer’s high-level `motion` `animate` prop — still output **string** state for visible text.
