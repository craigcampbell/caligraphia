// The daily prompt: one nudge against the blank page, rotating by date.
// Deliberately small things — the point is to lower the cost of starting.

const PROMPTS = [
  "Write your favorite word in your very best hand.",
  "Draw what's outside the nearest window.",
  "Copy out one line of a song that's stuck in your head.",
  "Draw your breakfast, however humble.",
  "Write the alphabet — but let it get stranger as it goes.",
  "Sketch the oldest thing in the room.",
  "Write a weather report for exactly where you're sitting.",
  "Draw a map of your childhood street, from memory.",
  "Write 'hello' in as many ways as you can fit on the page.",
  "Draw the contents of your left pocket or bag.",
  "Copy a sentence from the nearest book, beautifully.",
  "Draw your mug or glass. Bonus: what's in it?",
  "Write the date as if it mattered very much.",
  "Sketch an animal you saw recently — embellishment encouraged.",
  "Write a tiny letter to yourself, ten years ago.",
  "Draw the view from a door you walk through daily.",
  "Practice the capital letters of someone you love's initials.",
  "Draw a plant. Real or invented.",
  "Write the word for 'rain' and let the letters get wet.",
  "Sketch your own hand, with the pen still in it.",
  "Write the menu of your ideal small dinner.",
  "Draw the moon as you imagine it tonight.",
  "Write a word you love in a language you don't speak.",
  "Draw the shoes you wore today.",
  "Write 'thank you' the way it deserves to be written.",
  "Sketch a building you can see, or wish you could.",
  "Write tomorrow's to-do list as if it were a poem's title page.",
  "Draw a fish. Any fish. The fish of your heart.",
  "Copy out a proverb your family says.",
  "Draw what tired feels like.",
  "Write your name the way you signed it at twelve.",
  "Sketch the inside of your fridge, honestly.",
  "Write one sentence about today, for a stranger to find.",
  "Draw a bird mid-thought.",
  "Practice a flourish until it stops obeying you.",
  "Draw the last thing that made you laugh.",
];

export function todaysPrompt(date: Date = new Date()): string {
  const day = Math.floor(date.getTime() / 86_400_000);
  return PROMPTS[day % PROMPTS.length];
}
