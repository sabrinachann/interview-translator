// Cleaned from Peddlers Questionnaire.txt — conditional markers like "<If yes>"
// removed, blank answer fields (e.g. "$______", "Yes/No") dropped, and each
// remaining prompt turned into a standalone question in its original order.
let n = 0;
const q = (section, en) => ({ id: `q${++n}`, section, en });

// Fixed id (not part of the q1, q2… sequence) so inserting it at the front
// doesn't renumber every other question and invalidate existing translations
// or in-progress interviews' saved answers, which are keyed by question id.
const intro = { id: "q0", section: "Intro", en: "Morning! I'm interviewing scrap/waste collectors for some research — happy to grab you a coke if you can spare a few minutes for some questions." };

export const defaultQuestions = [
  intro,
  q("Profile", "How long have you been collecting scrap metal?"),
  q("Profile", "Is this the only work you do?"),
  q("Profile", "What other work do you do?"),
  q("Profile", "How many hours per day do you spend collecting?"),
  q("Profile", "What times of day do you collect scrap?"),
  q("Profile", "How long did it take you to collect the scrap you have with you today?"),
  q("Profile", "How much do you expect to earn today?"),
  q("Profile", "What other buyers do you sell to apart from scrap yards?"),
  q("Profile", "Why do you collect metal and not other waste?"),
  q("Profile", "Do you always come to the scrap yard at this time?"),
  q("Profile", "Why do you come at this time?"),
  q("Profile", "Do you only come when you have enough?"),
  q("Profile", "How many times a week do you drop off?"),

  q("Collection", "How do you find scrap metal?"),
  q("Collection", "Do you open trash bags, or only collect what you see from a distance?"),
  q("Collection", "Do you just check the curb, or do you look in other places too?"),
  q("Collection", "Do you know staff at any buildings who save stuff for you?"),
  q("Collection", "Do you pay them?"),
  q("Collection", "What do you collect the most of?"),
  q("Collection", "Is there anything you basically never pick up?"),
  q("Collection", "Why not?"),
  q("Collection", "About how many other people do you see out collecting on your usual route?"),
  q("Collection", "Do you mostly work the same blocks or buildings, or does it change day to day?"),
  q("Collection", "Is there stuff you usually grab but sometimes look at and leave? What makes you walk past it?"),
  q("Collection", "Are there specific days of the week or seasons when there's more metal?"),

  q("Sorting & processing", "Do you break down what you find into parts before selling?"),
  q("Sorting & processing", "Does anyone help you? Who?"),
  q("Sorting & processing", "Why do you break everything into parts before selling?"),
  q("Sorting & processing", "Do you presort the scrap into copper, brass, aluminum, and tin before coming to the scrap yard?"),

  q("Pricing", "For small items, do you get paid for it as-is, do you sell the parts, or does the yard not pay for it at all?"),
  q("Pricing", "How much do you usually get for a fridge?"),
  q("Pricing", "How much do you usually get for a microwave?"),
  q("Pricing", "How much do you usually get for a broken computer?"),
  q("Pricing", "How much do you usually get for cables or wire, per pound?"),

  q("Scrap yard", "How do you decide which scrap yard to go to?"),

  q("Legislation", "Is there any trash that you cannot take, like government-owned items?"),

  q("Wrap-up", "Can I stand in line with you to see how the scrap yard weighs and pays you for what you collected?"),
  q("Wrap-up", "Can you show me how you would take apart the scrap metal I have with me, for $10?"),
];

// Fixed, pre-set flag for the core questions to hit if time is short —
// not something the user can toggle in the app.
const IMPORTANT_QUESTIONS = new Set([
  "How long have you been collecting scrap metal?",
  "Is this the only work you do?",
  "What other work do you do?",
  "How many hours per day do you spend collecting?",
  "What times of day do you collect scrap?",
  "How long did it take you to collect the scrap you have with you today?",
  "How much do you expect to earn today?",
  "What other buyers do you sell to apart from scrap yards?",
  "How do you find scrap metal?",
  "Do you open trash bags, or only collect what you see from a distance?",
  "Do you just check the curb, or do you look in other places too?",
  "Do you know staff at any buildings who save stuff for you?",
  "Do you pay them?",
  "What do you collect the most of?",
  "Is there anything you basically never pick up?",
  "Why not?",
  "Is there stuff you usually grab but sometimes look at and leave? What makes you walk past it?",
  "Do you break down what you find into parts before selling?",
  "Does anyone help you? Who?",
  "Why do you break everything into parts before selling?",
  "Do you presort the scrap into copper, brass, aluminum, and tin before coming to the scrap yard?",
  "For small items, do you get paid for it as-is, do you sell the parts, or does the yard not pay for it at all?",
  "How much do you usually get for a fridge?",
  "How much do you usually get for a microwave?",
  "How much do you usually get for a broken computer?",
  "How much do you usually get for cables or wire, per pound?",
  "Can I stand in line with you to see how the scrap yard weighs and pays you for what you collected?",
  "Can you show me how you would take apart the scrap metal I have with me, for $10?",
]);

for (const question of defaultQuestions) {
  if (IMPORTANT_QUESTIONS.has(question.en)) question.important = true;
}

// Small gray "answer key" reference notes shown under each question in the app —
// static, not editable in the UI and not translated.
const QUESTION_NOTES = {
  "Is this the only work you do?": "Yes / No",
  "What times of day do you collect scrap?": "Morning / afternoon / night",
  "Do you always come to the scrap yard at this time?": "Yes / No",
  "Do you only come when you have enough?": "Yes / No",
  "How do you find scrap metal?":
    "Talk to building staff / collect from curbside or trash can / other",
  "Do you open trash bags, or only collect what you see from a distance?":
    "Open trash / see from distance",
  "Do you just check the curb, or do you look in other places too?":
    "Curb, loading docks, alleys, other",
  "Do you know staff at any buildings who save stuff for you?": "Supers, doormen, other",
  "Do you pay them?": "Yes / No",
  "What do you collect the most of?":
    "Large appliances (fridge, washer, HVAC) / small items (toasters, microwaves) / IT (computers, hard drives) / cable / other (cookware, batteries)",
  "Why not?": "Too heavy, no value, not worth the digging, other",
  "Is there stuff you usually grab but sometimes look at and leave? What makes you walk past it?":
    "Yes / No",
  "Are there specific days of the week or seasons when there's more metal?": "Yes / No",
  "Do you break down what you find into parts before selling?": "Yes / No",
  "Does anyone help you? Who?": "Yes / No",
  "Do you presort the scrap into copper, brass, aluminum, and tin before coming to the scrap yard?":
    "Yes / No",
  "For small items, do you get paid for it as-is, do you sell the parts, or does the yard not pay for it at all?":
    "Paid as-is / sell parts / not paid",
  "How do you decide which scrap yard to go to?":
    "Distance / metal prices / trust with a buyer / no ID required / cash on the spot / other",
  "Is there any trash that you cannot take, like government-owned items?": "Yes / No",
};

for (const question of defaultQuestions) {
  const note = QUESTION_NOTES[question.en];
  if (note) question.note = note;
}
