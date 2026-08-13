import { test, expect } from "@playwright/test";
import {
  createDocument,
  createLoggedInUser,
  grantAccess,
  signupViaApi,
  tokenOf,
  uniqueUser,
} from "./helpers";

test("編輯內容會存進資料庫，重新整理後還在", async ({ page, request }) => {
  await createLoggedInUser(page, request, "Persist");
  await createDocument(page);

  const editor = page.locator(".ql-editor");
  await editor.click();
  await editor.pressSequentially("這段文字必須在重新整理後still在");

  // 前端是 800ms debounce 後才 emit save-document
  await page.waitForTimeout(2500);
  await page.reload();

  await expect(page.locator(".ql-editor")).toContainText(
    "這段文字必須在重新整理後still在"
  );
});

test("標題修改後同步到列表", async ({ page, request }) => {
  await createLoggedInUser(page, request, "Title");
  await createDocument(page);

  const titleInput = page.locator('input[title="修改標題"]');
  await titleInput.fill("Q3 產品規劃會議記錄");
  await titleInput.blur();
  await expect(page.getByText("標題已儲存")).toBeVisible();

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "我的文件" }).click();
  await expect(page.getByText("Q3 產品規劃會議記錄")).toBeVisible();
});

test("沒有權限的人開別人的文件會被擋下", async ({ page, request, browser }) => {
  // 擁有者建立文件
  await createLoggedInUser(page, request, "Owner");
  const docId = await createDocument(page);

  // 另一位使用者直接用網址闖進來
  const stranger = await signupViaApi(request, uniqueUser("Stranger"));
  const ctx = await browser.newContext();
  const strangerPage = await ctx.newPage();

  await strangerPage.goto("/login");
  await strangerPage.getByPlaceholder("you@example.com").fill(stranger.email);
  await strangerPage.getByPlaceholder("••••••••").fill(stranger.password);
  await strangerPage.getByRole("button", { name: "登入" }).click();
  await expect(strangerPage).toHaveURL(/\/dashboard/);

  await strangerPage.goto(`/document/${docId}`);
  await expect(
    strangerPage.getByText("你沒有權限開啟這份文件")
  ).toBeVisible();
  await expect(
    strangerPage.getByRole("button", { name: "回到我的文件" })
  ).toBeVisible();

  await ctx.close();
});

test("兩位使用者同時編輯：內容與游標即時同步", async ({
  page,
  request,
  browser,
}) => {
  // --- 使用者 A：建立文件並分享 ---
  await createLoggedInUser(page, request, "Alice");
  const docId = await createDocument(page);
  const aliceToken = await tokenOf(page);

  const bob = await signupViaApi(request, uniqueUser("Bob"));
  await grantAccess(request, aliceToken, docId, bob.email);

  // --- 使用者 B：獨立的 context，等於另一台電腦 ---
  const bobCtx = await browser.newContext();
  const bobPage = await bobCtx.newPage();

  await bobPage.goto("/login");
  await bobPage.getByPlaceholder("you@example.com").fill(bob.email);
  await bobPage.getByPlaceholder("••••••••").fill(bob.password);
  await bobPage.getByRole("button", { name: "登入" }).click();
  await expect(bobPage).toHaveURL(/\/dashboard/);

  await bobPage.goto(`/document/${docId}`);
  await expect(bobPage.locator(".ql-editor")).toBeVisible();

  // A 應該看到 B 加入的提示，人數變成 2
  await expect(page.getByText(/Bob 加入了文件/)).toBeVisible();

  // --- A 打字，B 要即時看到 ---
  const aliceEditor = page.locator(".ql-editor");
  await aliceEditor.click();
  await aliceEditor.pressSequentially("Alice 寫的內容");

  await expect(bobPage.locator(".ql-editor")).toContainText(
    "Alice 寫的內容",
    { timeout: 10_000 }
  );

  // --- 反向：B 打字，A 要即時看到 ---
  const bobEditor = bobPage.locator(".ql-editor");
  await bobEditor.click();
  await bobEditor.press("End");
  await bobEditor.pressSequentially("，Bob 補充的內容");

  await expect(page.locator(".ql-editor")).toContainText(
    "Bob 補充的內容",
    { timeout: 10_000 }
  );

  // --- 游標旗標：A 應該看到 Bob 的游標 ---
  await expect(
    page.locator(".ql-cursor-flag", { hasText: "Bob" })
  ).toBeVisible({ timeout: 10_000 });

  // --- 線上名單顯示兩個人 ---
  await page.getByRole("button", { name: "👥" }).click();
  const onlineList = page.locator("text=線上協作者");
  await expect(onlineList).toContainText("2");

  await bobCtx.close();
});

