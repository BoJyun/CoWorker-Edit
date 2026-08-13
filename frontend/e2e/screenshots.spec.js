/**
 * 產生 README 用的畫面截圖。
 *
 * 這不是驗證用的測試，是文件產生器。跑法：
 *   npx playwright test screenshots.spec.js
 * 產出到 ../docs/
 *
 * 刻意用中性假資料（Amber / Ivan、假 email），因為截圖會進公開 repo。
 */
import { test, expect } from "@playwright/test";
import { grantAccess, signupViaApi, tokenOf } from "./helpers";

const OUT = "../docs";
const PASSWORD = "demopass123";

// 用固定名稱讓截圖之間看起來是連貫的一份文件
const OWNER = { name: "Amber", email: "amber@coworkeredit.demo", password: PASSWORD };
const MATE = { name: "Ivan", email: "ivan@coworkeredit.demo", password: PASSWORD };

const DOC_TITLE = "第三季產品規劃";
// 只有第一行帶 "1. "：Quill 會把它轉成有序清單並自動接續編號，
// 後面幾行再寫數字的話會變成「2. 2.」這種重複的字面文字。
const BODY = [
  "本季目標",
  "把協作編輯器的即時同步做到可上線的穩定度，並補齊權限管理。",
  "",
  "重點項目",
  "1. 內容與游標的雙向同步",
  "文件授權與即時撤銷",
  "離開編輯前確保內容落地",
];

async function login(page, user) {
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(user.email);
  await page.getByPlaceholder("••••••••").fill(user.password);
  await page.getByRole("button", { name: "登入" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("產生 README 截圖", async ({ page, request, browser }) => {
  test.setTimeout(180_000);

  // --- 首頁（未登入）---
  await page.goto("/");
  await expect(page.getByRole("link", { name: "免費註冊" })).toBeVisible();
  await page.screenshot({ path: `${OUT}/01-homepage.png`, fullPage: false });

  // --- 登入頁 ---
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /登入/ })).toBeVisible();
  await page.screenshot({ path: `${OUT}/02-login.png` });

  // --- 建立示範資料 ---
  await signupViaApi(request, OWNER);
  await signupViaApi(request, MATE);
  await login(page, OWNER);

  await page.getByRole("button", { name: "＋ 新建文件" }).click();
  await expect(page).toHaveURL(/\/document\//);
  await expect(page.locator(".ql-container.ql-disabled")).toHaveCount(0);
  const docId = page.url().split("/document/")[1];

  // 標題與內容
  const titleInput = page.locator('input[title="修改標題"]');
  await titleInput.fill(DOC_TITLE);
  await titleInput.blur();
  await expect(page.getByText("標題已儲存")).toBeVisible();

  const editor = page.locator(".ql-editor");
  await editor.click();
  await editor.pressSequentially(BODY.join("\n"), { delay: 4 });
  await page.waitForTimeout(2000); // 等 debounce 存檔

  // --- 編輯器單人畫面 ---
  await page.screenshot({ path: `${OUT}/04-editor.png` });

  // --- 授權協作者，讓 Ivan 進來 ---
  const ownerToken = await tokenOf(page);
  await grantAccess(request, ownerToken, docId, MATE.email);

  const mateCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const matePage = await mateCtx.newPage();
  await login(matePage, MATE);
  await matePage.goto(`/document/${docId}`);
  await expect(matePage.locator(".ql-container.ql-disabled")).toHaveCount(0);

  // Ivan 在文件末尾補一行，Amber 那邊要即時看到
  const mateEditor = matePage.locator(".ql-editor");
  await mateEditor.click();
  await mateEditor.press("Control+End");
  await mateEditor.pressSequentially("\n匯出與版本紀錄（Ivan 補充）", { delay: 12 });

  await expect(page.locator(".ql-editor")).toContainText("Ivan 補充", {
    timeout: 15_000,
  });

  // quill-cursors 的名稱旗標預設只在「滑鼠 hover 到游標」時顯示
  //（toggleFlag 實作是對 caret container 切 .hover class），
  // 游標移動本身不會讓它彈出。要截到旗標就得真的把滑鼠移過去。
  const caret = page.locator(".ql-cursor-caret-container").first();
  await expect(caret).toBeAttached({ timeout: 15_000 });
  await caret.hover({ force: true });
  await expect(
    page.locator(".ql-cursor-flag").filter({ hasText: MATE.name })
  ).toBeVisible({ timeout: 10_000 });

  // --- 雙人協作：Amber 視角，帶 Ivan 的游標旗標 ---
  await page.screenshot({ path: `${OUT}/05-collab-owner.png` });
  // --- 雙人協作：Ivan 視角 ---
  await matePage.screenshot({ path: `${OUT}/06-collab-mate.png` });

  // --- 線上協作者名單 ---
  await page.getByRole("button", { name: "👥" }).click();
  await expect(page.locator("text=線上協作者")).toBeVisible();
  await page.screenshot({ path: `${OUT}/07-online-list.png` });
  await page.getByRole("button", { name: "👥" }).click();

  // --- 結束協作的確認視窗 ---
  await page.getByRole("button", { name: "結束協作" }).click();
  await expect(page.getByText(/結束「.*」的協作？/)).toBeVisible();
  await page.screenshot({ path: `${OUT}/08-end-session.png` });
  await page.getByRole("button", { name: "取消" }).click();

  // --- Dashboard 文件列表 ---
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "我的文件" }).click();
  await expect(page.getByText(DOC_TITLE)).toBeVisible();
  await page.screenshot({ path: `${OUT}/03-dashboard.png` });

  await mateCtx.close();
});
