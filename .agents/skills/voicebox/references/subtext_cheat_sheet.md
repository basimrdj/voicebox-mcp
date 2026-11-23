# VoiceBox Subtext & Acoustic Parameter Reference

This reference documents the acoustic, aerodynamic, and perceptual targets for VoiceBox's 7 nuanced subtexts and 12 glottal source parameters.

---

## 1. Subtext Parameter Matrix

| Parameter / Subtext | `passive_hostility` | `curiosity` | `sarcasm` | `exasperation` | `annoyance` | `anxiety` | `quiet_dejection` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Glottal $R_d$ Target** | 0.45 (pressed) | 0.95 (modal) | 0.85 (bimodal) | 1.80 (breathy) | 0.58 (pressed) | 0.85 (erratic) | 2.20 (hypo-adducted) |
| **Subglottal $P_s$ (cmH$_2$O)** | 13.0 | 9.2 | 9.8 | $14.0 \to 3.2$ | 12.2 | $9.0 \pm 1.8$ | 3.8 |
| **Vowel Nucleus Warping** | -25% (clipped) | +25% (phrase final) | +45% (tonic vowel) | Decay glide | -18% (clipped) | -12% (hurried) | Lax decay |
| **Pitch Contour** | Rigid Monotone (<1.5 st) | High-rising $L-H\%$ | High-peaked $!H^*$ | Falling $H^*L^-$ | Sharp falling $H+L^*$ | 8.5 Hz flutter | Flat downward drift |
| **Jaw Offset ($\Delta\text{jaw}$)** | -0.25 (clenched) | 0.0 (neutral) | +0.10 (relaxed) | +0.05 | -0.15 (tense) | -0.05 | -0.10 (slack) |
| **Vertical Larynx ($\Delta L$)** | +0.20 (elevated) | 0.0 | -0.20 (lowered) | -0.10 | +0.25 (elevated) | +0.15 | -0.30 (depressed) |
| **Micro-Glottal Stops** | Yes (raised-cosine) | No | No | No | Yes (pre-plosive) | No | No |
| **Aspiration Noise** | Minimum | Moderate | Moderate | High (sigh dump) | Low | Moderate | Dominant |

---

## 2. Intrinsic Laryngeal Muscle Mapping

The 7 subtext states translate into specific neurological innervation patterns of the intrinsic laryngeal muscles:

- **Cricothyroid (CT) [Superior Laryngeal Nerve]**:
  Tilts the thyroid cartilage forward, elongating the vocal fold cover and elevating pitch ($f_0$).
  *Hyperactive in*: `curiosity` (high-rising boundary), `anxiety` (pitch elevation).
  *Hypoactive in*: `quiet_dejection`, `exasperation`.

- **Thyroarytenoid (TA / Vocalis) [Recurrent Laryngeal Nerve]**:
  Shortens and thickens the vocal folds, stiffening the muscular body while slackening the cover.
  *Hyperactive in*: `annoyance`, `passive_hostility` (stiff body, high vocal effort).

- **Lateral Cricoarytenoid (LCA) [Recurrent Laryngeal Nerve]**:
  Medially compresses the membranous vocal folds, closing the glottal aperture.
  *Hyperactive in*: `passive_hostility`, `annoyance` (producing pressed phonation, $R_d < 0.55$).

- **Interarytenoid (IA) [Recurrent Laryngeal Nerve]**:
  Brings the posterior cartilaginous arytenoids together to eliminate posterior chink leakage.
  *Hyperactive in*: `passive_hostility`.
  *Hypoactive / Incomplete in*: `quiet_dejection`, `exasperation` (allowing breathy aspiration leakage).

- **Posterior Cricoarytenoid (PCA) [Recurrent Laryngeal Nerve]**:
  The sole abductor of the vocal folds. Pulls folds apart for breathing and sighs.
  *Active in*: `exasperation` (respiratory sigh dump), `perform_vocal_gesture("sigh")`.

---

## 3. Gunnar Fant LF Model Equations

Gunnar Fant's transformed waveshape parameter $R_d$:
$$R_d \approx \frac{1}{0.11} \left( \frac{U_0}{E_e} \frac{f_0}{110} \right)$$

Dimensionless timing ratios:
$$R_a = \frac{-1 + 4.8 R_d}{100}$$
$$R_k = \frac{22.4 + 11.8 R_d}{100}$$
$$R_g = \frac{1}{2 R_k} \left( \frac{R_d (1 + R_a)}{0.11} \right)^{-1}$$
$$O_q = \frac{1 + R_k}{2 R_g}$$

Differential flow derivative:
$$E(t) = \begin{cases}
E_0 e^{\alpha t} \sin(\omega_g t), & 0 \le t \le T_e \\
-\frac{E_e}{\epsilon T_a} \left[ e^{-\epsilon (t - T_e)} - e^{-\epsilon (T_c - T_e)} \right], & T_e < t \le T_c \\
0, & T_c < t \le T_0
\end{cases}$$
Constraint: $\int_0^{T_0} E(t) dt = 0$.
