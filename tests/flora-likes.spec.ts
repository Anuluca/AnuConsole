import {test,expect} from '@playwright/test';
test('数据维护展示真实统计并保存两只模型的数量',async({page})=>{
 let writes=0;
 const data={counts:{huahua:100,xiaohei:50},version:'1',updatedAt:null,limit:10,timezone:'Asia/Shanghai',days:[{date:new Date(Date.now()+8*3600000).toISOString().slice(0,10),counts:{huahua:3,xiaohei:2},visitors:2,countries:{CN:5},devices:{desktop:3,mobile:2},browsers:{Chrome:5}}],adjustments:[]};
 await page.route('**/api/data/flora-likes',async route=>{if(route.request().method()==='PUT'){writes++;const body=route.request().postDataJSON();expect(body.version).toBe(data.version);data.counts=body.counts;data.version='2';}await route.fulfill({json:data})});
 await page.goto('/anutrium/data');
 await expect(page.getByRole('heading',{name:'喜爱数量',exact:true})).toBeVisible();
 await expect(page.getByLabel('花花',{exact:true})).toHaveValue('100');
 const inputHeight=(await page.getByLabel('花花',{exact:true}).boundingBox())!.height;
 const secondHeight=(await page.getByLabel('小黑',{exact:true}).boundingBox())!.height;
 const buttonHeight=(await page.getByRole('button',{name:'保存数量'}).boundingBox())!.height;
 expect(inputHeight).toBe(48);expect(secondHeight).toBe(inputHeight);expect(buttonHeight).toBe(inputHeight);
 await page.getByLabel('花花',{exact:true}).fill('123');
 await page.getByRole('button',{name:'保存数量'}).click();
 await expect(page.getByRole('status')).toContainText('已保存');expect(writes).toBe(1);
 await expect(page.locator('tbody')).toContainText('3');
 await expect(page.getByText('国家／地区',{exact:true})).toBeVisible();
 await page.screenshot({path:`test-results/flora-likes-${test.info().project.name}.png`});
});
