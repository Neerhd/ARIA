export const GREETINGS = [
  "What's on your mind?",
  "Good evening",
  "Ready when you are",
  "How can I help?",
  "Let's get started",
  "What are we working on?",
  "Ask me anything",
  "What's the plan?",
  "Where should we begin?",
  "What should we explore?",
  "Good to see you",
  "What's next?",
  "Let's dig in",
  "What's today's challenge?",
  "I'm listening",
  "What brings you here?",
  "Let's think it through",
  "Tell me what you need",
  "Where do we start?",
  "Let's build something",
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
