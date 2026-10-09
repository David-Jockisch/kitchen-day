// Elementary menu supplied by the user. Middle/high school items omitted.
const meals=[
[5,'Sausage sandwich','Pulled pork on a bun|French fries|Carrots|Peaches|Milk'],
[6,'Egg patty and toast','Popcorn chicken bowl|Dinner roll|Corn|Applesauce|Milk'],
[7,'Donut','Chicken patty on a bun|Baked beans|Green beans|Mixed fruit|Milk'],
[8,'Breakfast pizza','Spaghetti with meat sauce|Garlic toast|Broccoli with cheese|Apple slices|Milk'],
[9,'Pancake on a stick','Primo pizza|Tossed salad|Celery sticks|Orange|Milk'],
[12,'','','No school — Indigenous People’s Day'],
[13,'Dutch waffle','Meatballs with spaghetti sauce|Garlic toast|Green beans|Corn|Pears|Milk'],
[14,'Pancake on a stick','Ham and cheese on a bun|Au gratin potatoes|Fresh carrots|Peaches|Milk'],
[15,'French toast sticks','BBQ chicken nachos|Salsa|Refried beans|Celery sticks|Apple slices|Milk'],
[16,'Biscuit and gravy','Cheese bites|Marinara sauce|Lettuce salad with ranch|Oranges|Milk'],
[19,'Donut','Ravioli|Garlic toast|Carrots|Orange|Milk'],
[20,'English muffin sandwich','Grilled cheese|Chicken noodle soup|Broccoli|Celery|Sliced apple|Milk'],
[21,'Breakfast pizza','Sliced cheese pizza|Lettuce salad|Green beans|Peaches|Milk'],
[22,'Sausage pancake taco','','11:30 dismissal — Parent/teacher conferences'],
[23,'','','No school'],
[26,'Dutch waffle','Cheeseburger on a bun|Baked beans|Fresh carrots|Pears|Milk'],
[27,'Pancake on a stick','Chicken nuggets|Mashed potatoes with gravy|Green beans|Mixed fruit|Milk'],
[28,'Pumpkin bread','Tater tot casserole|Garlic toast|Celery sticks|Sliced apple|Milk'],
[29,'Biscuit and gravy','Max Sticks|Marinara sauce|Lettuce salad|Corn|Orange|Milk'],
[30,'Sausage mummies','','Noon dismissal — School Improvement Day']
];
export const octoberMenu=Object.fromEntries(meals.map(([day,breakfast,lunch,notes=''])=>[`2026-10-${String(day).padStart(2,'0')}`,{breakfast:breakfast?[breakfast,'Fruit','Juice','Milk']:[],lunch:lunch?lunch.split('|'):[],notes}]));
export function seedMenu(s){if(s.elementaryOctober2026)return;s.menus??={};for(const [date,menu] of Object.entries(octoberMenu))s.menus[date]??=structuredClone(menu);s.elementaryOctober2026=true}
export function validMenus(menus){return menus===undefined||menus&&typeof menus==='object'&&!Array.isArray(menus)&&Object.entries(menus).every(([date,m])=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&m&&['breakfast','lunch'].every(k=>Array.isArray(m[k])&&m[k].length<=100&&m[k].every(x=>typeof x==='string'&&x.length<=500))&&typeof m.notes==='string'&&m.notes.length<=2000)}
