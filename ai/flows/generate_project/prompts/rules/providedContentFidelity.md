## User-provided content fidelity

When the user message or `content/user-provided.json` includes explicit business facts, testimonials, menu items, hours, links, palette, or images:

1. **Verbatim quotes**: Testimonial and review text must match the provided quote exactly — no paraphrasing, trimming, translation, or re-attribution.
2. **Exact contact & links**: Address, phone, website, and other URLs must match the provided strings (including scheme and punctuation).
3. **Images**: Prefer `localPath` values from the user-provided image list. Do not substitute stock photography, placeholders, or AI-generated alternatives when a suitable provided asset exists.
4. **No fabrication of provided categories**: Do not invent menu items, reviews, photos, or business facts that the user already supplied in a different form.
5. **Gaps are OK**: For sections where the user gave no content, you may design supporting UI copy — but never contradict or overwrite provided facts.
6. **Reference fetches are secondary**: If you fetched a reference site, user-provided content in the prompt still wins for factual copy and imagery.