test("按離開編輯：自己回列表，對方繼續編輯且人數減一", async ({
  page,
  request,
  browser,
}) => {
  await createLoggedInUser(page, request, "Stayer");
  const docId = await createDocument(page);
  const stayerToken = await tokenOf(page);

  const leaver = await signupViaApi(request, uniqueUser("Leaver"));
  await grantAccess(request, stayerToken, docId, leaver.email);

  const leaverCtx = await browser.newContext();
  const leaverPage = await leaverCtx.newPage();
  await leaverPage.goto("/login");
  await leaverPage.getByPlaceholder("you@example.com").fill(leaver.email);
  await leaverPage.getByPlaceholder("••••••••").fill(leaver.password);
  await leaverPage.getByRole("button", { name: "登入" }).click();
  await expect(leaverPage).toHaveURL(/\/dashboard/);

  await leaverPage.goto(`/document/${docId}`);
  await expect(leaverPage.locator(".ql-container.ql-disabled")).toHaveCount(0);

  // 兩個人都在線上
  await page.getByRole("button", { name: "👥" }).click();
  await expect(page.locator("text=線上協作者")).toContainText("2", {
    timeout: 10_000,
  });

  // 離開前打的字必須存進去，不能被 debounce 吃掉
  const leaverEditor = leaverPage.locator(".ql-editor");
  await leaverEditor.click();
  await leaverEditor.pressSequentially("離開前的最後一句");
  await leaverPage.getByRole("button", { name: "離開編輯" }).click();

  await expect(leaverPage).toHaveURL(/\/dashboard/);
  // 不該跳出「與伺服器的連線中斷了」
  await expect(leaverPage.getByText("與伺服器的連線中斷了")).toHaveCount(0);

  // 留下的人繼續編輯，人數變回 1
  await expect(page.locator("text=線上協作者")).toContainText("1", {
    timeout: 10_000,
  });
  await expect(page.locator(".ql-container.ql-disabled")).toHaveCount(0);

  // 內容確實落地
  await page.reload();
  await expect(page.locator(".ql-editor")).toContainText("離開前的最後一句");

  await leaverCtx.close();
});

test("擁有者結束協作：雙方都回到自己的文件列表", async ({
  page,
  request,
  browser,
}) => {
  await createLoggedInUser(page, request, "Ender");
  const docId = await createDocument(page);
  const enderToken = await tokenOf(page);

  const mate = await signupViaApi(request, uniqueUser("Mate"));
  await grantAccess(request, enderToken, docId, mate.email);

  const mateCtx = await browser.newContext();
  const matePage = await mateCtx.newPage();
  await matePage.goto("/login");
  await matePage.getByPlaceholder("you@example.com").fill(mate.email);
  await matePage.getByPlaceholder("••••••••").fill(mate.password);
  await matePage.getByRole("button", { name: "登入" }).click();
  await expect(matePage).toHaveURL(/\/dashboard/);

  await matePage.goto(`/document/${docId}`);
  await expect(matePage.locator(".ql-container.ql-disabled")).toHaveCount(0);

  // 協作者沒有「結束協作」，只有擁有者才有
  await expect(
    matePage.getByRole("button", { name: "結束協作" })
  ).toHaveCount(0);

  // 協作者打的字在被請出去時也要保住
  const mateEditor = matePage.locator(".ql-editor");
  await mateEditor.click();
  await mateEditor.pressSequentially("協作者寫到一半");

  await page.getByRole("button", { name: "結束協作" }).click();
  await expect(page.getByText(/結束「.*」的協作？/)).toBeVisible();
  await page
    .locator("div.fixed")
    .getByRole("button", { name: "結束協作" })
    .click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  await expect(matePage).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  await expect(matePage.getByText("與伺服器的連線中斷了")).toHaveCount(0);

  // 文件沒被刪，內容也還在
  await page.goto(`/document/${docId}`);
  await expect(page.locator(".ql-editor")).toContainText("協作者寫到一半");

  await mateCtx.close();
});

test("擁有者移除協作者後，對方畫面立刻鎖住", async ({
  page,
  request,
  browser,
}) => {
  await createLoggedInUser(page, request, "Host");
  const docId = await createDocument(page);
  const hostToken = await tokenOf(page);

  const guest = await signupViaApi(request, uniqueUser("Guest"));
  await grantAccess(request, hostToken, docId, guest.email);

  const guestCtx = await browser.newContext();
  const guestPage = await guestCtx.newPage();
  await guestPage.goto("/login");
  await guestPage.getByPlaceholder("you@example.com").fill(guest.email);
  await guestPage.getByPlaceholder("••••••••").fill(guest.password);
  await guestPage.getByRole("button", { name: "登入" }).click();
  // 要等登入真的完成，token 寫進去之前就 goto 會被導回 /login
  await expect(guestPage).toHaveURL(/\/dashboard/);
  await guestPage.goto(`/document/${docId}`);
  await expect(guestPage.locator(".ql-container.ql-disabled")).toHaveCount(0);

  // 擁有者開協作者名單並移除對方
  await page.getByRole("button", { name: "📋" }).click();
  await expect(page.getByText("協作者名單")).toBeVisible();
  await page.getByRole("button", { name: "移除" }).first().click();
  await expect(page.getByText("已移除協作者")).toBeVisible();

  // 對方畫面應該立刻被鎖住
  await expect(guestPage.getByText("你的存取權限已被移除")).toBeVisible({
    timeout: 10_000,
  });

  await guestCtx.close();
});
