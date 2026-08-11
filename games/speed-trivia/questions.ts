export type RawQuestion = {
  id: string;
  category: string;
  question: string;
  correctAnswer: string;
  incorrectAnswers: [string, string, string];
};

export type ActiveQuestion = {
  id: string;
  category: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
};

export const QUESTION_POOL: RawQuestion[] = [
  {
    id: "q1",
    category: "SCIENCE",
    question: "What is the chemical symbol for Gold?",
    correctAnswer: "Au",
    incorrectAnswers: ["Ag", "Fe", "Cu"],
  },
  {
    id: "q2",
    category: "SCIENCE",
    question: "Which planet is known as the Red Planet?",
    correctAnswer: "Mars",
    incorrectAnswers: ["Venus", "Jupiter", "Saturn"],
  },
  {
    id: "q3",
    category: "GEOGRAPHY",
    question: "What is the capital of Japan?",
    correctAnswer: "Tokyo",
    incorrectAnswers: ["Kyoto", "Osaka", "Seoul"],
  },
  {
    id: "q4",
    category: "GEOGRAPHY",
    question: "Which is the longest river in the world?",
    correctAnswer: "Nile",
    incorrectAnswers: ["Amazon", "Mississippi", "Yangtze"],
  },
  {
    id: "q5",
    category: "HISTORY",
    question: "In which year did World War II end?",
    correctAnswer: "1945",
    incorrectAnswers: ["1918", "1939", "1950"],
  },
  {
    id: "q6",
    category: "HISTORY",
    question: "Who was the first President of the United States?",
    correctAnswer: "George Washington",
    incorrectAnswers: ["Thomas Jefferson", "Abraham Lincoln", "John Adams"],
  },
  {
    id: "q7",
    category: "GENERAL",
    question: "How many sides does a heptagon have?",
    correctAnswer: "7",
    incorrectAnswers: ["6", "8", "9"],
  },
  {
    id: "q8",
    category: "GENERAL",
    question: "Which element makes up roughly 78% of Earth's atmosphere?",
    correctAnswer: "Nitrogen",
    incorrectAnswers: ["Oxygen", "Carbon Dioxide", "Argon"],
  },
  {
    id: "q9",
    category: "SCIENCE",
    question: "What speed does light travel in a vacuum?",
    correctAnswer: "299,792,458 m/s",
    incorrectAnswers: ["150,000,000 m/s", "3,000,000 m/s", "1,080,000 km/h"],
  },
  {
    id: "q10",
    category: "GEOGRAPHY",
    question: "Which country has the largest land area in the world?",
    correctAnswer: "Russia",
    incorrectAnswers: ["Canada", "China", "United States"],
  },
  {
    id: "q11",
    category: "HISTORY",
    question: "Which empire built the Colosseum in Rome?",
    correctAnswer: "Roman Empire",
    incorrectAnswers: ["Greek Empire", "Ottoman Empire", "Byzantine Empire"],
  },
  {
    id: "q12",
    category: "GENERAL",
    question: "What is the hardest natural substance on Earth?",
    correctAnswer: "Diamond",
    incorrectAnswers: ["Titanium", "Graphene", "Quartz"],
  },
  {
    id: "q13",
    category: "SCIENCE",
    question: "How many bones are in the adult human body?",
    correctAnswer: "206",
    incorrectAnswers: ["180", "214", "300"],
  },
  {
    id: "q14",
    category: "GEOGRAPHY",
    question: "What is the smallest continent by land area?",
    correctAnswer: "Australia",
    incorrectAnswers: ["Europe", "Antarctica", "South America"],
  },
  {
    id: "q15",
    category: "HISTORY",
    question: "Who painted the Mona Lisa?",
    correctAnswer: "Leonardo da Vinci",
    incorrectAnswers: ["Michelangelo", "Vincent van Gogh", "Pablo Picasso"],
  },
];
