import { db, usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { signToken } from "../middlewares/auth";

async function runVerification() {
  try {
    console.log("=== API Verification Script ===");
    
    // 1. Find an admin user
    const [admin] = await db
      .select()
      .from(usersTable)
      .where(or(eq(usersTable.role, "admin"), eq(usersTable.role, "super_admin")))
      .limit(1);

    if (!admin) {
      console.error("Error: No admin or super_admin found in database to authenticate request.");
      return;
    }

    console.log(`Using admin: ${admin.name} (${admin.email}, role: ${admin.role})`);

    // 2. Generate a valid JWT token
    const token = signToken({ userId: admin.id, role: admin.role });
    console.log("Generated JWT Token:", token);

    // Helper to perform HTTP request
    const request = async (urlPath: string, method: string = "GET", body?: any): Promise<{ status: number, data: any }> => {
      const response = await fetch(`http://localhost:3000${urlPath}`, {
        method,
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: body ? JSON.stringify(body) : undefined
      });
      const data = await response.json();
      return { status: response.status, data };
    };

    // 3. Fetch current admin stats
    console.log("\n--- Testing GET /api/v1/adaptive/admin ---");
    const statsBefore = await request("/api/v1/adaptive/admin");
    console.log("Status:", statsBefore.status);
    console.log("Stats preview (studyPlans):", JSON.stringify(statsBefore.data.studyPlans, null, 2));
    console.log("Stats preview (mastery):", JSON.stringify(statsBefore.data.mastery, null, 2));
    console.log("Stats preview (recommendationTrends):", JSON.stringify(statsBefore.data.recommendationTrends, null, 2));

    // 4. Trigger engine re-evaluation
    console.log("\n--- Testing POST /api/v1/adaptive/admin/re-evaluate ---");
    const reEvalResult = await request("/api/v1/adaptive/admin/re-evaluate", "POST");
    console.log("Status:", reEvalResult.status);
    console.log("Re-evaluation response:", JSON.stringify(reEvalResult.data, null, 2));

    // 5. Fetch stats after re-evaluation to verify they updated
    console.log("\n--- Testing GET /api/v1/adaptive/admin (After Re-evaluation) ---");
    const statsAfter = await request("/api/v1/adaptive/admin");
    console.log("Status:", statsAfter.status);
    console.log("Stats preview (studyPlans):", JSON.stringify(statsAfter.data.studyPlans, null, 2));
    console.log("Stats preview (mastery):", JSON.stringify(statsAfter.data.mastery, null, 2));

  } catch (error) {
    console.error("Verification failed:", error);
  }
}

runVerification();
