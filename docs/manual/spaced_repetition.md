# Spaced Repetition

Spaced repetition is a learning technique where cards are reviewed at increasing intervals based on how well you remember them. Kioku uses the FSRS (Free Spaced Repetition Scheduler) algorithm to schedule reviews.

## Card States

Each card is in one of the following states:

- **New** — A card that has never been studied. It has no review history and is waiting for its first learning session.
- **Learning** — A card currently being learned for the first time. It goes through short learning steps (e.g. 1 minute, then 10 minutes) before graduating to a review card.
- **Review** — A card that has graduated from the learning phase. It is reviewed at increasingly longer intervals (days, weeks, months) as long as you keep remembering it.
- **Relearning** — A review card that you forgot (lapsed). It re-enters short learning steps, similar to the learning phase, before returning to the review schedule.

## Key Terminology

- **Lapse** — When you fail to recall a review card. The card moves from the Review state to the Relearning state. A high lapse count may indicate that a card is a "leech" and should be reformulated.
- **Interval** — The number of days between reviews for a card in the Review state.
- **Ease / Stability** — A factor that determines how quickly the interval grows. In FSRS, this is represented by the stability and difficulty parameters.
- **Graduation** — When a card in the Learning state completes all learning steps and becomes a Review card.
- **Leech** — A card that has lapsed many times. Leeches are typically cards that are poorly written or too difficult, and should be rewritten or broken into simpler cards.

## Review Ratings

When reviewing a card, you rate your recall:

- **Again** — You did not remember the card. If it was a Review card, this counts as a lapse.
- **Hard** — You recalled the card but with significant difficulty.
- **Good** — You recalled the card with acceptable effort.
- **Easy** — You recalled the card effortlessly.

## How It Works

1. New cards enter the **Learning** phase with short intervals.
2. After completing learning steps, cards **graduate** to the **Review** phase.
3. Each successful review increases the interval. The better your rating, the larger the increase.
4. If you forget a card (rate it **Again**), it **lapses** and enters **Relearning**.
5. After completing relearning steps, the card returns to **Review** with a reduced interval.
