import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

test('登录页可访问', async ({ app, screen }) => {
  await app.open('/');
  await expect(screen.getByPlaceholder('请输入账号')).toBeVisible();
  await expect(screen.getByRole('button', '登录')).toBeVisible();
});

test('账号密码登录后进入冰箱首页', async ({ app, screen, browser }) => {
  await app.open('/');
  await screen.getByPlaceholder('请输入账号').fill('czy');
  await screen.getByPlaceholder('请输入密码').fill('czy@1234');
  await screen.getByRole('button', '登录').click();

  await expect(browser).toHaveURL(/#\/$/);
  await expect(screen.getByText('我的冰箱')).toBeVisible();
});

// 需要 CODEBUDDY_API_KEY（根目录 .env 提供），由 Agent 自行探索页面
test('Agent 驱动登录流程', async ({ app, agent }) => {
  await app.open('/');
  await agent.act('在登录表单填写账号 {username} 和密码 {password}，然后点击登录按钮提交', {
    params: { username: 'czy', password: 'czy@1234' },
  });
  await agent.assert('已经成功登录，页面显示冰箱清单或空状态提示');
});
