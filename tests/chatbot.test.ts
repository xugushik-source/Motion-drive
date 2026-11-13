import test from "node:test";
import assert from "node:assert/strict";
import { findKnowledge, detectLanguage } from "../src/lib/knowledge.ts";
import { publicRecords } from "../src/lib/public-content.ts";
// FAQ index: 0 where, 1 hours, 2 programs, 3 how to book, 4 price, 5 age/docs,
// 6 payment, 7 groups, 8 missed lesson, 9 yard, 10 seats, 11 exams, 12 language.
const TRAIN: Record<string, [string, number][]> = {
  ru: [
    ["Где вы находитесь?", 0],
    ["Какой адрес в Ниноцминде?", 0],
    ["До скольки вы работаете?", 1],
    ["Какой у вас график работы", 1],
    ["Какие у вас курсы?", 2],
    ["Как записаться на обучение", 3],
    ["Сколько стоит теория?", 4],
    ["Цена вождения по городу", 4],
    ["Сколько стоит площадка", 4],
    ["С какого возраста можно?", 5],
    ["Какие документы нужны?", 5],
    ["Можно оплатить картой?", 6],
    ["Нужна ли предоплата", 6],
    ["Когда начинается следующая группа", 7],
    ["Когда старт группы по теории", 7],
    ["Я пропустил занятие, что делать", 8],
    ["Сколько занятий на площадке брать", 9],
    ["Есть места в группе?", 10],
    ["Где сдавать экзамен?", 11],
    ["Можно ли сдать экзамен на армянском", 11],
  ],
  en: [
    ["Where are you located?", 0],
    ["What is your address?", 0],
    ["What are your opening hours?", 1],
    ["What courses do you offer?", 2],
    ["How do I sign up?", 3],
    ["How much does theory cost?", 4],
    ["What is the price of city driving?", 4],
    ["What age can I start?", 5],
    ["Which documents do I need?", 5],
    ["Can I pay by card?", 6],
    ["When does the next group start?", 7],
    ["I missed a lesson, what now?", 8],
    ["How many yard lessons do I need?", 9],
    ["Do you have free seats?", 10],
    ["Where do I take the exam?", 11],
  ],
  ka: [
    ["სად მდებარეობთ?", 0],
    ["მისამართი რა არის?", 0],
    ["რომელ საათამდე მუშაობთ?", 1],
    ["რა კურსები გაქვთ?", 2],
    ["როგორ ჩავეწერო?", 3],
    ["რა ღირს თეორია?", 4],
    ["რამდენი ღირს მართვის გაკვეთილი?", 4],
    ["რა ასაკიდან შეიძლება?", 5],
    ["რა საბუთებია საჭირო?", 5],
    ["ბარათით შემიძლია გადახდა?", 6],
    ["როდის იწყება შემდეგი ჯგუფი?", 7],
    ["გაკვეთილი გავაცდინე, რა ვქნა?", 8],
    ["რამდენი გაკვეთილი მჭირდება მოედანზე?", 9],
    ["ადგილები თუ არის?", 10],
    ["სად ვაბარებ გამოცდას?", 11],
  ],
  hy: [
    ["Որտե՞ղ եք գտնվում", 0],
    ["Ո՞րն է ձեր հասցեն", 0],
    ["Մինչև ժամը քանիսն եք աշխատում", 1],
    ["Ի՞նչ դասընթացներ ունեք", 2],
    ["Ինչպե՞ս գրանցվել", 3],
    ["Որքա՞ն արժե տեսությունը", 4],
    ["Ի՞նչ արժե վարումը քաղաքում", 4],
    ["Քանի՞ տարեկանից կարելի է", 5],
    ["Ի՞նչ փաստաթղթեր են պետք", 5],
    ["Կարո՞ղ եմ քարտով վճարել", 6],
    ["Ե՞րբ է սկսվում հաջորդ խումբը", 7],
    ["Դասը բաց եմ թողել, ինչ անեմ", 8],
    ["Քանի՞ դաս է պետք հրապարակում", 9],
    ["Տեղ կա՞", 10],
    ["Որտե՞ղ են քննությունը հանձնում", 11],
  ],
};

