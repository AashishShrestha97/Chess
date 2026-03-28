// backend/.../service/Glicko2Service.java
package com.chess4everyone.backend.service;

import org.springframework.stereotype.Service;

/**
 * Mathematically correct Glicko-2 rating system implementation.
 *
 * Reference: Mark Glickman's original paper
 *   http://www.glicko.net/glicko/glicko2.pdf
 *
 * Internal scale: Glicko-2 works on a transformed μ/φ scale.
 * Public-facing numbers are converted back to the Glicko-1 (≈ ELO) scale
 * so players see familiar values like 1500, 1800 etc.
 *
 * Defaults:
 *   rating     = 1500   (μ = 0 on internal scale)
 *   RD         = 350    (φ = 350/173.7178 ≈ 2.015 on internal scale)
 *   volatility = 0.06
 */
@Service
public class Glicko2Service {

    // ── constants ─────────────────────────────────────────────────────────────

    /** Glicko scale conversion factor. */
    private static final double SCALE = 173.7178;

    /**
     * System constant τ — constrains volatility change per period.
     * Recommended range 0.3 – 1.2.  0.5 is a safe default for chess.
     */
    private static final double TAU = 0.5;

    /** Convergence tolerance for the Illinois / regula-falsi algorithm. */
    private static final double EPSILON = 0.000001;

    /** Default public rating. */
    public static final double DEFAULT_RATING     = 1500.0;
    /** Default rating deviation (RD). */
    public static final double DEFAULT_RD         = 350.0;
    /** Default volatility (σ). */
    public static final double DEFAULT_VOLATILITY = 0.06;

    // ── public DTO ────────────────────────────────────────────────────────────

    /**
     * Snapshot of one player's Glicko-2 state.
     * Immutable value object passed in and out of {@link #calculate}.
     */
    public record PlayerState(double rating, double rd, double volatility) {
        /** Convenience constructor using library defaults. */
        public static PlayerState defaultState() {
            return new PlayerState(DEFAULT_RATING, DEFAULT_RD, DEFAULT_VOLATILITY);
        }
    }

    /**
     * Result of a single game outcome as seen by the player whose rating
     * we are updating.
     *
     * @param opponentRating     public rating of the opponent
     * @param opponentRd         public RD of the opponent
     * @param score              1.0 = win, 0.5 = draw, 0.0 = loss
     */
    public record GameResult(double opponentRating, double opponentRd, double score) {}

    /**
     * Updated state after the rating period calculation.
     *
     * @param newRating     new public rating
     * @param newRd         new public RD
     * @param newVolatility new volatility
     * @param ratingChange  delta between new and old public rating (signed)
     */
    public record UpdatedState(
            double newRating,
            double newRd,
            double newVolatility,
            double ratingChange) {}

    // ── main calculation ──────────────────────────────────────────────────────

    /**
     * Full Glicko-2 update for a player given a list of game results
     * in the current rating period.
     *
     * If the player did not compete (empty results list) only RD is inflated
     * according to volatility.
     *
     * @param player  current state of the player
     * @param results list of game results in this period (may be empty)
     * @return updated player state
     */
    public UpdatedState calculate(PlayerState player, java.util.List<GameResult> results) {

        // Step 1: Convert to internal Glicko-2 scale
        double mu  = toMu(player.rating());
        double phi = toPhi(player.rd());
        double sigma = player.volatility();

        // Step 2: If no games played this period — only inflate RD
        if (results == null || results.isEmpty()) {
            double phiPrime = Math.sqrt(phi * phi + sigma * sigma);
            double newRd     = toPublicRd(phiPrime);
            return new UpdatedState(player.rating(), newRd, sigma,0.0);
        }

        // Step 3: Compute v (estimated variance of player's rating based on
        //                     game outcomes alone)
        double v = computeV(mu, results);

        // Step 4: Compute delta (estimated improvement in rating based on
        //                        comparison between expected and actual outcomes)
        double delta = computeDelta(mu, results, v);

        // Step 5: Update volatility σ' via Illinois algorithm
        double sigmaPrime = updateVolatility(phi, sigma, delta, v);

        // Step 6: Update RD to φ*
        double phiStar = Math.sqrt(phi * phi + sigmaPrime * sigmaPrime);

        // Step 7: Update φ' and μ'
        double phiPrime = 1.0 / Math.sqrt(1.0 / (phiStar * phiStar) + 1.0 / v);
        double muPrime  = mu + phiPrime * phiPrime * sumForMu(mu, results);

        // Step 8: Convert back to public scale
        double newRating     = toPublicRating(muPrime);
        double newRd         = toPublicRd(phiPrime);
        double ratingChange  = newRating - player.rating();

        return new UpdatedState(newRating, newRd, sigmaPrime, ratingChange);
    }

