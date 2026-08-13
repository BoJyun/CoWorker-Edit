import { expect } from "@playwright/test";

const API = "http://localhost:8000/api";

/** 每次執行都用唯一 email，避免撞到前一輪留下的帳號。
 *  不能用 .test / .example 這類保留網域，email-validator 會擋。 */
export function uniqueUser(label) {
  const stamp = `${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  return {
    name: label,
    email: `${label.toLowerCase()}-${stamp}@e2etest.com`,
    password: "testtest",
  };
}

/** 直接打 API 註冊，比走 UI 快得多，也讓測試聚焦在要驗的行為上。 */
export async function signupViaApi(request, user) {
  const resp = await request.post(`${API}/auth/signup`, { data: user });
  expect(resp.ok(), `註冊失敗：${await resp.text()}`).toBeTruthy();
  return user;
}

/** 走 UI 登入，結束時停在 /dashboard。 */
export async function loginViaUi(page, user) {
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(user.email);
  await page.getByPlaceholder("••••••••").fill(user.password);
  await page.getByRole("button", { name: "登入" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/** 註冊 + 登入一次做完。 */
export async function createLoggedInUser(page, request, label) {
  const user = uniqueUser(label);
  await signupViaApi(request, user);
  await loginViaUi(page, user);
  return user;
}

/** 取得已登入頁面的 JWT，用來打需要授權的 API。 */
export async function tokenOf(page) {
  return page.evaluate(() => localStorage.getItem("token"));
}

/** 擁有者把文件分享給另一位使用者。 */
export async function grantAccess(request, token, docId, email) {
  const resp = await request.patch(`${API}/doc/access`, {
    headers: { Authorization: token },
    data: { email, docId },
  });
  expect(resp.ok(), `授權失敗：${await resp.text()}`).toBeTruthy();
}

/** 建立文件並停在編輯器頁，回傳 docId。 */
export async function createDocument(page) {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "＋ 新建文件" }).click();
  await expect(page).toHaveURL(/\/document\//);
  await expect(page.locator(".ql-editor")).toBeVisible();
  // 等 Quill 從 "Loading..." 變成可編輯狀態
  await expect(page.locator(".ql-container.ql-disabled")).toHaveCount(0);
  return page.url().split("/document/")[1];
}
