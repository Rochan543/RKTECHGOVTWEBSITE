import { db, currentAffairCategoriesTable } from "../src/index.ts";

const DEFAULT_CATEGORIES = [
  { name: "Economy & Business", slug: "economy", description: "Economic updates, banking sector, budget, and business news." },
  { name: "Polity & Constitution", slug: "polity", description: "Indian polity, parliament updates, bills, acts, and constitutional topics." },
  { name: "History & Culture", slug: "history", description: "Indian history, heritage, art, and cultural news." },
  { name: "Geography & Mapping", slug: "geography", description: "Physical geography, maps, environmental mapping, and locations in news." },
  { name: "Science & Innovation", slug: "science", description: "General science, innovations, scientific discoveries, and milestones." },
  { name: "Technology & Space", slug: "technology", description: "ISRO, Space technology, IT developments, AI, and cybersecurity." },
  { name: "Sports & Athletics", slug: "sports", description: "Cricket, Olympics, tennis, athletes, tournaments, and records." },
  { name: "Awards & Honors", slug: "awards", description: "National awards, Nobel prize, civilian honors, film festivals." },
  { name: "International Affairs", slug: "international", description: "Global news, bilateral relations, conflicts, treaties, and foreign visits." },
  { name: "Environment & Climate", slug: "environment", description: "Climate change, conservation, national parks, wildlife, pollution." },
  { name: "Defence & Security", slug: "defence", description: "Military exercises, defense deals, missiles, security forces." },
  { name: "Government Schemes", slug: "government-schemes", description: "Welfare policies, central and state schemes, initiatives, and portals." },
  { name: "Appointments & Persons", slug: "appointments", description: "Key appointments, dignitaries, constitutional heads, committees." },
  { name: "Books & Authors", slug: "books", description: "Important books published, popular authors, literary awards." },
  { name: "Obituaries", slug: "obituaries", description: "Prominent personalities who passed away recently." },
  { name: "Summits & Conferences", slug: "summits", description: "G20, BRICS, ASEAN, global meets, summits in news." },
  { name: "Reports & Indexes", slug: "reports", description: "GDP ratings, poverty index, happiness index, reports by IMF, World Bank." },
  { name: "Miscellaneous", slug: "miscellaneous", description: "General updates, important days, themes, and national news." }
];

async function main() {
  try {
    console.log("Seeding default categories...");

    for (const cat of DEFAULT_CATEGORIES) {
      try {
        await db.insert(currentAffairCategoriesTable).values(cat);
        console.log(`Successfully seeded category: ${cat.name}`);
      } catch (err: any) {
        if (err.code === "23505" || err.message?.includes("unique constraint")) {
          console.log(`Category already exists: ${cat.name}`);
        } else {
          console.error(`Failed to seed ${cat.name}:`, err.message);
        }
      }
    }

    console.log("Category seeding complete!");
  } catch (err: any) {
    console.error("Failed to run seed script:", err.message || err);
  }
  process.exit(0);
}

main();