    /**
     * Convenience helper: update ratings for both players of a single game.
     *
     * @param white       white player's current state
     * @param black       black player's current state
     * @param whiteScore  1.0 win, 0.5 draw, 0.0 loss (from white's perspective)
     * @return two-element array [updatedWhite, updatedBlack]
     */
    public UpdatedState[] calculateMatch(
            PlayerState white,
            PlayerState black,
            double whiteScore) {

        double blackScore = 1.0 - whiteScore;

        GameResult whiteSeesBlack = new GameResult(black.rating(), black.rd(), whiteScore);
        GameResult blackSeesWhite = new GameResult(white.rating(), white.rd(), blackScore);

        UpdatedState updatedWhite = calculate(
                white,
                java.util.List.of(whiteSeesBlack));
        UpdatedState updatedBlack = calculate(
                black,
                java.util.List.of(blackSeesWhite));

        return new UpdatedState[]{ updatedWhite, updatedBlack };
    }

    // ── expected score ────────────────────────────────────────────────────────

    /**
     * Expected score for playerA against playerB.
     * Returns a probability in [0, 1].
     */
    public double expectedScore(PlayerState playerA, PlayerState playerB) {
        double muA  = toMu(playerA.rating());
        double phiB = toPhi(playerB.rd());
        double muB  = toMu(playerB.rating());
        double gPhiB = g(phiB);
        return E(muA, muB, gPhiB);
    }

    // ── internal math helpers ─────────────────────────────────────────────────

    /** g(φ) — reduction factor on opponent's impact. */
    private double g(double phi) {
        return 1.0 / Math.sqrt(1.0 + 3.0 * phi * phi / (Math.PI * Math.PI));
    }

    /** E(μ, μ_j, g(φ_j)) — expected outcome probability. */
    private double E(double mu, double muJ, double gPhiJ) {
        return 1.0 / (1.0 + Math.exp(-gPhiJ * (mu - muJ)));
    }

    /** v — estimated variance of rating based on outcomes. */
    private double computeV(double mu, java.util.List<GameResult> results) {
        double sum = 0.0;
        for (GameResult r : results) {
            double muJ    = toMu(r.opponentRating());
            double phiJ   = toPhi(r.opponentRd());
            double gPhiJ  = g(phiJ);
            double eScore = E(mu, muJ, gPhiJ);
            sum += gPhiJ * gPhiJ * eScore * (1.0 - eScore);
        }
        return 1.0 / sum;
    }

    /** Sum used for computing delta and μ'. */
    private double sumForMu(double mu, java.util.List<GameResult> results) {
        double sum = 0.0;
        for (GameResult r : results) {
            double muJ    = toMu(r.opponentRating());
            double phiJ   = toPhi(r.opponentRd());
            double gPhiJ  = g(phiJ);
            double eScore = E(mu, muJ, gPhiJ);
            sum += gPhiJ * (r.score() - eScore);
        }
        return sum;
    }

    /** δ — estimated rating improvement. */
    private double computeDelta(
            double mu,
            java.util.List<GameResult> results,
            double v) {
        return v * sumForMu(mu, results);
    }

    /**
     * Iteratively solve for new volatility σ' using the Illinois algorithm
     * (a bracket-based root finder, equivalent to the reference paper's
     * regula-falsi approach but numerically more stable).
     *
     * See Step 5 of Glickman (2012).
     */
    private double updateVolatility(
            double phi,
            double sigma,
            double delta,
            double v) {

        // Pre-compute constants used in f(x)
        double phi2    = phi * phi;
        double delta2  = delta * delta;
        double tau2    = TAU * TAU;
        double sigma2  = sigma * sigma;
        double lnSig2  = Math.log(sigma2);

        // f(x) function from the paper
        java.util.function.DoubleUnaryOperator f = x -> {
            double ex      = Math.exp(x);
            double phi2ex  = phi2 + v + ex;
            return (ex * (delta2 - phi2ex))
                    / (2.0 * phi2ex * phi2ex)
                    - (x - lnSig2) / tau2;
        };

        // Initialise the bracket [A, B]
        double A = lnSig2; // initial upper bound candidate

        double B;
        if (delta2 > phi2 + v) {
            B = Math.log(delta2 - phi2 - v);
        } else {
            // Descend until f(B) < 0
            int k = 1;
            while (f.applyAsDouble(lnSig2 - k * TAU) < 0) {
                k++;
            }
            B = lnSig2 - k * TAU;
        }

        // Illinois regula-falsi iteration
        double fA = f.applyAsDouble(A);
        double fB = f.applyAsDouble(B);

        while (Math.abs(B - A) > EPSILON) {
            double C  = A + (A - B) * fA / (fB - fA);
            double fC = f.applyAsDouble(C);

            if (fC * fB < 0) {
                A  = B;
                fA = fB;
            } else {
                fA /= 2.0;
            }
            B  = C;
            fB = fC;
        }

        return Math.exp(A / 2.0);
    }

    // ── scale conversions ─────────────────────────────────────────────────────

    /** Convert public rating r to internal μ. */
    private double toMu(double r) {
        return (r - 1500.0) / SCALE;
    }

    /** Convert public RD to internal φ. */
    private double toPhi(double rd) {
        return rd / SCALE;
    }

    /** Convert internal μ back to public rating. */
    private double toPublicRating(double mu) {
        return SCALE * mu + 1500.0;
    }

    /** Convert internal φ back to public RD. */
    private double toPublicRd(double phi) {
        return SCALE * phi;
    }
}