# Design System Specification: Kinetic Vault

## 1. Overview & Creative North Star
**The Creative North Star: "The Kinetic Vault"**

Traditional finance is static and opaque. This design system reimagines the BNB Chain ecosystem as a living, breathing "Kinetic Vault"—a high-stakes, high-reward environment where data flows like energy. We are moving away from the "Dashboard" look and toward a "Command Center" experience.

To break the "template" look, this system utilizes **intentional asymmetry** and **tonal depth**. We bypass the rigid 12-column grid in favor of overlapping layers, where AI insights (Primary) and Social signals (Secondary) physically float at different Z-axis heights. We use high-contrast typography scales—pairing the brutalist precision of Space Grotesk with the human-centric clarity of Inter—to create an editorial feel that is both authoritative and gamified.

---

## 2. Colors & Surface Philosophy

The palette is rooted in **Deep Obsidian (#131314)**, using the light-emitting properties of **Neon Cyan (#a4e6ff)** and **Electric Purple (#e8b3ff)** to guide the eye toward "Kinetic" actions.

### The "No-Line" Rule
Designers are strictly prohibited from using 1px solid, high-contrast borders for sectioning. Boundaries must be defined through:
*   **Background Shifts:** Transitioning from `surface` to `surface-container-low`.
*   **Tonal Transitions:** Using `surface-container-highest` to lift a card from the background.
*   **Ghost Borders:** If a boundary is required for tactical precision, use the `outline-variant` token at **15% opacity**.

### Surface Hierarchy & Nesting
Treat the UI as a series of nested obsidian sheets. 
*   **Base Layer:** `surface` (#131314)
*   **Sectioning:** `surface-container-low` (#1c1b1c)
*   **Interactive Cards:** `surface-container-high` (#2a2a2b)
*   **Modals/Pop-overs:** `surface-container-highest` (#353436)

### The "Glass & Gradient" Rule
For elements requiring a premium "Social-Fi" feel, use **Glassmorphism**. Apply `surface-variant` at 40% opacity with a `20px backdrop-blur`. Main CTAs should not be flat; they must use a linear gradient from `primary` (#a4e6ff) to `primary-container` (#00d1ff) at a 135-degree angle to provide "visual soul."

---

## 3. Typography
We use a dual-font strategy to balance the "AI/Finance" precision with "Social" engagement.

*   **Display & Headlines (Space Grotesk):** This is our "Precision" face. It feels technical and monospace-adjacent. Use `display-lg` (3.5rem) for portfolio totals and `headline-md` (1.75rem) for AI-generated insights.
*   **Body & Titles (Inter):** This is our "Readability" face. Use `body-md` (0.875rem) for all platform descriptions and `title-sm` (1rem) for form labels.
*   **Labels (Space Grotesk Monospace):** All data points, wallet addresses, and gas fees must use `label-md` or `label-sm` in Space Grotesk to emphasize the "on-chain" nature of the platform.

---

## 4. Elevation & Depth

### The Layering Principle
Forget drop shadows. Depth is achieved by "stacking" the surface tiers. Place a `surface-container-lowest` card inside a `surface-container-low` section to create a "recessed" look. This "Negative Depth" creates a more sophisticated, high-end feel than standard "lifted" shadows.

### Ambient Shadows
When an element must float (e.g., a notification or hover state), use a tinted shadow:
*   **Blur:** 40px
*   **Spread:** -10px
*   **Color:** `primary` (#a4e6ff) at **6% opacity**. This mimics the neon glow of the BNB-inspired accents reflecting off the obsidian surfaces.

### Ghost Borders (The Precision Edge)
While the "No-Line" rule applies to layout, **Active States** and **Input Fields** use "Ghost Borders." Use `outline-variant` (#3c494e) at 20% opacity. This creates a sharp, high-fidelity edge that feels premium without cluttering the visual field.

---

## 5. Components

### Buttons (Kinetic Triggers)
*   **Primary:** Gradient of `primary` to `primary-container`. `0.25rem` (sm) corner radius. Subtle inner-glow (`on_primary` at 10% opacity).
*   **Secondary (Glass):** `surface-container-high` at 50% opacity, 12px backdrop-blur, with a 1px Ghost Border.
*   **Tertiary:** No background. `tertiary` (#00f9be) text with a "glow-on-hover" effect.

### Input Fields (Data Vaults)
*   **Base:** `surface-container-lowest` (#0e0e0f).
*   **Border:** Ghost Border (20% opacity).
*   **Active State:** Border transitions to 100% `primary` opacity with a 2px outer glow.
*   **Typography:** User input should be `label-md` (Space Grotesk) to feel like a terminal.

### Cards & Lists (Social-Fi Clusters)
*   **Rule:** Forbid divider lines. Use `0.75rem` (xl) vertical white space between list items.
*   **AI Insight Cards:** Use a `secondary_container` (#9d03de) background at 10% opacity with a `secondary` left-accent border (2px) to denote "Social" or "AI" priority.

### Interactive Chips
*   **Selection:** `primary_fixed_dim` background with `on_primary_fixed` text.
*   **Gamified Badge:** `tertiary` background with `on_tertiary` text, using the `full` (9999px) roundedness scale.

---

## 6. Do's and Don'ts

### Do:
*   **Use Asymmetry:** Place high-value AI cards slightly off-center to create a dynamic, editorial layout.
*   **Nesting over Bordering:** Always try to define a new area by changing the `surface-container` tier before reaching for a line tool.
*   **Embrace the Glow:** Use the `tertiary` (#00f9be) color for "Success" or "Profitable" states to create high-energy contrast against the obsidian.

### Don't:
*   **No 100% White:** Never use #FFFFFF. Use `on_surface` (#e5e2e3) for primary text to maintain the dark-mode's premium softness.
*   **No Heavy Radii:** Avoid the "bubble" look. Stick to `sm` (0.25rem) and `md` (0.375rem) for most components to maintain a "sharp, professional" fintech edge.
*   **No Default Shadows:** Never use a black or grey shadow. If it doesn't have a hint of the `primary` or `surface-tint`, it doesn't belong in the Vault.