import { test, expect } from "@playwright/test";
import { createLoggedInUser, signupViaApi, uniqueUser } from "./helpers";

test("首頁未登入時顯示註冊入口", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /與團隊即時協作/ })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "免費註冊" })).toBeVisible();
});

test("走完整 UI 流程註冊並登入", async ({ page }) => {
  const user = uniqueUser("Ming");

  await page.goto("/signup");
  await page.getByPlaceholder("王小明").fill(user.name);
  await page.getByPlaceholder("you@example.com").fill(user.email);
  await page.getByPlaceholder("至少 6 碼").fill(user.password);
  await page.getByPlaceholder("再輸入一次密碼").fill(user.password);
  await page.getByRole("button", { name: "註冊" }).click();

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText("註冊成功，請登入！")).toBeVisible();

  await page.getByPlaceholder("you@example.com").fill(user.email);
  await page.getByPlaceholder("••••••••").fill(user.password);
  await page.getByRole("button", { name: "登入" }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "我的文件" })).toBeVisible();
  await expect(page.getByRole("button", { name: "登出" })).toBeVisible();
});

test("兩次密碼不一致時擋在前端，不送出請求", async ({ page }) => {
  const user = uniqueUser("Mismatch");

  await page.goto("/signup");
  await page.getByPlaceholder("王小明").fill(user.name);
  await page.getByPlaceholder("you@example.com").fill(user.email);
  await page.getByPlaceholder("至少 6 碼").fill("testtest");
  await page.getByPlaceholder("再輸入一次密碼").fill("different");
  await page.getByRole("button", { name: "註冊" }).click();

  await expect(page.getByText("兩次輸入的密碼不一致")).toBeVisible();
  await expect(page).toHaveURL(/\/signup/);
});

test("密碼錯誤時顯示錯誤訊息且留在登入頁", async ({ page, request }) => {
  const user = await signupViaApi(request, uniqueUser("WrongPw"));

  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(user.email);
  await page.getByPlaceholder("••••••••").fill("wrongpassword");
  await page.getByRole("button", { name: "登入" }).click();

  await expect(page.getByText("email 或密碼錯誤")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("未登入直接開 dashboard 會被導回登入頁", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("登出後不能再進 dashboard", async ({ page, request }) => {
  await createLoggedInUser(page, request, "Logout");

  await page.getByRole("button", { name: "登出" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