const HELD: Record<string, [string, number][]> = {
  ru: [
    ["добрый день, подскажите стоимость обучения", 4],
    ["хочу записаться на курсы", 3],
    ["а где у вас школа", 0],
    ["работаете в воскресенье?", 1],
    ["с какого года можно учиться", 5],
    ["можно ли платить частями", 6],
    ["когда следующий набор", 7],
    ["на каком языке идёт теория", 12],
    ["куда ехать на экзамен", 11],
    ["можно ли отменить занятие", 6],
    ["где находится филиал в ниноцминде", 0],
    ["есть ли места на вечернюю группу", 10],
  ],
  en: [
    ["hi, how much is the course", 4],
    ["i would like to register", 3],
    ["where is the school", 0],
    ["what time do you close", 1],
    ["do i need a passport", 5],
    ["can i pay in cash", 6],
    ["when is the next course starting", 7],
    ["where do i take the driving test", 11],
    ["is there space in the evening group", 10],
  ],
  ka: [
    ["გამარჯობა, რა ღირს სწავლა?", 4],
    ["მინდა ჩავეწერო", 3],
    ["სად არის თქვენი სკოლა", 0],
    ["რომელ საათზე იხსნება", 1],
    ["რა დოკუმენტები მჭირდება?", 5],
    ["შეიძლება ნაღდი ფულით გადახდა?", 6],
    ["როდის დაიწყება ახალი ჯგუფი", 7],
    ["გამოცდა სად ტარდება", 11],
    ["თავისუფალი ადგილი არის?", 10],
    ["რამდენი წლიდან იღებთ?", 5],
  ],
  hy: [
    ["Բարև, որքան է արժե ուսուցումը", 4],
    ["Ուզում եմ գրանցվել", 3],
    ["Որտեղ է ձեր դպրոցը", 0],
    ["Մինչև ո՞ր ժամն եք աշխատում", 1],
    ["Ի՞նչ փաստաթղթեր պետք են", 5],
    ["Կանխիկ կարելի է վճարել", 6],
    ["Ե՞րբ է նոր խումբ սկսվում", 7],
    ["Քննությունը որտեղ է", 11],
    ["Ազատ տեղ կա", 10],
    ["Քանի տարեկանից են ընդունում", 5],
  ],
  "hy-latin": [
    ["Barev dzez, ur ek gtnvum", 0],
    ["inchqan e arjum teoria", 4],
    ["grancvel kuzem", 3],
    ["qnnutyuny ur e", 11],
    ["das bac toxac em", 8],
  ],
};

const reply = (message: string, page: string) => {
  const lang = detectLanguage(message, page as any);
  const hit = findKnowledge(
    message,
    publicRecords.faq.filter((f: any) => f.locale === lang),
  );
  return hit ? Number(hit.id.split("-")[2]) : -1;
};
for (const [name, set] of [
  ["questions", TRAIN],
  ["new wordings", HELD],
] as const)
  test(`chatbot answers ${name} in Russian, English, Georgian and Armenian`, () => {
    for (const [page, list] of Object.entries(set))
      for (const [q, want] of list)
        assert.equal(
          reply(q, page.replace("hy-latin", "ru")),
          want,
          `[${page}] ${q}`,
        );
  });
test("the chatbot stays silent instead of answering off-topic", () => {
  for (const [q, page] of [
    ["Привет, как дела", "ru"],
    ["спасибо", "ru"],
    ["I start work at 9", "en"],
    ["Hello", "en"],
    ["the weather is nice today", "en"],
    ["გმადლობთ", "ka"],
    ["Շնորհակալություն", "hy"],
    ["ok", "ru"],
    ["когда", "ru"],
    ["theory", "en"],
  ])
    assert.equal(reply(q, page), -1, q);
});
test("Armenian question marks inside a word do not split it", () => {
  assert.equal(reply("Որտե՞ղ եք գտնվում", "hy"), 0);
  assert.equal(reply("Որքա՞ն արժե տեսությունը", "hy"), 4);
});
