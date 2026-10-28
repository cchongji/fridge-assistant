import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

test('app opens', async ({ app, browser }) => {
  await app.open('/');
  await expect(browser.locator('body')).toBeVisible();
});

// With the model key in the environment, uncomment:
test('the agent drives a flow', async ({ app, agent }) => {
  await app.open('/');
  await agent.act('在登录表单填写用户名 {username} 和密码 {password}，然后提交登录', {
    params: { username: 'czy', password: 'czy@1234' }
  });
  await agent.assert('登录成功并进入冰箱日历首页');
});
