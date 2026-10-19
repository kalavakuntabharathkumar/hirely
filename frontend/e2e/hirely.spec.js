import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL || "demo@hirely.test";
const PASSWORD = process.env.E2E_PASSWORD;
if (!PASSWORD) throw new Error('Set the password first, e.g. PowerShell: $env:E2E_PASSWORD="your DEMO_PASSWORD"');

const HEADERS = { "X-Requested-With": "hirely" };
const uid = () => Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);

async function login(page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

// Test data is created through the API (fast) and archived afterwards so the lists stay clean.
async function createViaApi(page, tag, extra = {}) {
  const res = await page.request.post("/api/candidates", {
    headers: HEADERS,
    data: { name: `QA ${tag}`, email: `qa.${tag}@example.com`, role: "QA Tester", skills: `skill${tag}`, ...extra },
  });
  expect(res.status()).toBe(201);
  return res.json();
}

async function archiveViaApi(page, id) {
  await page.request.delete(`/api/candidates/${id}`, { headers: HEADERS });
}

async function openAddDialog(page) {
  await page.goto("/candidates");
  await page.getByRole("button", { name: "Add candidate" }).first().click();
  return page.getByRole("dialog", { name: "Add candidate" });
}

test.describe("Signed out", () => {
  test("wrong password shows an error and stays on the login page", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(`nobody.${uid()}@example.com`);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toContainText("Incorrect email or password");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("a protected page redirects to the login page", async ({ page }) => {
    await page.goto("/candidates");
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("Signed in", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("dashboard shows the four metric cards", async ({ page }) => {
    await expect(page.locator(".stat-label")).toHaveText(["Total candidates", "In interview", "Offers out", "Hire rate"]);
  });

  test("sign out returns to the login page", async ({ page }) => {
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("add-candidate form shows field errors for empty and bad input", async ({ page }) => {
    const dialog = await openAddDialog(page);
    await dialog.getByRole("button", { name: "Add candidate" }).click();
    await expect(dialog.getByText("Name is required.")).toBeVisible();
    await expect(dialog.getByText("Role is required.")).toBeVisible();
    await expect(dialog.getByText("Enter a valid email address, like name@example.com.")).toBeVisible();

    await dialog.getByLabel("Phone (optional)").fill("abc");
    await dialog.getByRole("button", { name: "Add candidate" }).click();
    await expect(dialog.getByText("Enter a valid phone number")).toBeVisible();
  });

  test("full candidate lifecycle: add, move stage, edit, note, archive", async ({ page }) => {
    const tag = uid();
    const name = `QA ${tag}`;

    const dialog = await openAddDialog(page);
    await dialog.getByLabel("Full name").fill(name);
    await dialog.getByLabel("Email").fill(`qa.${tag}@example.com`);
    await dialog.getByLabel("Role applied for").fill("QA Tester");
    await dialog.getByLabel("Skills (comma separated)").fill("selenium, pytest");
    await dialog.getByRole("button", { name: "Add candidate" }).click();

    await expect(page).toHaveURL(/\/candidates\/\d+$/);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

    // Only legal moves are offered from Applied
    await expect(page.getByRole("button", { name: "Advance to Screening" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reject" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Advance to Interview" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Advance to Hired" })).toHaveCount(0);

    await page.getByRole("button", { name: "Advance to Screening" }).click();
    await expect(page.locator(".step.current")).toContainText("Screening");
    await expect(page.locator(".history li")).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Back to Applied" })).toBeVisible();

    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const edit = page.getByRole("dialog", { name: "Edit candidate" });
    await edit.getByLabel("Role applied for").fill("Senior QA Tester");
    await edit.getByRole("button", { name: "Save" }).click();
    await expect(page.locator("dl.facts")).toContainText("Senior QA Tester");

    await page.getByLabel("Add a note").fill("Good communication");
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByText("Good communication")).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("No notes yet.")).toBeVisible();

    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await page.getByRole("dialog", { name: "Archive this candidate?" }).getByRole("button", { name: "Archive", exact: true }).click();
    await expect(page).toHaveURL(/\/candidates$/);
    await page.getByLabel("Search").fill(name);
    await expect(page.getByText("No results for this search")).toBeVisible();
  });

  test("duplicate email is rejected next to the field", async ({ page }) => {
    const tag = uid();
    const existing = await createViaApi(page, tag);
    try {
      const dialog = await openAddDialog(page);
      await dialog.getByLabel("Full name").fill("Duplicate Person");
      await dialog.getByLabel("Email").fill(`qa.${tag}@example.com`);
      await dialog.getByLabel("Role applied for").fill("QA Tester");
      await dialog.getByRole("button", { name: "Add candidate" }).click();
      await expect(dialog.getByText("already exists")).toBeVisible();
    } finally {
      await archiveViaApi(page, existing.id);
    }
  });

  test("search and stage filter work together", async ({ page }) => {
    const tag = uid();
    const created = await createViaApi(page, tag);
    try {
      const moved = await page.request.post(`/api/candidates/${created.id}/stage`, { headers: HEADERS, data: { stage: "Screening" } });
      expect(moved.status()).toBe(200);

      await page.goto("/candidates");
      await page.getByLabel("Search").fill(`skill${tag}`);
      await expect(page.getByRole("link", { name: `QA ${tag}` })).toBeVisible();
      await expect(page.locator("tbody tr")).toHaveCount(1);

      await page.getByLabel("Stage").selectOption("Screening");
      await expect(page.locator("tbody tr")).toHaveCount(1);

      await page.getByLabel("Stage").selectOption("Hired");
      await expect(page.getByText("No results for this search")).toBeVisible();
    } finally {
      await archiveViaApi(page, created.id);
    }
  });

  test("dashboard total goes up when a candidate is added and down when archived", async ({ page }) => {
    const total = async () => (await (await page.request.get("/api/dashboard")).json()).cards.total;
    const before = await total();
    const created = await createViaApi(page, uid());
    const card = page.locator(".stat", { hasText: "Total candidates" }).locator(".stat-value");
    try {
      await page.goto("/");
      await expect(card).toHaveText(String(before + 1));
    } finally {
      await archiveViaApi(page, created.id);
    }
    await page.reload();
    await expect(card).toHaveText(String(before));
  });

  test("board shows every stage column and a new candidate in Applied", async ({ page }) => {
    const tag = uid();
    const created = await createViaApi(page, tag);
    try {
      await page.goto("/board");
      for (const stage of ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"]) {
        await expect(page.getByLabel(`${stage} column`)).toBeVisible();
      }
      await expect(page.getByLabel("Applied column").getByText(`QA ${tag}`)).toBeVisible();
    } finally {
      await archiveViaApi(page, created.id);
    }
  });
});

test.describe("Phone layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("pages do not scroll sideways on a phone", async ({ page }) => {
    await login(page);
    for (const path of ["/", "/candidates", "/board"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} overflows sideways by ${overflow}px`).toBeLessThanOrEqual(1);
    }
  });
});