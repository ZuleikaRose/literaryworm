import type { Plan } from "../types";

export const plans: Plan[] = [
  {
    id: "basic",
    name: "Basic",
    price: 7.99,
    summary: "Ebooks for one reader.",
    profiles: 1,
    audioHours: "5 hours of audiobooks a month",
    downloads: "Downloads on 1 device",
    features: ["Full ebook catalog", "Reading List, Favorites and Custom Lists", "Accessibility menu and read-along"],
  },
  {
    id: "standard",
    name: "Standard",
    price: 12.99,
    summary: "Reading and listening for a small household.",
    profiles: 3,
    audioHours: "30 hours of audiobooks a month",
    downloads: "Downloads on 3 devices",
    features: ["Everything in Basic", "Kids and Teen profiles", "Screen-time limits and PIN locks"],
  },
  {
    id: "premium",
    name: "Premium",
    price: 17.99,
    summary: "Unlimited listening for the whole family.",
    profiles: 5,
    audioHours: "Unlimited audiobooks",
    downloads: "Downloads on 5 devices",
    features: ["Everything in Standard", "Book Club rooms", "Year in Review for every profile"],
  },
];

export const planById = new Map(plans.map((p) => [p.id, p]));

export const formatPrice = (n: number) => `$${n.toFixed(2)}`;
