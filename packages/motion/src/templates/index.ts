import type { ProjectDocument } from "../schema.js";
import { template } from "./builder.js";

/**
 * The starter template library.
 *
 * Every entry is a complete, valid `ProjectDocument` with real layers, real
 * timing and real animations — "use template" loads it straight into the
 * editor with nothing to fill in. They are seeded into the database on first
 * boot and are also the fallback the client uses if the API is unreachable.
 */

export const TEMPLATE_CATEGORIES = [
  "Featured",
  "Social Media",
  "Product",
  "Event",
  "Education",
  "Restaurant",
  "Business",
  "Technology",
  "Sale",
  "Minimal",
  "Corporate",
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export interface TemplateDefinition {
  slug: string;
  name: string;
  description: string;
  category: TemplateCategory;
  /** Secondary categories the template also lists under. */
  tags: string[];
  featured: boolean;
  /** Two colours used to paint the browser card when no bitmap thumbnail exists. */
  accent: [string, string];
  document: ProjectDocument;
}

const REEL = { width: 1080, height: 1920, duration: 10 } as const;
const SQUARE = { width: 1080, height: 1080, duration: 8 } as const;
const WIDE = { width: 1920, height: 1080, duration: 12 } as const;

// ---------------------------------------------------------------------------
// 1. College Tech Fest
// ---------------------------------------------------------------------------

const techFest = template(REEL, { type: "gradient", from: "#1e1065", to: "#05030c", angle: 165 }, "techfest")
  .glow("#7c3aed", "#0b0713", 1.5, { at: 0 }, { x: 0.2, y: 0.18 }, { enter: "fadeIn", enterDuration: 1.2, loop: "float", loopDuration: 8 })
  .glow("#ec4899", "#0b0713", 1.2, { at: 0 }, { x: 0.85, y: 0.82 }, { enter: "fadeIn", enterDuration: 1.4, loop: "float", loopDuration: 10 })
  .text("caption", "ANNUAL TECHNOLOGY FESTIVAL", { at: 0.2, for: 3 }, { x: 0.5, y: 0.3 }, { enter: "fadeIn", enterDuration: 0.6, exit: "fadeOut" }, { color: "#c4b5fd" })
  .text("heading", "TECHFEST\n2026", { at: 0.5, for: 3.5 }, { x: 0.5, y: 0.44 }, { enter: "zoomIn", enterDuration: 0.9, enterEasing: "easeOutBack", exit: "fadeOut" }, { fontSize: 148, lineHeight: 0.95 })
  .shape({ kind: "rectangle", fill: "#a855f7", strokeWidth: 0, cornerRadius: 0 }, { w: 0.22, h: 0.004 }, { at: 1.2, for: 2.6 }, { x: 0.5, y: 0.56 }, { enter: "wipeIn", enterDuration: 0.6, exit: "fadeOut" })
  .text("subheading", "Build. Innovate. Compete.", { at: 1.5, for: 2.4 }, { x: 0.5, y: 0.62 }, { enter: "slideUp", enterDuration: 0.7, exit: "fadeOut" }, { color: "#e9d5ff" })
  .text("caption", "40+ EVENTS  •  ₹5L PRIZE POOL", { at: 4.2, for: 3.4 }, { x: 0.5, y: 0.38 }, { enter: "slideUp", enterDuration: 0.6, exit: "fadeOut" }, { color: "#a78bfa" })
  .text("heading", "COMPETE\nWITH THE BEST", { at: 4.4, for: 3.2 }, { x: 0.5, y: 0.5 }, { enter: "slideLeft", enterDuration: 0.8, exit: "slideRight" }, { fontSize: 104, lineHeight: 1.02 })
  .icon("trophy", "#facc15", 0.16, { at: 5.0, for: 2.6 }, { x: 0.5, y: 0.66 }, { enter: "bounceIn", enterDuration: 0.9, loop: "float", loopDuration: 3, exit: "fadeOut" })
  .text("subheading", "20 September 2026", { at: 8.0, for: 2 }, { x: 0.5, y: 0.42 }, { enter: "slideUp", enterDuration: 0.5 }, { color: "#ffffff" })
  .text("cta", "Register Now", { at: 8.4, for: 1.6 }, { x: 0.5, y: 0.56 }, { enter: "bounceIn", enterDuration: 0.7, enterEasing: "easeOutBack", loop: "pulse", loopDuration: 1.6 })
  .scene("Opening", 0, 4, { type: "fade" })
  .scene("Competition", 4, 4, { type: "slide", direction: "left" })
  .scene("Call to action", 8, 2, { type: "zoom" })
  .build(["#a855f7", "#ec4899", "#facc15", "#e9d5ff"]);

// ---------------------------------------------------------------------------
// 2. Product Sale
// ---------------------------------------------------------------------------

const productSale = template(REEL, { type: "gradient", from: "#7f1d1d", to: "#0a0505", angle: 170 }, "sale")
  .glow("#f97316", "#0a0505", 1.4, { at: 0 }, { x: 0.5, y: 0.3 }, { enter: "fadeIn", enterDuration: 1, loop: "pulse", loopDuration: 4 })
  .shape({ kind: "roundedRect", fill: "#fbbf24", strokeWidth: 0, cornerRadius: 999 }, { w: 0.42, h: 0.045 }, { at: 0.2, for: 4 }, { x: 0.5, y: 0.26 }, { enter: "zoomIn", enterDuration: 0.5, enterEasing: "easeOutBack", exit: "fadeOut" })
  .text("caption", "LIMITED TIME OFFER", { at: 0.3, for: 3.9 }, { x: 0.5, y: 0.26 }, { enter: "fadeIn", enterDuration: 0.4, enterDelay: 0.2, exit: "fadeOut" }, { color: "#431407" })
  .text("heading", "50% OFF", { at: 0.6, for: 3.8 }, { x: 0.5, y: 0.42 }, { enter: "bounceIn", enterDuration: 0.9, enterEasing: "easeOutBack", exit: "zoomOut" }, { fontSize: 210, color: "#ffffff" })
  .text("subheading", "Everything must go", { at: 1.4, for: 3 }, { x: 0.5, y: 0.54 }, { enter: "slideUp", enterDuration: 0.6, exit: "fadeOut" }, { color: "#fed7aa" })
  .text("heading", "ENDS\nSUNDAY", { at: 4.8, for: 3 }, { x: 0.5, y: 0.44 }, { enter: "rotateIn", enterDuration: 0.8, exit: "fadeOut" }, { fontSize: 128, lineHeight: 1 })
  .icon("percent", "#fbbf24", 0.18, { at: 5.2, for: 2.4 }, { x: 0.5, y: 0.62 }, { enter: "zoomIn", enterDuration: 0.6, loop: "rotate", loopDuration: 8, exit: "fadeOut" })
  .text("cta", "Shop the Sale", { at: 8.2, for: 1.8 }, { x: 0.5, y: 0.5 }, { enter: "bounceIn", enterDuration: 0.7, enterEasing: "easeOutBack", loop: "pulse", loopDuration: 1.4 }, { backgroundColor: "#fbbf24", color: "#431407" })
  .scene("Offer", 0, 4.5, { type: "fade" })
  .scene("Urgency", 4.5, 3.5, { type: "zoom" })
  .scene("Shop", 8, 2, { type: "fade" })
  .build(["#fbbf24", "#f97316", "#fed7aa"]);

// ---------------------------------------------------------------------------
// 3. Restaurant Promotion
// ---------------------------------------------------------------------------

const restaurant = template(SQUARE, { type: "gradient", from: "#1c1917", to: "#0c0a09", angle: 150 }, "resto")
  .glow("#f59e0b", "#0c0a09", 1.1, { at: 0 }, { x: 0.78, y: 0.22 }, { enter: "fadeIn", enterDuration: 1.2, loop: "float", loopDuration: 9 })
  .icon("utensils", "#f59e0b", 0.12, { at: 0.2, for: 3 }, { x: 0.5, y: 0.26 }, { enter: "zoomIn", enterDuration: 0.6, exit: "fadeOut" })
  .text("caption", "NOW SERVING", { at: 0.5, for: 2.8 }, { x: 0.5, y: 0.4 }, { enter: "fadeIn", enterDuration: 0.5, exit: "fadeOut" }, { color: "#fbbf24" })
  .text("heading", "Wood-Fired\nEvenings", { at: 0.8, for: 2.6 }, { x: 0.5, y: 0.54 }, { enter: "slideUp", enterDuration: 0.8, exit: "fadeOut" }, { fontSize: 92, lineHeight: 1.05, color: "#fafaf9" })
  .text("subheading", "Chef's tasting menu", { at: 4.0, for: 2.4 }, { x: 0.5, y: 0.4 }, { enter: "slideLeft", enterDuration: 0.6, exit: "fadeOut" }, { color: "#fde68a" })
  .text("heading", "₹899", { at: 4.3, for: 2.2 }, { x: 0.5, y: 0.55 }, { enter: "zoomIn", enterDuration: 0.7, enterEasing: "easeOutBack", exit: "fadeOut" }, { fontSize: 150 })
  .text("caption", "TUE — SUN  •  7PM ONWARDS", { at: 6.6, for: 1.4 }, { x: 0.5, y: 0.4 }, { enter: "fadeIn", enterDuration: 0.4 }, { color: "#a8a29e" })
  .text("cta", "Reserve a Table", { at: 6.8, for: 1.2 }, { x: 0.5, y: 0.56 }, { enter: "slideUp", enterDuration: 0.5, loop: "pulse", loopDuration: 1.8 }, { backgroundColor: "#f59e0b", color: "#1c1917" })
  .scene("Intro", 0, 3.8, { type: "fade" })
  .scene("Menu", 3.8, 2.8, { type: "blur" })
  .scene("Book", 6.6, 1.4, { type: "fade" })
  .build(["#f59e0b", "#fbbf24", "#fafaf9"]);

// ---------------------------------------------------------------------------
// 4. Workshop Announcement
// ---------------------------------------------------------------------------

const workshop = template(REEL, { type: "gradient", from: "#082f49", to: "#030712", angle: 160 }, "workshop")
  .glow("#0ea5e9", "#030712", 1.3, { at: 0 }, { x: 0.25, y: 0.75 }, { enter: "fadeIn", enterDuration: 1, loop: "float", loopDuration: 11 })
  .shape({ kind: "roundedRect", fill: "#0ea5e9", strokeWidth: 0, cornerRadius: 12 }, { w: 0.3, h: 0.032 }, { at: 0.2, for: 3.6 }, { x: 0.5, y: 0.24 }, { enter: "wipeIn", enterDuration: 0.5, exit: "fadeOut" })
  .text("caption", "FREE WORKSHOP", { at: 0.3, for: 3.5 }, { x: 0.5, y: 0.24 }, { enter: "fadeIn", enterDuration: 0.4, enterDelay: 0.15, exit: "fadeOut" }, { color: "#082f49" })
  .text("heading", "Design\nSystems 101", { at: 0.6, for: 3.2 }, { x: 0.5, y: 0.42 }, { enter: "slideUp", enterDuration: 0.8, exit: "slideUp" }, { fontSize: 118, lineHeight: 1.02 })
  .text("body", "A hands-on session on building\nscalable UI foundations.", { at: 1.4, for: 2.4 }, { x: 0.5, y: 0.56 }, { enter: "fadeIn", enterDuration: 0.7, exit: "fadeOut" }, { color: "#bae6fd" })
  .icon("graduation-cap", "#38bdf8", 0.15, { at: 4.4, for: 2.8 }, { x: 0.5, y: 0.36 }, { enter: "bounceIn", enterDuration: 0.8, loop: "float", loopDuration: 4, exit: "fadeOut" })
  .text("subheading", "Saturday, 12 Oct\n4:00 PM · Lab 204", { at: 4.8, for: 2.4 }, { x: 0.5, y: 0.54 }, { enter: "slideRight", enterDuration: 0.7, exit: "fadeOut" }, { color: "#e0f2fe" })
  .text("caption", "LIMITED SEATS", { at: 8.0, for: 2 }, { x: 0.5, y: 0.44 }, { enter: "fadeIn", enterDuration: 0.4 }, { color: "#7dd3fc" })
  .text("cta", "Save Your Seat", { at: 8.3, for: 1.7 }, { x: 0.5, y: 0.55 }, { enter: "zoomIn", enterDuration: 0.6, enterEasing: "easeOutBack", loop: "pulse", loopDuration: 1.6 }, { backgroundColor: "#0ea5e9", color: "#f0f9ff" })
  .scene("Title", 0, 4.2, { type: "fade" })
  .scene("Details", 4.2, 3.8, { type: "slide", direction: "up" })
  .scene("Register", 8, 2, { type: "fade" })
  .build(["#0ea5e9", "#38bdf8", "#bae6fd"]);

// ---------------------------------------------------------------------------
// 5. Startup Product Launch
// ---------------------------------------------------------------------------

const startupLaunch = template(WIDE, { type: "gradient", from: "#0f172a", to: "#020617", angle: 145 }, "launch")
  .glow("#6366f1", "#020617", 0.9, { at: 0 }, { x: 0.3, y: 0.4 }, { enter: "fadeIn", enterDuration: 1.2, loop: "float", loopDuration: 12 })
  .glow("#22d3ee", "#020617", 0.7, { at: 0 }, { x: 0.75, y: 0.65 }, { enter: "fadeIn", enterDuration: 1.4, loop: "float", loopDuration: 14 })
  .text("caption", "INTRODUCING", { at: 0.3, for: 3.7 }, { x: 0.5, y: 0.36 }, { enter: "fadeIn", enterDuration: 0.6, exit: "fadeOut" }, { color: "#818cf8" })
  .text("heading", "Orbit", { at: 0.7, for: 3.3 }, { x: 0.5, y: 0.5 }, { enter: "blurIn", enterDuration: 1, exit: "blurOut" }, { fontSize: 200 })
  .text("subheading", "The workspace that thinks ahead", { at: 1.6, for: 2.4 }, { x: 0.5, y: 0.64 }, { enter: "slideUp", enterDuration: 0.7, exit: "fadeOut" }, { color: "#c7d2fe" })
  .icon("zap", "#22d3ee", 0.06, { at: 4.6, for: 3.4 }, { x: 0.26, y: 0.42 }, { enter: "zoomIn", enterDuration: 0.5, exit: "fadeOut" })
  .text("subheading", "Instant sync", { at: 4.8, for: 3.2 }, { x: 0.26, y: 0.55 }, { enter: "slideUp", enterDuration: 0.5, exit: "fadeOut" }, { fontSize: 52 })
  .icon("cpu", "#818cf8", 0.06, { at: 4.9, for: 3.1 }, { x: 0.5, y: 0.42 }, { enter: "zoomIn", enterDuration: 0.5, enterDelay: 0.15, exit: "fadeOut" })
  .text("subheading", "On-device AI", { at: 5.1, for: 2.9 }, { x: 0.5, y: 0.55 }, { enter: "slideUp", enterDuration: 0.5, exit: "fadeOut" }, { fontSize: 52 })
  .icon("users", "#f472b6", 0.06, { at: 5.2, for: 2.8 }, { x: 0.74, y: 0.42 }, { enter: "zoomIn", enterDuration: 0.5, enterDelay: 0.3, exit: "fadeOut" })
  .text("subheading", "Built for teams", { at: 5.4, for: 2.6 }, { x: 0.74, y: 0.55 }, { enter: "slideUp", enterDuration: 0.5, exit: "fadeOut" }, { fontSize: 52 })
  .text("heading", "Early access is open", { at: 8.6, for: 3.4 }, { x: 0.5, y: 0.44 }, { enter: "slideUp", enterDuration: 0.8 }, { fontSize: 88 })
  .text("cta", "Join the Waitlist", { at: 9.2, for: 2.8 }, { x: 0.5, y: 0.62 }, { enter: "zoomIn", enterDuration: 0.6, enterEasing: "easeOutBack", loop: "pulse", loopDuration: 2 }, { backgroundColor: "#6366f1", color: "#eef2ff" })
  .scene("Reveal", 0, 4.4, { type: "fade" })
  .scene("Features", 4.4, 4, { type: "slide", direction: "left" })
  .scene("Waitlist", 8.4, 3.6, { type: "zoom" })
  .build(["#6366f1", "#22d3ee", "#f472b6", "#c7d2fe"]);

// ---------------------------------------------------------------------------
// 6. Event Invitation
// ---------------------------------------------------------------------------

const eventInvite = template(SQUARE, { type: "gradient", from: "#4a044e", to: "#0a0410", angle: 155 }, "invite")
  .glow("#d946ef", "#0a0410", 1.2, { at: 0 }, { x: 0.5, y: 0.5 }, { enter: "fadeIn", enterDuration: 1.4, loop: "pulse", loopDuration: 6 })
  .shape({ kind: "circle", fill: "#0a0410", stroke: "#d946ef", strokeWidth: 3, cornerRadius: 0 }, { w: 0.66, h: 0.66 }, { at: 0.2, for: 7.8 }, { x: 0.5, y: 0.5 }, { enter: "zoomIn", enterDuration: 1, loop: "rotate", loopDuration: 40 })
  .text("caption", "YOU'RE INVITED", { at: 0.6, for: 3.2 }, { x: 0.5, y: 0.36 }, { enter: "fadeIn", enterDuration: 0.6, exit: "fadeOut" }, { color: "#f0abfc" })
  .text("heading", "Winter\nGala", { at: 1.0, for: 2.8 }, { x: 0.5, y: 0.52 }, { enter: "zoomIn", enterDuration: 0.9, enterEasing: "easeOutBack", exit: "fadeOut" }, { fontSize: 108, lineHeight: 1 })
  .text("caption", "18 DEC  •  8 PM  •  THE ATRIUM", { at: 4.2, for: 2.4 }, { x: 0.5, y: 0.44 }, { enter: "slideUp", enterDuration: 0.6, exit: "fadeOut" }, { color: "#f5d0fe" })
  .icon("sparkles", "#f0abfc", 0.1, { at: 4.4, for: 2.2 }, { x: 0.5, y: 0.58 }, { enter: "bounceIn", enterDuration: 0.7, loop: "glow", loopDuration: 2.5, exit: "fadeOut" })
  .text("cta", "RSVP", { at: 6.8, for: 1.2 }, { x: 0.5, y: 0.5 }, { enter: "zoomIn", enterDuration: 0.6, enterEasing: "easeOutBack", loop: "pulse", loopDuration: 1.5 }, { backgroundColor: "#d946ef", color: "#fdf4ff" })
  .scene("Invitation", 0, 4, { type: "fade" })
  .scene("Details", 4, 2.8, { type: "blur" })
  .scene("RSVP", 6.8, 1.2, { type: "zoom" })
  .build(["#d946ef", "#f0abfc", "#f5d0fe"]);

// ---------------------------------------------------------------------------
// 7. New Product
// ---------------------------------------------------------------------------

const newProduct = template(REEL, { type: "solid", value: "#f5f3ef" }, "newproduct")
  .glow("#000000", "#f5f3ef", 1.6, { at: 0 }, { x: 0.5, y: 0.78 }, { enter: "fadeIn", enterDuration: 1.2 }, "radial", 120)
  .text("caption", "NEW ARRIVAL", { at: 0.3, for: 3.5 }, { x: 0.5, y: 0.24 }, { enter: "fadeIn", enterDuration: 0.5, exit: "fadeOut" }, { color: "#78716c" })
  .text("heading", "The\nEveryday\nCarry", { at: 0.6, for: 3.2 }, { x: 0.5, y: 0.44 }, { enter: "slideUp", enterDuration: 0.9, exit: "slideUp" }, { fontSize: 118, lineHeight: 1.0, color: "#0c0a09" })
  .shape({ kind: "line", fill: "#0c0a09", strokeWidth: 0, cornerRadius: 0 }, { w: 0.14, h: 0.0025 }, { at: 1.6, for: 2.2 }, { x: 0.5, y: 0.6 }, { enter: "wipeIn", enterDuration: 0.6, exit: "fadeOut" })
  .text("body", "Full-grain leather. Solid brass.\nMade to outlast trends.", { at: 4.4, for: 3.4 }, { x: 0.5, y: 0.44 }, { enter: "fadeIn", enterDuration: 0.8, exit: "fadeOut" }, { color: "#44403c" })
  .text("subheading", "From ₹4,200", { at: 5.2, for: 2.6 }, { x: 0.5, y: 0.56 }, { enter: "slideUp", enterDuration: 0.6, exit: "fadeOut" }, { color: "#0c0a09" })
  .text("cta", "Shop the Collection", { at: 8.2, for: 1.8 }, { x: 0.5, y: 0.5 }, { enter: "slideUp", enterDuration: 0.6, enterEasing: "easeOutBack" }, { backgroundColor: "#0c0a09", color: "#f5f3ef" })
  .scene("Reveal", 0, 4.2, { type: "fade" })
  .scene("Detail", 4.2, 3.8, { type: "fade" })
  .scene("Shop", 8, 2, { type: "fade" })
  .build(["#0c0a09", "#78716c", "#f5f3ef"]);

// ---------------------------------------------------------------------------
// 8. Flash Sale
// ---------------------------------------------------------------------------

const flashSale = template({ width: 1080, height: 1920, duration: 6 }, { type: "solid", value: "#030712" }, "flash")
  .glow("#facc15", "#030712", 1.3, { at: 0 }, { x: 0.5, y: 0.5 }, { enter: "fadeIn", enterDuration: 0.4, loop: "pulse", loopDuration: 1.2, intensity: 1.4 })
  .icon("zap", "#facc15", 0.2, { at: 0.1, for: 2.4 }, { x: 0.5, y: 0.3 }, { enter: "bounceIn", enterDuration: 0.5, enterEasing: "easeOutBack", loop: "shake", loopDuration: 0.6, exit: "zoomOut" })
  .text("heading", "FLASH\nSALE", { at: 0.3, for: 2.2 }, { x: 0.5, y: 0.52 }, { enter: "zoomIn", enterDuration: 0.5, enterEasing: "easeOutBack", exit: "zoomOut" }, { fontSize: 168, lineHeight: 0.95, color: "#facc15" })
  .text("heading", "24 HOURS\nONLY", { at: 2.6, for: 1.8 }, { x: 0.5, y: 0.46 }, { enter: "slideLeft", enterDuration: 0.4, exit: "slideRight", exitDuration: 0.3 }, { fontSize: 116, lineHeight: 1 })
  .text("subheading", "Up to 70% off sitewide", { at: 2.9, for: 1.5 }, { x: 0.5, y: 0.58 }, { enter: "slideUp", enterDuration: 0.4, exit: "fadeOut" }, { color: "#fde047" })
  .text("cta", "Shop Now", { at: 4.6, for: 1.4 }, { x: 0.5, y: 0.5 }, { enter: "bounceIn", enterDuration: 0.5, enterEasing: "easeOutBack", loop: "pulse", loopDuration: 1 }, { backgroundColor: "#facc15", color: "#030712" })
  .scene("Hook", 0, 2.5, { type: "zoom" })
  .scene("Offer", 2.5, 2, { type: "slide", direction: "left" })
  .scene("Act", 4.5, 1.5, { type: "zoom" })
  .build(["#facc15", "#fde047", "#030712"]);

// ---------------------------------------------------------------------------
// 9. Corporate Announcement
// ---------------------------------------------------------------------------

const corporate = template(WIDE, { type: "gradient", from: "#0c1a2b", to: "#020a14", angle: 150 }, "corp")
  .shape({ kind: "roundedRect", fill: "#1d4ed8", strokeWidth: 0, cornerRadius: 6 }, { w: 0.04, h: 0.008 }, { at: 0.2, for: 4.8 }, { x: 0.5, y: 0.34 }, { enter: "wipeIn", enterDuration: 0.5, exit: "fadeOut" })
  .text("caption", "COMPANY UPDATE", { at: 0.4, for: 4.4 }, { x: 0.5, y: 0.4 }, { enter: "fadeIn", enterDuration: 0.6, exit: "fadeOut" }, { color: "#93c5fd" })
  .text("heading", "We've raised\nour Series B", { at: 0.8, for: 4.2 }, { x: 0.5, y: 0.54 }, { enter: "slideUp", enterDuration: 0.9, exit: "fadeOut" }, { fontSize: 116, lineHeight: 1.05 })
  .text("heading", "$40M", { at: 5.6, for: 3.4 }, { x: 0.3, y: 0.48 }, { enter: "zoomIn", enterDuration: 0.7, exit: "fadeOut" }, { fontSize: 140, color: "#60a5fa" })
  .text("body", "led by Northwind Capital\nto accelerate our platform.", { at: 6.0, for: 3 }, { x: 0.66, y: 0.5 }, { enter: "slideLeft", enterDuration: 0.7, exit: "fadeOut" }, { color: "#dbeafe", align: "left" })
  .text("subheading", "Thank you to every customer and\ncolleague who got us here.", { at: 9.4, for: 2.6 }, { x: 0.5, y: 0.46 }, { enter: "fadeIn", enterDuration: 0.8 }, { color: "#e0e7ff", fontSize: 54 })
  .text("cta", "Read the Announcement", { at: 10.0, for: 2 }, { x: 0.5, y: 0.64 }, { enter: "slideUp", enterDuration: 0.6 }, { backgroundColor: "#1d4ed8", color: "#eff6ff" })
  .scene("Headline", 0, 5.4, { type: "fade" })
  .scene("Numbers", 5.4, 3.8, { type: "slide", direction: "left" })
  .scene("Thanks", 9.2, 2.8, { type: "fade" })
  .build(["#1d4ed8", "#60a5fa", "#93c5fd"]);

// ---------------------------------------------------------------------------
// 10. Minimal Product Ad
// ---------------------------------------------------------------------------

const minimal = template(SQUARE, { type: "solid", value: "#0a0a0a" }, "minimal")
  .text("caption", "MERIDIAN", { at: 0.2, for: 7.8 }, { x: 0.5, y: 0.14 }, { enter: "fadeIn", enterDuration: 0.8 }, { color: "#a3a3a3", letterSpacing: 12 })
  .shape({ kind: "circle", fill: "#fafafa", strokeWidth: 0, cornerRadius: 0 }, { w: 0.34, h: 0.34 }, { at: 0.6, for: 4 }, { x: 0.5, y: 0.48 }, { enter: "zoomIn", enterDuration: 1, enterEasing: "easeOutBack", exit: "zoomOut", loop: "float", loopDuration: 7 })
  .text("subheading", "Less, but better.", { at: 1.6, for: 3 }, { x: 0.5, y: 0.76 }, { enter: "fadeIn", enterDuration: 0.9, exit: "fadeOut" }, { color: "#fafafa", fontSize: 48, letterSpacing: 1 })
  .text("heading", "Meridian 02", { at: 5.0, for: 2.2 }, { x: 0.5, y: 0.46 }, { enter: "blurIn", enterDuration: 0.9, exit: "fadeOut" }, { fontSize: 82 })
  .text("body", "Available in three finishes.", { at: 5.6, for: 1.6 }, { x: 0.5, y: 0.58 }, { enter: "fadeIn", enterDuration: 0.6, exit: "fadeOut" }, { color: "#a3a3a3" })
  .text("cta", "Discover", { at: 7.2, for: 0.8 }, { x: 0.5, y: 0.5 }, { enter: "fadeIn", enterDuration: 0.5 }, { backgroundColor: "#fafafa", color: "#0a0a0a" })
  .scene("Object", 0, 4.8, { type: "fade" })
  .scene("Name", 4.8, 2.4, { type: "blur" })
  .scene("Discover", 7.2, 0.8, { type: "fade" })
  .build(["#fafafa", "#a3a3a3", "#0a0a0a"]);

// ---------------------------------------------------------------------------

export const TEMPLATE_LIBRARY: readonly TemplateDefinition[] = [
  {
    slug: "college-tech-fest",
    name: "College Tech Fest",
    description: "A high-energy three-scene reel for campus festivals and hackathons.",
    category: "Event",
    tags: ["Featured", "Education", "Social Media"],
    featured: true,
    accent: ["#7c3aed", "#ec4899"],
    document: techFest,
  },
  {
    slug: "product-sale",
    name: "Product Sale",
    description: "Bold discount reel built around one number and a hard deadline.",
    category: "Sale",
    tags: ["Featured", "Product", "Social Media"],
    featured: true,
    accent: ["#f97316", "#fbbf24"],
    document: productSale,
  },
  {
    slug: "restaurant-promotion",
    name: "Restaurant Promotion",
    description: "Warm square post for menus, tasting nights and table bookings.",
    category: "Restaurant",
    tags: ["Social Media", "Business"],
    featured: false,
    accent: ["#f59e0b", "#1c1917"],
    document: restaurant,
  },
  {
    slug: "workshop-announcement",
    name: "Workshop Announcement",
    description: "Clear, information-dense reel for sessions, classes and seminars.",
    category: "Education",
    tags: ["Event", "Featured"],
    featured: true,
    accent: ["#0ea5e9", "#38bdf8"],
    document: workshop,
  },
  {
    slug: "startup-product-launch",
    name: "Startup Product Launch",
    description: "Widescreen launch film with a feature triptych and a waitlist CTA.",
    category: "Technology",
    tags: ["Product", "Business", "Featured"],
    featured: true,
    accent: ["#6366f1", "#22d3ee"],
    document: startupLaunch,
  },
  {
    slug: "event-invitation",
    name: "Event Invitation",
    description: "Elegant square invite with a rotating frame and an RSVP close.",
    category: "Event",
    tags: ["Social Media", "Corporate"],
    featured: false,
    accent: ["#d946ef", "#4a044e"],
    document: eventInvite,
  },
  {
    slug: "new-product",
    name: "New Product",
    description: "Light, editorial reel for physical goods and considered launches.",
    category: "Product",
    tags: ["Minimal", "Social Media"],
    featured: false,
    accent: ["#0c0a09", "#f5f3ef"],
    document: newProduct,
  },
  {
    slug: "flash-sale",
    name: "Flash Sale",
    description: "Six-second urgency spot. Fast cuts, one message, immediate CTA.",
    category: "Sale",
    tags: ["Product", "Social Media", "Featured"],
    featured: true,
    accent: ["#facc15", "#030712"],
    document: flashSale,
  },
  {
    slug: "corporate-announcement",
    name: "Corporate Announcement",
    description: "Restrained widescreen format for funding, milestones and press.",
    category: "Corporate",
    tags: ["Business", "Technology"],
    featured: false,
    accent: ["#1d4ed8", "#0c1a2b"],
    document: corporate,
  },
  {
    slug: "minimal-product-ad",
    name: "Minimal Product Ad",
    description: "Quiet, typographic square ad that lets a single object carry it.",
    category: "Minimal",
    tags: ["Product", "Corporate"],
    featured: false,
    accent: ["#fafafa", "#0a0a0a"],
    document: minimal,
  },
] as const;

export function getTemplate(slug: string): TemplateDefinition | undefined {
  return TEMPLATE_LIBRARY.find((t) => t.slug === slug);
}

/**
 * The polished default project (§46). New blank projects start from an empty
 * canvas; this is what "Open sample" and the seeded demo project use.
 */
export const SAMPLE_PROJECT: ProjectDocument = techFest;
