export const GREETINGS = [
  "What's on your mind today?",
  "Good evening",
  "Ready when you are",
  "What can I help you figure out?",
  "Let's get started",
  "What are we working on today?",
  "Ask me anything",
  "How can I help?",
  "What's the plan for today?",
  "Where should we begin?",
  "What would you like to explore?",
  "Good to see you",
  "What's next on your list?",
  "Let's dig into something",
  "What's the challenge today?",
  "I'm listening",
  "What brings you here today?",
  "Let's think it through together",
  "What can I do for you?",
  "Pick up where you left off, or start something new",
];

/**
 * Shuffle-bag cycle: hands out every greeting once, in random order, before
 * reshuffling — guarantees variety across a session without the "same one
 * twice in a row" feel a pure random pick can produce.
 */
export function createGreetingCycle(list = GREETINGS) {
  let bag = [];

  const refill = () => {
    bag = [...list];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  };

  return () => {
    if (bag.length === 0) refill();
    return bag.pop();
  };
}
