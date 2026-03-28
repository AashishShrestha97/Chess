// frontend/src/hooks/useRatingChangeOnGameOver.ts
//
// Drop-in hook for both StandardChessPage and VoiceGamePage.
// Polls for a rating history entry up to MAX_ATTEMPTS times with
// exponential back-off so transient DB latency doesn't hide the popup.
//
// Usage:
//   const { ratingChange, clearRatingChange } = useRatingChangeOnGameOver(gameOver);
//
//   {ratingChange && (
//     <RatingChangePopup
//       change={ratingChange.change}
//       newRating={ratingChange.newRating}
//       onClose={clearRatingChange}
//     />
//   )}

import { useState, useEffect, useRef } from "react";
import { getMyRating, getMyRatingHistory } from "../api/ratings";

interface RatingChange {
  change: number;
  newRating: number;
}

const INITIAL_DELAY_MS = 3000;   // wait 3 s before first poll (give DB time to commit)
const MAX_ATTEMPTS     = 5;
const BACKOFF_FACTOR   = 1.5;    // each retry waits 1.5× longer than the previous

export function useRatingChangeOnGameOver(gameOver: boolean) {
  const [ratingChange, setRatingChange] = useState<RatingChange | null>(null);
  const attemptRef = useRef(0);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!gameOver) {
      // Reset when a new game starts
      attemptRef.current = 0;
      if (timerRef.current) clearTimeout(timerRef.current);
      setRatingChange(null);
      return;
    }

    attemptRef.current = 0;

    const poll = async (delayMs: number) => {
      timerRef.current = setTimeout(async () => {
        attemptRef.current += 1;

        try {
          const [ratingRes, historyRes] = await Promise.all([
            getMyRating(),
            getMyRatingHistory(),
          ]);

          const history = historyRes.data;

          if (history && history.length > 0) {
            // History is returned oldest-first after the reverse in RatingController.
            // The LAST entry is the most recent game.
            const lastEntry = history[history.length - 1];

            // Only show popup if there was an actual change
            if (Math.abs(lastEntry.change) > 0.01) {
              setRatingChange({
                change:    lastEntry.change,
                newRating: ratingRes.data.glickoRating,
              });
              return; // done
            }
          }

          // No entry found yet — retry if we haven't exceeded max attempts
          if (attemptRef.current < MAX_ATTEMPTS) {
            const nextDelay = delayMs * BACKOFF_FACTOR;
            console.log(
              `Rating not yet committed, retrying in ${Math.round(nextDelay)}ms ` +
              `(attempt ${attemptRef.current}/${MAX_ATTEMPTS})`
            );
            poll(nextDelay);
          } else {
            console.warn("Rating change not detected after max attempts — skipping popup");
          }
        } catch (err) {
          console.warn("Failed to fetch rating after game over:", err);
          if (attemptRef.current < MAX_ATTEMPTS) {
            poll(delayMs * BACKOFF_FACTOR);
          }
        }
      }, delayMs);
    };

    poll(INITIAL_DELAY_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [gameOver]);

  const clearRatingChange = () => setRatingChange(null);

  return { ratingChange, clearRatingChange };
}