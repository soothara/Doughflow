# DoughFlow Photo Production Prompt

## Master prompt — apply to each source photo independently

Use the supplied photograph as a visual reference and make one separate, high-quality, website-ready landscape image for DoughFlow, a real leposhka bakery production-tracking dashboard. Keep a documentary, authentic Central Asian bakery feel. Improve exposure, white balance, dynamic range, clarity, crust texture, natural skin tones, and composition with restrained editorial food-photography polish. Keep bread naturally golden-brown rather than orange or plastic-looking. Preserve plausible proportions and realistic texture; avoid excessive sharpening, halos, fake bokeh, heavy HDR, artificial cinematic color casts, beauty filters, or oversaturation.

Compose for responsive 16:9 website use, ideally 1280×720 or larger. Keep the principal person or product comfortably inside the frame and safe from responsive cropping. No added headlines, logos, watermarks, UI, badges, borders, or collages. Output one image per source photo; never combine separate source photos into a composite. Export an optimized WebP for fast mobile loading and keep a high-quality original.

**Accuracy note:** generative image tools can recreate a scene instead of literally retouching the supplied photograph, and may change faces, logos, signs, plates, or other factual details. For staff records, identity-sensitive use, or documentation of actual operations, use non-generative photo correction on the original image instead.

## Individual prompts

1. **Baker behind tandoor:** Wide documentary bakery portrait of a middle-aged bearded baker in a dark cap and light shirt behind a cracked dome-shaped clay tandoor; many fresh patterned leposhka fill the foreground; tiled wall and traditional tools; balanced warm natural light; detailed but authentic face and bread texture.
2. **Leposhka close-up:** Golden-brown leposhka on bakery cooling racks, one large loaf crisp in the foreground and more loaves receding into gentle depth; authentic stamped center, blistering and crust texture; natural colour, no plastic gloss.
3. **Bishkek street context:** Bright, documentary city-intersection scene with pale stone civic buildings, golden domes, Kyrgyz street context, traffic and pedestrians; clear sky and realistic daylight. Do not invent or alter signage in ways that could misrepresent a real location.
4. **Bread seller and delivery van:** Candid wide photo of a friendly middle-aged bread seller seated beside an open white van stacked with neat rows of leposhka; natural skin tones, realistic outdoor daylight, sharp bread detail.
5. **Young worker and delivery:** Young worker in casual gray sportswear beside an open van full of leposhka; relaxed candid documentary portrait; keep natural proportions and realistic fabric and bread details.
6. **Bread stock in van:** Straight-on view of an open delivery van loaded with ordered rows of round leposhka; strong product composition, even daylight, realistic golden crusts, no people.
7. **Bakery team:** Candid group portrait of bakery staff pausing together in their real workroom; flour sacks, dough table and equipment visible; warm but accurate lighting; natural skin texture and believable expressions.
8. **Team selfie:** Casual wide-angle bakery team selfie in the workroom, with staff, flour sacks and leposhka visible; natural perspective, no beauty filters or reshaped faces.
9. **Team social moment:** Candid team meal in a cozy café, gentle warm ambient light, people and table setting readable without artificial glamour or oversaturation; use only as a secondary culture image, not as the primary bakery hero.
10. **Tandoor production:** Baker using a wooden peel beside a traditional clay oven, freshly baked leposhka filling the foreground; warm firelight with retained shadow detail; authentic documentary food photography, no exaggerated flames.

## Website delivery requirements

- Keep each image as its own file and use descriptive filenames and alt text.
- Use WebP at approximately 1280×720, quality 70–80 as a starting point; verify visual quality before lowering compression further.
- Use responsive `object-fit: cover` and `object-position` per image so faces and bread stay in frame.
- Lazy-load gallery thumbnails; preload only the first hero image.
- Use a reliable local asset path rather than a fragile hot-linked source.
- Include alt text and a visible fallback for a failed image request.
- Honor `prefers-reduced-motion`; keep slide controls usable by keyboard and touch.
