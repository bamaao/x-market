<!--
  Copyright (c) 2026 zouyc zouyccq@gmail.com.
  All rights reserved.

  Licensed under the Business Source License 1.1 (BSL 1.1).
  You may not use this file except in compliance with the License.

  Change Date: 2031-01-01
  On the Change Date, or the fourth anniversary of the first publicly available
  distribution of the code under the BSL, whichever comes first, the code
  automatically becomes available under the Apache License 2.0.
-->

**English** | [简体中文](./qa.zh.md)

# How to Introduce Options, Interval Pricing, and Volatility Models into Prediction Markets?

To truly introduce options, interval pricing, and volatility models into prediction markets, you must fundamentally overturn the existing "binary (Yes/No)" design architecture. The core shift in logic is: **stop tokenizing "event outcomes" and instead parameterize market-making on the "probability distribution function (PDF) of the underlying asset/event variable."**

This requires reconstruction across three dimensions: underlying asset definition, nonlinear automated market maker (AMM) algorithms, and quantitative volatility modeling. Below is the concrete implementation path:

---

## 1. Asset Layer: From "Binary Tokens" to "Continuous Underlyings and Benchmark Strikes"

Existing prediction markets turn questions like "Will BTC reach 100k by year-end?" into Yes/No tokens. To introduce options, the event variable itself (e.g., CPI data, GDP growth rate, election vote share) must be treated as a continuous underlying ($X$).

* **Build Continuous Interval Pricing:** Instead of splitting into independent pools, establish a unified strike ladder. For example, for "Fed rate cut magnitude," set $K_1 = 25\text{bps}$, $K_2 = 50\text{bps}$, $K_3 = 75\text{bps}$.
* **Diversified Payoff Structures:**
* **Digital Options:** Traditional Yes/No — receive $1 at settlement if the condition is met, otherwise $0.
* **Linear Options:** Settlement payoff is linearly related to the actual outcome. For example, a Call Option on "new film box office" with strike $K = 5\text{亿}$, final box office $X = 7\text{亿}$, settlement payoff is $\max(X - K, 0) = 2\text{亿}$ units of capital.



---

## 2. Trading Layer: Introducing Parametric AMM

Traditional Uni-v2 ($x \cdot y = k$) or concentrated liquidity (Uni-v3) cannot effectively express evolution in probability space. The best approach for introducing options and volatility is to develop a **Parametric AMM**.

### Core Mechanism

The AMM no longer records token quantities internally; instead it maintains a **probability density function (PDF)** describing predicted event outcomes, such as a Beta Distribution or Gaussian Distribution:

$$f(x \mid \mu, \sigma^2)$$

Here, $\mu$ represents the market's current **expected mean (Pricing)**, and $\sigma^2$ represents the market's **uncertainty/variance (Volatility)**.

* **Trading as Parameter Modification:** * When directional traders are bullish on the event outcome, they inject capital to buy exposure in higher intervals, pushing $\mu$ to the right.
* When traders believe "the market is deeply divided" or "major insider information is about to be released," they can buy straddle combinations (simultaneously buying high-strike Calls and low-strike Puts), which algorithmically directly pushes up $\sigma$ (i.e., implied volatility IV rises).


* **Auto-Generated Interval Pricing:** The price of any interval $[a, b]$ is obtained automatically by integrating the underlying PDF: $P(a \le X \le b) = \int_{a}^{b} f(x) dx$. This means **liquidity is globally shared and mathematically self-consistent across all strikes and intervals**, completely solving the liquidity fragmentation problem.

---

## 3. Volatility Layer: Building Event-Driven Volatility Surfaces

In traditional finance, volatility comes from time-series price movements of assets; in prediction markets, volatility comes from the **Information Arrival Process**.

* **Time Decay and Variance Collapse (Vol Crush):** Prediction markets have a hard endpoint (settlement date $T$). As time approaches $T$, uncertainty should converge. Quantitative models must incorporate time to maturity (Time to Maturity, $\tau = T - t$) into pricing. In a parametric AMM, as $\tau \to 0$, if no major new information arrives, $\sigma$ accelerates toward zero.
* **Extracting Implied Volatility:** Using the **Breeden-Litzenberger result**, we can reverse-engineer the market's implied risk-neutral density from option prices (or prediction prices across different intervals) at all strikes. Through cross-maturity (different expiry dates) and cross-strike pricing, a **prediction market volatility smile curve (Vol Smile)** can be fitted in real time on-chain.

---

## 4. Architectural Implementation: High-Performance On-Chain Derivatives Engine

To support the operation of this structured product suite, the underlying architecture must satisfy high-frequency mathematical computation and atomic settlement:

```
+-------------------------------------------------------------------+
|                     结构化产品层 (Structured Products)             |
|        (Straddles / Variance Swaps / Capital-Protected Notes)     |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                     参数化 AMM & 订单簿核心                        |
|       (State: Mu, Sigma | Math: Integrals & PDF Risk Engine)      |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                     预言机 & 结算层 (Oracle & Settlement)          |
|             (Continuous Data Feeds + Zero-Knowledge Settlement)  |
+-------------------------------------------------------------------+

```

1. **Cross-Margining:** Traders can use a single margin account to dynamically hedge positions across multiple strikes simultaneously. Since all intervals operate on the same PDF, overall account risk can be precisely calculated (VaR model), releasing extremely high capital efficiency.
2. **Dynamic Oracles and ZK Settlement:** Introduce high-frequency oracles capable of continuously feeding underlying numerical values. For complex long-tail events, use ZK-Oracle to prove real-world data states, ensuring continuous variables do not produce arbitration disputes at settlement.

---

### The Transformation It Brings

Once this architecture is deployed, prediction markets will complete their metamorphosis:
Quantitative funds can use **Variance Swaps** to purely bet on market panic during election debate nights, while multinational enterprises facing massive geopolitical risk can customize precise risk hedging through tailored **Structured Notes**.

In this parametric market-making and continuous full-strike architecture, which engineering or economics bottleneck do you think is hardest to overcome — the performance overhead of high-frequency on-chain integral computation, or the model distortion risk under extremely extreme events (such as black swan liquidity drought)?

# Probability Distribution Functions and Parametric AMM — A Deeper Dive for Easier Understanding

We can think of these two concepts as the "digital engine" of modern prediction markets. To understand them, we need to shift our thinking from traditional "black or white (betting on coin flips)" to "continuous spectrum (predicting rainfall in millimeters)."

Let's break them down more thoroughly and intuitively:

---

## I. Probability Density Function (PDF): Pricing Everything with "One Curve"

In traditional Polymarket, to predict "next month's CPI (inflation rate)," the platform has to open dozens of different markets:

* Market A: Will CPI be 2.5%? (Yes/No)
* Market B: Will CPI be 2.6%? (Yes/No)

This causes capital to be severely fragmented. The Probability Density Function (PDF) approach is: **open just one pool, using one mathematical curve to encompass all possible outcomes.**

The most commonly used model is the Gaussian (normal distribution) curve:

$$f(x) = \frac{1}{\sigma \sqrt{2\pi}} e^{-\frac{1}{2}\left(\frac{x-\mu}{\sigma}\right)^2}$$

Don't be intimidated by the formula — in prediction markets, traders and market makers really only need to turn two "knobs":

1. **Knob $\mu$ (mean/expected value):** Represents the outcome the market currently believes is **most likely to occur** — i.e., the x-coordinate of the curve's peak.
2. **Knob $\sigma$ (standard deviation/volatility):** Represents the market's **degree of uncertainty** about this prediction. The larger $\sigma$, the shorter and wider the curve (everyone disagrees, anything is possible); the smaller $\sigma$, the taller and narrower the curve (everyone is highly aligned).

### How Does It Achieve "Interval Pricing"?

In this system, the probability of any "interval prediction" is the **area** under the curve in the corresponding region. The total area under the entire curve always equals $1$ (i.e., $100\%$ probability).

* **Buy "2.5% to 2.7%":** The system automatically computes the integral (area) of the curve over this interval. If the area is 0.3, the fair price for this interval is 0.3 dollars.
* **Buy "greater than 3.0%":** The system computes the area from 3.0 extending right to positive infinity.

---

## II. Parametric AMM: A "Mixing Console" Without Tokens

The core of traditional automated market makers (like Uniswap v2) is $x \cdot y = k$ — the pool must physically hold $x$ and $y$ tokens.

Parametric AMM overturns this: **the pool doesn't need to hold any event tokens (like Yes-Token); its only inventory is the mathematical model composed of $\mu$ and $\sigma$. Users deposit stablecoins (like USDC) and take away a "payout promise."**

We can imagine a parametric AMM as an intelligent mixing console. Its workflow is as follows:

| Dimension | Traditional Constant Product AMM ($x \cdot y = k$) | Parametric AMM |
| --- | --- | --- |
| **Pool State** | Token $X$ has 100 units, Token $Y$ has 200 units | $\mu = 2.5\%$, $\sigma = 0.4$, capital pool = $10,000 |
| **User Trading Behavior** | "I exchange $X$ for $Y$" | "I put in $100, betting the outcome is higher than $\mu$ (going long)" |
| **Pool Price Response** | Reduce $Y$ quantity, increase $X$ quantity, making $Y$ more expensive | **No token quantity changes — directly modify parameters.** Adjust $\mu$ from 2.5% up to 2.6% |

### How Do Trades Change the Curve Shape?

* **Directional Trade $\to$ changes $\mu$:**
If a large sum buys "CPI will be above 2.5%," the Parametric AMM pricing formula immediately responds: **shift the curve peak $\mu$ to the right** (e.g., to 2.6%). At this point, all intervals above 2.6% automatically rise in price, while intervals below 2.6% automatically fall.
* **Volatility Trade $\to$ changes $\sigma$:**
If rumors suddenly spread that the Fed is deeply divided internally, traders start frantically buying "polarized" intervals (buying both extremely high and extremely low — a straddle in options).
After sensing this two-sided buying pressure, the Parametric AMM **increases $\sigma$ (volatility)**. The entire curve is instantly "flattened" and "widened." This means the probability (area) of extreme events at both ends grows larger and prices rise, while prices for moderate middle outcomes fall.

---

## III. A Smooth Trading Panorama Example

Suppose we want to predict "the real TPS on day one of a new public chain launch":

1. **Initial State:** The parametric AMM sets initial parameters $\mu = 5000$, $\sigma = 1000$. The system calculates that the probability of "TPS between 4000 and 6000" is $68\%$. If you want to buy this interval, the cost is 0.68 dollars.
2. **Bombshell Tweet:** The core developer tweets hinting that performance tests far exceeded expectations.
3. **Smart Money Enters:** Whale A enters, pouring 50,000 USDC to subscribe to a "TPS greater than 7000" position.
4. **AMM Parameter Shift:** The parametric AMM doesn't high-frequency match hundreds of orders like traditional mechanisms — it directly **reshapes the curve** at the underlying layer through algorithms: correcting $\mu$ to $6500$, and because uncertainty increased, correcting $\sigma$ to $1500$.
5. **Global Pricing Refresh:** Once the curve changes, option prices for all other strikes on-chain (e.g., 3000, 8000) and any interval (e.g., 5500-6000) **complete atomic automatic repricing within a single transaction**.

---

### Summary

* **Probability Density Function (PDF)** solves "how to express the underlying" — it turns scattered events into a continuous, integrable mathematical curve.
* **Parametric AMM** solves "how to aggregate liquidity" — traders are no longer exchanging tokens with each other, but collectively "shaping" this curve through their trading behavior.

Under this architecture, capital efficiency improves geometrically. If you want to design a "capital-protected structured wealth management" product in such an ecosystem (e.g., retail deposits $100, 80 goes to PoS stable yield, 20 is used in this parametric AMM to buy tail high-multiplier options on "rate cut magnitude exceeding expectations"), do you think the top technical priority is designing dynamic margin settlement mechanisms, or preventing off-chain oracle manipulation from instantly "maliciously reshaping" the curve?

# What About Events Like Football Match Goal Counts That Don't Fit a Normal Distribution?

Your observation is very sharp. Indeed, **football match goal counts (0, 1, 2, 3...) are typical "discrete non-negative integers" — they don't fit a normal distribution, and aren't even continuous functions.** Using a normal (Gaussian) distribution to describe goal counts is model distortion caused by "dimensional reduction."

For such events, the parametric AMM needs to switch to **"discrete distribution models" in probability statistics.** Below is the optimization approach for football goal counts:

---

### 1. Replace the Underlying Model: From Gaussian to Poisson

In financial engineering, the standard tool for describing "the number of times an event occurs within a fixed time period" is the **Poisson Distribution**, not the normal distribution.

* **Why Poisson?** Goal counts are only non-negative integers $0, 1, 2, 3, \dots$, and exhibit "sparsity" (most matches have 1-3 goals; scoring 10 is extremely unlikely).
* **Parametric Adjustment:** The Poisson distribution needs only one parameter $\lambda$ (Lambda).
* $\lambda$ represents the **expected goal count** for that match.
* If we set $\lambda$ to $2.5$, the formula automatically calculates: the probability of 0 goals, 1 goal, 3+ goals, and so on.



### 2. "Parametric" Logic for Discrete Events

In a parametric AMM, we no longer "bend" a normal distribution curve — instead we **dynamically adjust the Poisson distribution's $\lambda$ parameter**:

* **Trading Behavior:** When large capital buys "total goals greater than 3.5," the AMM doesn't match orders like token trading — it **adjusts $\lambda$ upward**.
* **Automatic Pricing:** Once $\lambda$ is raised from $2.5$ to $3.0$, the system automatically updates the odds for every specific scoreline (0-0, 1-0, 1-1...) via the Poisson formula.
* You'll find: the "over" odds for 3.5+ goals automatically drop, while the "0-0 scoreline" odds automatically rise.



### 3. How to Handle "Structure" and "Volatility"?

For discrete events like football, quantitative trading approaches change:

* **Volatility Concept Reframed:** In the Poisson distribution, volatility isn't $\sigma$ (standard deviation) but "dispersion" **or** an "uncertainty parameter." If both teams are evenly matched but play aggressively (e.g., Liverpool vs. Manchester City), the market expects higher "uncertainty" — the model can introduce an "over-dispersion parameter" to fatten the tail of the probability curve (e.g., 5+ goals in a single match) to accommodate extreme scenarios.
* **Interval Pricing Evolution:** Since outcomes are discrete, we can set "buckets" for $N$ goal counts:
* Bucket A: [0, 1] goals
* Bucket B: [2, 3] goals
* Bucket C: [4+] goals
* By adjusting the Poisson distribution shape, the AMM automatically ensures the sum of probabilities across all three buckets always equals 1, and traders can arbitrage between any buckets.



---

### 4. Why Does This Bring "Serious Capital" On-Chain?

Current sports betting platforms (like Bet365) are essentially **bookmakers vs. retail** — bookmakers profit by taking the "margin (vig)." In this model, large capital wanting to arbitrage at scale gets "limited" or even banned.

**A "Poisson-parameter-based AMM" provides a true liquidity pool:**

1. **Clear Arbitrage Opportunities:** If the current model sets $\lambda$ at $2.5$, but a quantitative model based on player injuries and weather analysis believes the true expectation should be $3.0$, quant funds can directly buy "over" in this AMM pool to correct parameters and earn from pricing deviation.
2. **Risk Hedging:** Institutions can package these Poisson-based "goal count derivatives." For example: build a "hedging kit" — buy "high goal count" in the prediction market while simultaneously shorting corresponding volatility in traditional on-chain derivatives markets.

---

### Summary: Architectural Ascension

If we compare prediction markets to a "probability casino":

* **Low-tier approach:** Make every outcome (0 goals, 1 goal...) a Token for people to bet on — that's "gambling."
* **High-tier approach:** Abstract a football match as a **Poisson random variable $X \sim \text{Poisson}(\lambda)$**, letting market participants collectively determine $\lambda$'s value. That's "financial derivatives."

**At this point, the core engineering challenge is:** How to efficiently implement Poisson distribution computation on-chain (since it involves factorial and exponential calculations, Gas costs are high). To achieve this, do you think **ZK-Rollup precomputed tables (Look-up Tables)** to reduce on-chain compute, or **oracles computing $\lambda$ off-chain and anchoring it on-chain via signatures** is better?

# How Is the PDF for a Prediction Event Obtained?

In prediction markets, "obtaining" a probability density function (PDF) is essentially **converting "trader consensus" into a "mathematical curve" through market bidding.**

This isn't something the system "pulls out of thin air" — it's computed and updated in real time by the parametric market-making algorithm (Parametric AMM) with every trade. Below are the three core steps for obtaining a PDF:

---

### Step One: Define the Underlying Mathematical Model (Select a Probability Model)

The system first presets a "shape template" based on event characteristics. As we discussed earlier:

* **Continuous variables (e.g., inflation rate, temperature):** The system uses a **Gaussian Distribution (Normal Distribution)**.
* **Discrete counts (e.g., football scores, ticket counts):** The system uses a **Poisson Distribution**.
* **Bounded intervals (e.g., exam pass rate 0%-100%):** The system uses a **Beta Distribution**.

These models all have corresponding mathematical formulas containing 1 to 2 core parameters (e.g., Gaussian $\mu, \sigma$ or Poisson $\lambda$). **Our goal is to find this set of parameters.**

---

### Step Two: Market Trading Triggers "Parameter Repricing"

In a parametric AMM, the system is no longer simply $x \cdot y = k$ — it maintains a "state vector" (those parameters).

1. **User Buys:** Suppose a user believes "there will be many goals tonight" and buys a contract on "total goals $> 3$."
2. **Pricing Engine Calculation:** The system doesn't need to change specific contract prices — it uses gradient descent **or** maximum likelihood estimation (MLE) logic to calculate "what $\lambda$ parameter adjustment is needed to satisfy this buy order."
3. **State Update:** The system updates $\lambda$ from 2.5 to 2.8.

At this point, the PDF curve immediately changes shape (shifts right or widens), and the system automatically recalculates the current market value of all contracts in that market (0 goals, 1 goal, 2 goals...) based on the new parameter $\lambda=2.8$.

---

### Step Three: Reverse-Engineer from Market Prices (Breeden-Litzenberger Logic)

This is the most hardcore step. When enough strike prices are traded in the market, we don't need to assume any distribution — we can directly "reverse-derive" the PDF.

According to the **Breeden-Litzenberger theorem** in finance, the second derivative of option prices is the risk-neutral probability density function:

$$f(x) = e^{rT} \cdot \frac{\partial^2 C}{\partial K^2}$$

* **$C$ (Call Price):** Call option prices at different strike prices.
* **$K$ (Strike Price):** Strike price.
* **$f(x)$:** The probability density function we want.

**Simply put:** If the market prices options at strike 10 and strike 11 differently, the system can compute the slope change (second derivative) between these two prices to **draw a segment of the PDF curve**.

---

### Summary: Closed-Loop Process

Obtaining a PDF is actually a cycle of "market pricing $\to$ statistical inversion $\to$ curve correction":

1. **Initial State:** The model sets an initial PDF (e.g., a Poisson distribution with $\lambda=2.5$).
2. **Trading Input:** Traders buy/sell contracts across different intervals based on personal views.
3. **Computation Center:** The system aggregates all order flow in real time, using the formulas above to fit discrete order information into a smooth mathematical curve.
4. **Real-Time Output:** That curve is the market's current "consensus distribution" on event outcomes.

### Food for Thought:

If you want to build such a system from scratch, **"parametric models" are the best starting point.** They have the lowest liquidity requirements — even with only one person trading, the system can derive a complete probability curve from the model.

In actual engineering, do you think directly fitting curves from trading orders (statistical method) **is more robust, or** adjusting parameters based on parametric models (control theory method) is easier for preventing market manipulation?

# Then Who Sets the Shape Template for Football Win-Draw-Lose?

For **football win-draw-lose (1X2)** — a typical **discrete, finite, and unordered** categorical event — we cannot use Poisson or Gaussian distributions. These distributions assume a "numerical magnitude" or "ordering" relationship between outcomes (e.g., 3 goals is greater than 2 goals), while Win, Draw, and Lose are mathematically **mutually independent categorical variables** with no linear logic of one being "greater" than another.

In this case, the "shape template" for such events typically uses a **Multinomial Distribution** or the more engineering-oriented **Dirichlet Distribution**.

---

### 1. Core Shape Template: Dirichlet Distribution

This is the perfect mathematical tool for handling "mutually exclusive categorical probabilities" — it describes: **the probability distribution of each option occurring among multiple mutually exclusive choices.**

For Win (W), Draw (D), Lose (L), we maintain a parameter vector $\boldsymbol{\alpha} = (\alpha_W, \alpha_D, \alpha_L)$.

* Each $\alpha$ represents the "strength" of that outcome.
* Final probabilities $p$ for each outcome are obtained by normalizing $\alpha$:

$$p_W = \frac{\alpha_W}{\alpha_W + \alpha_D + \alpha_L}, \quad p_D = \frac{\alpha_D}{\alpha_W + \alpha_D + \alpha_L}, \quad p_L = \frac{\alpha_L}{\alpha_W + \alpha_D + \alpha_L}$$



---

### 2. How Does It Act as a "Mixing Console"?

In a parametric AMM, when you trade "Win," you're actually injecting capital into the $\alpha_W$ parameter:

* **Initial State:** The system considers both teams evenly matched, $\boldsymbol{\alpha} = (10, 10, 10)$, i.e., win-draw-lose each at $1/3$ probability.
* **Trade Occurs:** A large player bets on "Win," injecting capital.
* **Parameter Update:** The system updates parameters to $\boldsymbol{\alpha} = (20, 10, 10)$.
* **Automatic Repricing:** The system automatically calculates new probabilities:
* $p_W = 20 / 40 = 0.5$
* $p_D = 10 / 40 = 0.25$
* $p_L = 10 / 40 = 0.25$
* **The entire market's odds refresh within milliseconds.**



---

### 3. How to Handle "Uncertainty" (Volatility)?

You might ask: how is "volatility" expressed in win-draw-lose? In the Dirichlet model, volatility is determined by the **sum of parameters** (i.e., the concentration parameter):

* **Larger $\sum \alpha$:** The curve is more "sharp" — market confidence is higher, prices are harder to move with a single trade (deep liquidity).
* **Smaller $\sum \alpha$:** The curve is more "flat" — market disagreement is huge or it's an upset match; any small capital inflow causes violent odds swings (high volatility).

---

### 4. Why Is This Better Than Traditional "Vig" Betting?

Traditional bookmakers use "house logic" — they profit by depressing odds to capture margin.

Dirichlet-parameter-based AMM uses "protocol logic":

1. **Risk-Free Arbitrage:** If a bookmaker's implied probabilities are $(0.5, 0.25, 0.25)$, but your quantitative model based on big data analysis believes the win rate should be $0.6$, you directly buy "Win" in the AMM — your capital automatically pushes $p_W$ toward $0.6$.
2. **Pricing Power Equality:** Every participant is "collectively building" this probability distribution. No bookmaker bans — only the market continuously correcting itself.
3. **Derivatives Linkage:** These win-draw-lose probabilities $(p_W, p_D, p_L)$ can further serve as underlying assets for "compound options." For example, you can design a product: "if the home team wins AND total goals $> 2.5$" — this is essentially a **joint probability calculation** of two Dirichlet distributions.

---

### Summary: Your "Shape Template" Library

If you're writing code to implement this, your template library should look like this:

| Event Type | Recommended Math Template | Parameter Meaning |
| --- | --- | --- |
| **Numerical intervals (e.g., temperature, inflation)** | Gaussian Distribution (Normal) | $\mu$ (location), $\sigma$ (dispersion) |
| **Occurrence frequency (e.g., goal count)** | Poisson Distribution | $\lambda$ (expected frequency) |
| **Categorical choice (e.g., win-draw-lose, who gets elected)** | Dirichlet Distribution | $\alpha_1, \alpha_2, \alpha_3$ (strength per option) |

**Thought Exercise:** For composite predictions like football matches containing both win-draw-lose categorical outcomes (Dirichlet) and total goal count numerical outcomes (Poisson), do you prefer establishing a separate AMM pool for each dimension, or unifying them in one pool through a high-dimensional joint probability distribution? The latter is extremely smooth but causes computational complexity to grow exponentially — what's your view?

# The Core Engineering Challenge: How to Efficiently Implement Poisson Distribution Computation On-Chain (Since It Involves Factorial and Exponential Calculations, Gas Costs Are High). To Achieve This, Do You Think ZK-Rollup Precomputed Tables (Look-up Tables) to Reduce On-Chain Compute, or Oracles Computing $\lambda$ Off-Chain and Anchoring It On-Chain via Signatures Is Better? What's Your Recommended Approach?

In blockchain infrastructure architecture design, facing nonlinear higher-order mathematical computations (like Poisson distribution, Gaussian integrals), simply choosing Option A (pure ZK-Rollup) or Option B (pure Oracle signatures) will trap the system in different engineering pitfalls: **ZK gets you stuck on "latency," while pure Oracle signatures will kill you with "toxic flow & MEV arbitrage."**

As a system architect, before deploying heavy weapons (ZK or Oracle), we need to do the most important thing first: **deconstruct the mathematical boundaries of the business, then deliver a tiered production solution.**

---

## I. Why Do Pure A or B Both Have Fatal Flaws?

### Option A: ZK-Rollup + Precomputed Tables (Look-up Tables)

* **Fatal Flaw:** **Proving Latency and asynchronous experience.**
* **Analysis:** Although by 2026, ZK lookup table performance based on next-generation proof systems like Lasso/Jolt has made qualitative leaps, generating a ZK proof for a state change still takes seconds or longer. For a high-frequency parametric AMM, after a user buys, the pool's $\lambda$ parameter must **update atomically within the current block** — otherwise the next user will arbitrage risk-free against stale prices. Making users wait seconds for ZK proof generation before completing a trade is unacceptable in terms of experience.

### Option B: Oracle Off-Chain $\lambda$ Computation + Signature Anchoring

* **Fatal Flaw:** **Oracle front-running and trust fragmentation.**
* **Analysis:** This model essentially degrades the AMM to a "settlement clearing channel." If there's a 500ms delay between the off-chain compute node receiving real-time match data and signing on-chain, skilled quant sandwich bots (MEV Bots) can read the underlying data source directly and send front-running transactions to the chain before the oracle updates $\lambda$, instantly draining the pool's liquidity.

---

## II. The Breakthrough: Re-examining Football's "Mathematical Boundaries"

Let's revisit the Poisson distribution formula for football goal counts:

$$P(X=k) = \frac{\lambda^k e^{-\lambda}}{k!}$$

When implementing on-chain engineering, you'll discover two huge engineering dividends (Boundary Conditions):

1. **$k!$ (factorial) is highly bounded:** A single team's goals in a football match rarely exceed 10. This means we don't need to compute factorials on-chain at all — just hardcode a static read-only array of size 15 in the smart contract (Array Look-up), with $O(1)$ query complexity and negligible Gas consumption.
2. **$\lambda$ is also highly convergent:** Expected goal counts $\lambda$ for football matches typically stay strictly within $[0, 8]$.

Since both independent and dependent variables live in a tiny bounded space, **deploying ZK or heavy off-chain oracles for football goal counts is typical over-engineering.**

---

## III. Final Recommendation: Tiered Computation Architecture

To balance **decentralized trust, ultra-low latency, and minimal Gas overhead**, we recommend the following tiered deployment strategy:

### Tier 1: Lightweight/Discrete Events (e.g., football win-draw-lose, goal counts)

**Use "Native Fixed-Point Approximation On-Chain"**

No off-chain middleware needed — directly implement on-chain (e.g., Solana Anchor or Sui Move) using fixed-point arithmetic (e.g., `I64F64` or `U128` precision):

* **Factorial part:** Use on-chain static array lookup tables.
* **Exponential part $e^{-\lambda}$:** Since $\lambda \le 8$, directly use Taylor Series Expansion for on-chain approximation.

$$\sum_{n=0}^{N} \frac{(-1)^n \lambda^n}{n!}$$

Under fixed precision, looping 7 to 8 iterations achieves financial-grade precision up to $10^{-9}$. On high-performance public chains, the compute from these bit shifts and multiplications consumes even less than a single cross-contract call's Gas. **This guarantees complete atomicity, zero latency, and 100% on-chain verifiability.**

### Tier 2: Complex/Continuous/High-Dimensional Events (e.g., macro data, multi-variable volatility surfaces)

If the system later upgrades to complex PDFs that can't be simply fitted with Taylor series (e.g., multi-dimensional Gaussian distributions), switch to an "optimistic execution + asynchronous zero-knowledge coprocessor verification" architecture:

```
[交易阶段 - 毫秒级]
用户交易 -> 链上 AMM (基于链下计算的参数 乐观执行变价) -> 状态立刻变更 

                               | (异步触发)
                               v

[验证阶段 - 窗口期内]
ZK Coprocessor (如 Axiom / Brevis) -> 链下抓取该区块的交易流 
  -> 生成完全自洽的 PDF 积分 ZK 证明 
  -> 异步提交至链上验证 
  -> (若链下计算作恶导致参数偏离 > ε) -> 触发 Slash 机制，回滚或补偿资金池

```

### Summary of Architectural Advantages:

1. **High-Frequency Path (Trading Path) is extremely fast:** Mainstream events like football are all completed atomically on-chain through the fixed-point math engine, with no external dependencies, eliminating oracle sandwich risk.
2. **Long-Tail Path (Generalized Path) is extremely stable:** For complex financial models, ZK isn't placed on the trading pipeline but on the asynchronous supervision line. ZK acts as the "Supreme Court," optimistic mechanisms as the "enforcement agency" — perfectly resolving the blockchain "impossible triangle" conflict in financial derivatives pricing.

# Parametric AMM — How Is Initial Liquidity Injected?

In parametric AMM architecture, initial liquidity injection logic is fundamentally different from traditional AMMs like Uniswap.

Traditional AMMs inject "asset pairs" (e.g., preparing equal-value BTC and USDT); parametric AMMs inject **"single-sided settlement assets (like USDC) + a set of prior probability parameters (Prior Parameters)."**

In other words, LPs (liquidity providers) here don't play the role of "token exchangers" but of **"probability distribution underwriters."**

---

## 1. Three-Step Initial Injection Process

Suppose we're creating a parametric AMM pool for an event (e.g., "next month's core CPI data"). Initial injection includes these three steps:

### Step One: Set Prior Parameters (The Priors)

The pool creator (could be the first LP or the protocol) must specify the model's initial parameters.

* For a Gaussian model, specify $\mu_0 = 2.5\%$ (expected mean), $\sigma_0 = 0.5$ (initial standard deviation).
* For a football win-draw-lose Dirichlet model, specify $\boldsymbol{\alpha}_0 = (10, 10, 10)$.
These numbers directly lock in the market's **initial prices (or odds)**.

### Step Two: Deposit Single Settlement Asset (USDC) as Collateral

LPs don't need any event tokens — they only deposit a primary asset (e.g., 100,000 USDC) into the smart contract's Vault.
This money is called the **"Collateral Buffer."** Its purpose: when the market outcome is revealed, pay out traders who were correct at exercise.

### Step Three: Define "Liquidity Multiplier" and Mint LP Tokens

The deposited amount determines the pool's **"Depth."** In the mathematical model, capital amount converts to a **global scaling factor (Scaling Factor $C$)**.
The system mints and distributes LP Tokens to the LP based on the current Vault's net asset value (NAV).

---

## 2. Core Mathematical Magic: How Does Liquidity Injection Affect the Curve?

This is the most elegant part of system architecture: **injecting or withdrawing liquidity only changes the curve's "rigidity (Price Impact Resilience)" — not the current "price (Probability)."**

Let's use the football win-draw-lose Dirichlet model $\boldsymbol{\alpha} = (\alpha_W, \alpha_D, \alpha_L)$ as an example:

### Scenario A: Initial Injection

The first LP sets $\boldsymbol{\alpha} = (10, 10, 10)$ and deposits 10,000 USDC.
At this point, win-draw-lose probabilities are equal (each $33.3\%$). If a trader uses 1,000 USDC to buy "Win," since the pool is shallow (values only 10), $\alpha_W$ gets instantly pushed up, producing huge slippage.

### Scenario B: Large Capital Mid-Way LP Injection

The market has been running for a while; after trading, parameters became $\boldsymbol{\alpha} = (20, 10, 10)$ (win probability pushed to $50\%$).
Now a second LP wants to add 30,000 USDC of liquidity.

To ensure **"providing liquidity doesn't affect current market prices,"** the parametric AMM's underlying algorithm executes **global scaling**:

The system calculates that the additional capital can scale the pool 3x overall, so the parameter matrix becomes:

$$\boldsymbol{\alpha}_{\text{new}} = 3 \times (20, 10, 10) = (60, 30, 30)$$

* **Price unchanged:** Win probability remains $\frac{60}{60+30+30} = 50\%$.
* **Depth thickened:** If another trader uses 1,000 USDC to buy "Win," since the base is now 60, the curve movement (price change) is greatly reduced.

---

## 3. How Do LPs Make and Lose Money? (Risk Model)

Without traditional impermanent loss (IL), parametric AMM LPs face **completely different risk exposure**:

### Losing Scenario: Adverse Selection

If the LP's initial parameters $\mu_0$ or $\boldsymbol{\alpha}_0$ are wildly off (e.g., setting Real Madrid vs. a lower-league team's win rate at $10\%$), the moment the system opens, quant arbitrageurs (Informed Traders) will frantically buy "Win."
They pay a low premium and exchange for high "payout promises" from the AMM. If Real Madrid ultimately wins, USDC in the Vault gets withdrawn by traders — the LP suffers real losses (similar to an insurance company being wiped out).

### Earning Scenario: Time Value Decay and Delta-Neutral Arbitrage

1. **Volatility Premium (Vol Premium):** Every retail trader in a parametric AMM pays the "bid-ask spread" generated by the model's built-in slippage formula. These spreads continuously flow into the Vault, pushing up LP Token NAV.
2. **Variance Convergence:** If the market ends smoothly without extreme black swans, as expiry approaches and probabilities converge, the LP effectively earns the option seller's **time value (Theta)**.

---

### Engineering Safety Design

When writing such smart contracts (e.g., using Rust/Move), since LPs bear absolute settlement risk, the Vault must have **"Max Loss Bounded Checking"**:

Whenever a trader attempts a trade, the Parametric AMM must atomically compute on-chain: **"Under the most extreme single-point event outcome, will total system payout exceed the current Vault's total assets?"** If yes, the contract must forcibly reject the trade (Slippage Reject), absolutely preventing pool blow-up and insolvency.

From a tokenomics perspective, while this "single-sided underwriting injection" model is clean, it demands extremely high LP expertise (wrong parameters get arbitraged). Do you think during cold start, we should introduce a **decentralized market maker (DMM) dynamically correcting initial Prior parameters via oracle**, or an optimistic two-sided auction period (Opening Auction) letting the market "discover" initial parameters itself for safety?

# What's Your Recommendation?

From a system architecture and risk control engineering perspective, I unhesitatingly recommend: **use an "Opening Auction" as the cold-start foundation, supplemented by an "algorithmic smooth transition" mechanism.**

In derivatives and parametric market-making system design, "not pinning system safety on off-chain oracle real-time performance" is an extremely important principle.

---

## Why Reject Pure "DMM + Oracle" Approach?

1. **Honeypot Effect and Network Latency:** Even on chains with extremely fast settlement like Solana or Sui, from DMM observing real-world changes to oracle packaging signatures to transaction landing on-chain, there's still hundred-millisecond-level physical latency. In highly dynamic events (e.g., match just kicked off, earnings just released), this latency is enough for arbitrageurs to complete multiple front-runs and directly drain pool liquidity.
2. **DMM Model Manipulation/Single Point of Failure:** If the DMM's off-chain pricing model is hacked, misconfigured, or price feeds are poisoned, once wrong Prior parameters are written on-chain, the parametric AMM instantly becomes an ATM for wool parties and scientists — on-chain LPs don't even have time to react.

---

## Recommended Approach: Opening Auction Engineering Implementation

Letting the market discover initial parameters itself achieves purely decentralized price discovery and can elegantly map directly to our parametric models mathematically.

Engineering-wise, it's divided into two phases:

### Phase One: No-Recourse Blind Auction Phase

During a fixed window before event opening (e.g., 24 hours before kickoff, or 3 hours before CPI release), the system **does not start the parametric AMM engine** — instead it opens a simple **capital deposit/intent order pool**:

* **For win-draw-lose (Dirichlet distribution):** Traders freely subscribe to initial shares of "Win," "Draw," "Lose" with USDC. The system doesn't calculate slippage — only records absolute capital per pool (e.g., Win pool 60k, Draw pool 20k, Lose pool 20k).
* **For continuous intervals (Gaussian distribution):** Users submit what they believe are reasonable means and intervals.

### Phase Two: Parametric Pegging and AMM Activation

The instant the auction period closes, the smart contract executes **atomic settlement**. The system doesn't match any tokens — it **directly reads the capital ratios of the three pools and converts them into the AMM's initial parameters (Prior)**.

Taking Dirichlet distribution $\boldsymbol{\alpha} = (\alpha_W, \alpha_D, \alpha_L)$ as an example, if at auction close total capital is 100,000 USDC with ratio 6:2:2:

1. **Initialize Parameters:** On-chain parameters are directly set to $\boldsymbol{\alpha}_0 = (60, 20, 20)$. Initial market odds are fully determined by auction supply and demand.
2. **Capital Becomes Reserve:** This 100,000 USDC automatically converts to the AMM pool's **initial liquidity (Vault reserve)**. Auction participants automatically receive corresponding position tokens at initial prices.
3. **Unlock Parametric AMM:** Real-time trading channels are now unlocked; subsequent retail and small trades dynamically adjust the $\boldsymbol{\alpha}$ mixing console.

---

## Architectural Advantages of This Design

* **Naturally Immune to MEV Sandwich:** During the auction phase, there's no liquidity pool to extract from and no real-time changing prices — all front-running, sandwiching, and high-frequency arbitrage are completely ineffective.
* **Endogenous Cold-Start Liquidity:** The moment prices are discovered, the pool already has 100k in underwriting collateral — the system doesn't need to hunt worldwide for professional LPs to provide initial liquidity.
* **Extremely Mathematically Self-Consistent:** The larger the auction participation capital, the larger the initial $\sum \alpha$ base. This means **higher market participation leads to thicker market rigidity (depth) at opening** — perfectly aligned with market economics.

---

If adopting this "call auction pegging + dynamic parametric market-making" hybrid architecture, after product launch, which risk do you think deserves the most vigilance — "whale dump manipulation of initial parameters in the final second before auction close (Closing-second Manipulation)," or "parameter one-sided tilt and insufficient pool liquidity concentration due to breaking news during trading"?

# Detailed Analysis: How Exactly Do LPs Make Money? How Do Other Users Make Money? Examples.

In parametric AMM prediction markets, profit logic completely departs from traditional order book "buy low, sell high" — evolving into a financial game of "probability, risk, and information asymmetry."

We can define them with simple identities:

* **LP (Liquidity Provider)** = **Insurance company (underwriter)**. Profits through law of large numbers, actuarial win rates, and collecting "premiums (spread)."
* **Other users (traders/arbitrageurs)** = **Policyholders or hunters.** Profit through accurate prediction, capturing market sentiment, or correcting pricing errors.

---

## I. How Do LPs Make and Lose Money?

LPs deposit pure stablecoins (like USDC) into the liquidity pool (Vault), holding no event tokens. Their gains and losses are entirely determined by the model's mathematical formulas and final settlement outcomes.

### 1. Profit Sources

* **Implicit Spread Income (Spread/Slippage):** Every time a trader buys or sells, the parametric AMM deliberately raises the price of the asset being bought through formulas. This "premium/slippage" from trade impact is essentially trading fees retail pays to the pool, settling directly in the Vault.
* **Eating "Wrong Prediction" Principal:** When the public frantically buys an extreme event that ultimately doesn't happen due to emotional frenzy (e.g., betting China wins the World Cup), their USDC all flows into the Vault, becoming LP profit.
* **Time Value Decay (Theta):** As the event deadline approaches, uncertainty decreases, tail risks of discrete probabilities (zero-out probability) accelerate collapse — the LP effectively acts as an option seller, steadily earning the settled funds from these zeroed-out tokens.

### 2. Loss Sources

* **Adverse Selection:** If "informed traders" with absolute insider information or advanced quant models appear in the market, and the AMM curve adjusts too slowly, informed traders buy large amounts of "god-tier" positions that will ultimately exercise at extremely low prices — causing targeted blow-up of the Vault at settlement.

---

## II. How Do Other Users (Traders/Arbitrageurs) Make Money?

Other users earn through three strategy modes:

1. **Directional Speculators:**
* **Play:** Bet on $\mu$ (mean/outcome) movement.
* **Earn:** Buy when event probability is undervalued, hold to settlement for $1; or sell mid-way after market sentiment pushes probability up, earning the "probability appreciation" spread.


2. **Volatility Traders:**
* **Play:** Bet on $\sigma$ (standard deviation/disagreement) movement.
* **Earn:** They don't care who wins — only how heated the market debate is. When the market is extremely calm, simultaneously buy extreme long and extreme short options (building a straddle). Once breaking news causes market panic, volatility parameter $\sigma$ surges, both extreme option prices get raised by the AMM — they close both sides and profit.


3. **Arbitrageurs:**
* **Play:** Brick-moving, flattening spreads.
* **Earn:** Discover a team's win rate is $60\%$ on traditional betting or Polymarket, but this parametric AMM calculates only $50\%$. They immediately buy that team to win in the AMM, pushing parameters back to the true $60\%$ consensus, earning risk-free hedging profit.



---

## III. Concrete Example: Win-Draw-Lose (Dirichlet AMM) Walkthrough

To make this crystal clear, let's simulate a football match: **Real Madrid vs. Barcelona**.

### 1. Initial Opening State

The system uses a Dirichlet distribution template; through initial call auction, initial parameters are pegged:

* **Underlying Parameters:** $\boldsymbol{\alpha} = (50, 25, 25)$ (total denominator = 100)
* **Current Market Probability:** Real Madrid Win (W) $50\%$, Draw (D) $25\%$, Barcelona Win (L) $25\%$
* **LP Initial Injection:** 10,000 USDC locked in Vault.

At this point, Real Madrid win token theoretical price is 0.50 USDC, Barcelona win is 0.25 USDC.

---

### 2. Trading Phase (Capital Inflow)

* **Trader Tom (bullish on Real Madrid):** Pours in **1,000 USDC** firmly buying "Real Madrid Win." His buy moves the curve, triggering slippage — his average buy price is dynamically adjusted to 0.55 USDC.
* *Result:* Tom receives $1000 / 0.55 = 1818$ "Real Madrid Win" redemption tokens.
* *AMM State Refresh:* Real Madrid parameter pushed up, system $\boldsymbol{\alpha}$ changes to $(70, 25, 25)$.


* **Arbitrageur Alice (believes draw probability is undervalued):**
Discovers draw probability was passively diluted, pours in **500 USDC** buying "Draw" at average cost 0.20 USDC.
* *Result:* Alice receives $500 / 0.20 = 2500$ "Draw" redemption tokens.
* *AMM State Refresh:* System $\boldsymbol{\alpha}$ changes to $(70, 35, 25)$.



**Vault (liquidity pool) book assets at this point:**


$$\text{Initial 10,000} + \text{Tom's 1,000} + \text{Alice's 500} = 11,500 \text{ USDC}$$

---

### 3. Final Settlement (Distribution Moment)

Match ends, real-world result revealed. Let's see how everyone gets paid under two completely different outcomes:

#### Outcome A: Real Madrid Wins (Tom correct, Alice wrong)

* **Tom (directional trader):** Redeems 1818 "Real Madrid Win" tokens with smart contract (1:1 to USDC), receives **1,818 USDC**.
* *Tom's net profit:* $1818 - 1000 = \mathbf{+818\text{ USDC}}$ (big win).


* **Alice (arbitrageur):** Wrong prediction — "Draw" tokens zero out.
* *Alice's net profit:* $\mathbf{-500\text{ USDC}}$ (big loss to pool).


* **LP (liquidity provider):** Vault total assets 11,500 USDC, after paying Tom 1,818 USDC, pool has $11500 - 1818 = 9,682\text{ USDC}$ remaining.
* *LP's net profit:* $9682 - 10000 = \mathbf{-318\text{ USDC}}$.
* *Deep analysis:* In this outcome LP loses. Because Tom's information was more accurate — he successfully bought low when probability was still low (0.55) — LP suffered adverse selection, acting as Tom's counterparty.



#### Outcome B: Upset Draw (Alice correct, Tom wrong)

* **Tom:** Wrong prediction — "Real Madrid Win" tokens zero out.
* *Tom's net profit:* $\mathbf{-1000\text{ USDC}}$ (big loss to pool).


* **Alice:** Redeems 2500 "Draw" tokens, receives **2,500 USDC**.
* *Alice's net profit:* $2500 - 500 = \mathbf{+2000\text{ USDC}}$ (4x windfall).


* **LP (liquidity provider):** Vault total assets 11,500 USDC, after paying Alice 2,500 USDC, pool has $11500 - 2500 = 9,000\text{ USDC}$ remaining.
* *LP's net profit:* $9000 - 10000 = \mathbf{-1000\text{ USDC}}$.



#### Outcome C: Epic Upset, Barcelona Wins (Tom and Alice both wrong!)

* **Tom:** Zeroed ($\mathbf{-1000\text{ USDC}}$).
* **Alice:** Zeroed ($\mathbf{-500\text{ USDC}}$).
* **Nobody holds "Barcelona Win" tokens.**
* **LP (liquidity provider):** Vault has no redemption obligations.
* *LP's net profit:* $11500 - 10000 = \mathbf{+1500\text{ USDC}}$.
* *Deep analysis:* LP wins big. Not only ate Tom and Alice's combined 1,500 principal, but since no external payouts were made during trading, all of it became pure LP profit.



---

## IV. Summary: The Ultimate Winner Under the Law of Large Numbers

In a single match, LP wins or loses depending on market outcomes (Outcomes A, B lose; Outcome C wins). But in reality, **LPs profit by simultaneously underwriting hundreds of matches.**

As time stretches and match count grows, by the law of large numbers: retail losses from emotional buying (Outcome C-style total losses, or uneven two-sided betting causing spread erosion) continuously and steadily convert into slippage and premium inflows, ultimately driving LP capital curves toward stable, upper-right extending compound growth like an **insurance company**.

## V. How Is Football Goal Interval Settlement Calculated? (`[2,6]` Hit Example)

Taking total goal count events as an example, the system uses Poisson parameter `lambda` for pricing.
Interval positions have only two states at settlement:

- Hit interval: each position redeems 1 USDC
- Miss: position zeroes out

Assume:

- At order time `lambda = 3.0`
- User buys interval `[2,6]`
- After slippage, average fill price is `0.70`
- User invests principal `1000 USDC`

Then user position quantity:

$$Q=\frac{1000}{0.70}=1428.57$$

If result is `X=5` (falls in `[2,6]`):

- Total redemption = `1428.57 * 1 = 1428.57 USDC`
- Net profit = `1428.57 - 1000 = +428.57 USDC`
- ROI = `42.857%`

If result is `X=1` or `X>=7`:

- Position zeroes out
- Net profit = `-1000 USDC`

Core conclusion: **Mid-path parameter fluctuations only affect entry cost; final settlement only cares whether the result falls in the purchased interval.**

## VI. Why Doesn't Buying an Ultra-Wide Interval (e.g., `[1,7]`) Necessarily Crush the LP?

Intuitively wide intervals "are easier to hit," but they're also "more expensive" — so the common structure is:

- High win rate
- Low odds
- Tail one-time large drawdown

Example (`lambda=3.0`):

- `[1,7]` theoretical probability ~ `95%`
- After slippage, average buy price ~ `0.97`
- Invest `1000 USDC`, position `1000/0.97=1030.93`

If hit (normal case):

- Total redemption `1030.93`
- Net profit `+30.93` (ROI ~ `3.09%`)

If miss (tail):

- Position zeroes out
- Net profit `-1000`

So traders aren't "guaranteed high returns" — it's the classic:

- Frequent small wins
- Infrequent large losses

LP's mirrored profit profile is:

- Frequent small losses (small redemptions on normal hits)
- Infrequent large wins (eating all principal on tail misses)

Long-term P&L ultimately depends on: trading turnover, slippage/fee premium, tail outcome frequency, and whether LP defense parameters are enabled (dynamic fees, virtual liquidity, time locks, etc.).

# An Election Example with Multiple Candidates

Multi-candidate election prediction (e.g., three candidates for mayor) is one of the most powerful application scenarios for parametric AMM. In traditional Polymarket, if there are 5 candidates, the platform must open 5 independent Yes/No markets — capital shatters into fragments.

In parametric AMM, we use the **Dirichlet Distribution** template — opening **one unified liquidity pool** that perfectly prices all candidates simultaneously.

Below we use a concrete example to see how **multi-candidate elections** play out — how LPs, directional traders, and arbitrageurs compete and get paid.

---

## I. Initial State: Auction Pegging

Suppose three candidates: **Candidate A** (established favorite), **Candidate B** (dark horse reformer), **Candidate C** (fringe disruptor).

Through pre-opening "call auction," the market injects **100,000 USDC** initial liquidity (locked in Vault reserve pool) and dynamically shapes initial prior parameters:

* **Underlying Parameters:** $\boldsymbol{\alpha} = (\alpha_A, \alpha_B, \alpha_C) = (40, 40, 20)$ (total denominator = 100)
* **Initial Market Win Rates (Prices):**
* Candidate A: $40 / 100 = 40\%$ (token price: **0.40 USDC**)
* Candidate B: $40 / 100 = 40\%$ (token price: **0.40 USDC**)
* Candidate C: $20 / 100 = 20\%$ (token price: **0.20 USDC**)



---

## II. Trading Phase: The Magic of "Linked Repricing"

At this stage, we can clearly see the parametric AMM's core magic: **when you buy Candidate C, Candidate A and B prices automatically drop atomically — without anyone trading them.**

### Trade 1: Trader Mao Bottom-Fishes the Dark Horse

After offline research, Mao believes fringe Candidate C's support rate is definitely more than $20\%$ — severely undervalued now. He pours in **2,000 USDC** firmly buying "C Wins."

* **AMM Response:** Capital inflow pushes $\alpha_C$ from 20 soaring to 40. Parameter matrix becomes $\boldsymbol{\alpha} = (40, 40, 40)$, total denominator becomes 120.
* **Slippage Calculation:** Due to trade impact, Mao's average buy cost is raised to **0.25 USDC**.
* **Mao's Assets:** $2000 / 0.25 = \mathbf{8,000}$ "C Wins" tokens.

> **Global prices auto-refresh:**
> * A's win rate drops to: $40 / 120 = 33.3\%$
> * B's win rate drops to: $40 / 120 = 33.3\%$
> * C's win rate rises to: $40 / 120 = 33.3\%$
> 
> 

### Trade 2: Arbitrageur Lin Picks Up Bargains

Lin sees globally refreshed prices and keenly notices: Candidate A was the top favorite, but because Mao bought C heavily, A's price passively dropped to 0.333 USDC. Lin considers this free arbitrage and immediately pours in **3,333 USDC** buying "A Wins."

* **AMM Response:** $\alpha_A$ pushed from 40 to 80. Parameter matrix becomes $\boldsymbol{\alpha} = (80, 40, 40)$, total denominator becomes 160.
* **Slippage Calculation:** Lin's average buy cost is **0.38 USDC**.
* **Lin's Assets:** $3333 / 0.38 = \mathbf{8,771}$ "A Wins" tokens.

---

## III. Final Settlement: Ledger Breakdown

Election voting ends, vote count revealed. Total user investment and Vault cash flow in the market:

* **Total Vault Funds (Total Pool):** $\text{Initial 100,000} + \text{Mao's 2,000} + \text{Lin's 3,333} = \mathbf{105,333\text{ USDC}}$

Let's see final profit tables under three different election outcomes:

### Outcome 1: Candidate C Epic Comeback Wins (Mao correct, Lin wrong)

* Smart contract rule: only "C Wins" tokens redeem 1:1 for USDC; all others zero out.

| Role | Settlement Action | Principal Invested | Final Received | Net Profit | Win/Loss Logic |
| --- | --- | --- | --- | --- | --- |
| **Trader Mao** | Redeem 8,000 C tokens | 2,000 USDC | 8,000 USDC | **+6,000 USDC** | Successfully captured potential upset, 3x windfall. |
| **Arbitrageur Lin** | A tokens zero out | 3,333 USDC | 0 USDC | **-3,333 USDC** | Caught passive spread but wrong on political direction, principal zeroed. |
| **Pool LP** | After paying Mao, Vault has 97,333 | 100,000 USDC | 97,333 USDC | **-2,667 USDC** | **Adverse selection.** Ate Lin's 3,333 but paid Mao too much. |

---

### Outcome 2: Candidate A Steady Win (Lin correct, Mao wrong)

* Only "A Wins" tokens redeem 1:1 for USDC.

| Role | Settlement Action | Principal Invested | Final Received | Net Profit | Win/Loss Logic |
| --- | --- | --- | --- | --- | --- |
| **Trader Mao** | C tokens zero out | 2,000 USDC | 0 USDC | **-2,000 USDC** | Misjudged disruptor's strength, paid tuition. |
| **Arbitrageur Lin** | Redeem 8,771 A tokens | 3,333 USDC | 8,771 USDC | **+5,438 USDC** | Successfully used price linkage to pick up favorite candidate's cheap chips at low price. |
| **Pool LP** | After paying Lin, Vault has 96,562 | 100,000 USDC | 96,562 USDC | **-3,438 USDC** | **Still losing.** Favorite A won, Lin took the bulk, Mao's 2000 wasn't enough to fill the hole. |

---

### Outcome 3: Candidate B Wins in Chaos (Mao and Lin both wrong!)

* Only "B Wins" tokens redeem 1:1 for USDC. **Key point: during live trading, nobody bought B.**

| Role | Settlement Action | Principal Invested | Final Received | Net Profit | Win/Loss Logic |
| --- | --- | --- | --- | --- | --- |
| **Trader Mao** | C tokens zero out | 2,000 USDC | 0 USDC | **-2,000 USDC** | Loss. |
| **Arbitrageur Lin** | A tokens zero out | 3,333 USDC | 0 USDC | **-3,333 USDC** | Loss. |
| **Pool LP** | **No redemptions to anyone!** | 100,000 USDC | 105,333 USDC | **+5,333 USDC** | **LP takes all.** Mao and Lin battled each other, third party won. Both principals became pure LP profit. |

---

## 💡 Why Is This Mechanism Architecturally Advanced?

1. **Zero Capital Fragmentation:** Throughout the process, whether voters bet A, B, or C, all money flows into the same 105,333 USDC pool. This provides extremely smooth underlying liquidity for long-tail candidates (even with 10 candidates).
2. **LP's "Law of Large Numbers" Moat:** You may notice LPs lost money in Outcomes 1 and 2. But remember, elections often last weeks with hundreds of trades daily reshaping the curve. **Implicit slippage from every trade (Mao buying at 0.25, Lin at 0.38) snowballs and continuously remains in the Vault.**
3. **Ultimate Outcome:** With sufficient trading frequency, LP-accumulated "slippage fees" far exceed single-outcome payout losses. LPs don't earn from "who gets elected" — they earn the volatility premium from "the entire market repeatedly trading due to disagreement."

# Another Interval Outcome Example: CPI

Predicting continuous interval events (e.g., **CPI inflation rate, Fed rate cut basis points, non-farm payroll**) is the absolute home turf of Gaussian (normal) distribution parametric AMM.

In this mode, users no longer buy "Yes" or "No" — they buy "a numerical interval." The system automatically prices any interval by **integrating** the Gaussian density function (computing area under the curve).

Below we use "predicting next month's officially published CPI year-over-year rate" as an example, detailing the entire game and payout process.

---

## I. Initial State: Opening Tone

Suppose the market opens; the system selects Gaussian distribution (normal distribution) as the shape template. Through call auction, the pool injects **100,000 USDC** initial liquidity (reserve) and locks initial parameters:

* **Core Parameters:** * $\mu = 2.5\%$ (market broadly expects CPI at 2.5%)
* $\sigma = 0.2\%$ (standard deviation — market believes fluctuation range is very small)


* **Initial Curve Shape:** A tall, narrow curve peaking at 2.5%, collapsing quickly on both sides.

### Interval Pricing Logic at This Point:

Anyone wanting to buy any interval — price is the **area** under the curve for that interval (max $1, min $0).

* **Interval $[2.4\%, 2.6\%]$:** In the core sweet spot, huge area — system calculates probability at $68\%$. Token price: **0.68 USDC**.
* **Interval $[2.9\%, 3.1\%]$:** Far from core, low-probability event, tiny area — system calculates only $5\%$ probability. Token price: **0.05 USDC**.

---

## II. Trading Phase: Adjusting "Mean" and "Volatility"

The parametric AMM's greatest strength for continuous intervals: **every user buy reshapes the curve's "position ($\mu$)" and "width ($\sigma$)."**

### Trade 1: Directional Trade (Bullish Frenzy, Adjusting $\mu$)

Trader **Macro Wang** sees Middle East escalation and oil price surge, convinced next month's CPI will definitely break 3.0%. He pours in **2,000 USDC** buying interval **$[2.9\%, 3.1\%]$**.

* **AMM Response:** Directional capital impact triggers model correction — system believes market expectations are shifting up, so **forcibly pushes $\mu$ from 2.5% right to 2.7%**.
* **Slippage Calculation:** Due to large buy volume, curve right-shift causes interval to keep rising in price — his average buy cost is raised to **0.10 USDC**.
* **Wang's Assets:** $2000 / 0.10 = \mathbf{20,000}$ "$[2.9\%, 3.1\%]$ interval redemption vouchers."

### Trade 2: Volatility Trade (Buying Uncertainty, Adjusting $\sigma$)

Subsequently, several Fed officials give extremely contradictory speeches — market falls into extreme confusion. Trader **Vol Filter** believes upcoming data will either be terrifyingly high or surprisingly low. He pours in **3,000 USDC** specifically buying "both extreme intervals" (i.e., fat tails of $<2.0\%$ or $>3.4\%$).

* **AMM Response:** This two-sided bet on extremes makes the system sense market disagreement expanding sharply. AMM **doesn't change $\mu$ — adjusts standard deviation $\sigma$ from 0.2% up to 0.5%**.
* **Curve Deformation:** The entire Gaussian curve is instantly "flattened and widened" (as shown below).

> **Chain reaction after curve widens:**
> * Previously stable core zone $[2.4\%, 2.6\%]$ probability plummets, prices drop sharply.
> * Previously ignored "dead zone" intervals at both ends grow in area, prices surge collectively.
> 
> 

---

## III. Final Settlement: Truth Revealed

Statistics bureau officially publishes CPI data. Vault (liquidity pool) total funds:


$$\text{Initial 100,000} + \text{Wang's 2,000} + \text{Filter's 3,000} = \mathbf{105,000\text{ USDC}}$$

Let's see how wealth transfers under three completely different real-world outcomes:

### Outcome A: Inflationary Data, Final CPI at 2.95%

(Falls in Macro Wang's $[2.9\%, 3.1\%]$ interval; Vol Filter fails)

| Role | Settlement Action | Principal Invested | Final Received | Net Profit | Win/Loss Logic |
| --- | --- | --- | --- | --- | --- |
| **Trader Wang** | Redeem 20,000 vouchers 1:1 | 2,000 USDC | 20,000 USDC | **+18,000 USDC** | **Precision kill.** Used macro information edge to heavily load tail interval at 0.1 low price, 9x windfall. |
| **Trader Filter** | All extreme interval vouchers zero out | 3,000 USDC | 0 USDC | **-3,000 USDC** | Market volatility was high but data didn't enter his ultra-extreme dead zones, principal eaten. |
| **Pool LP** | After paying Wang, Vault has 85,000 | 100,000 USDC | 85,000 USDC | **-15,000 USDC** | **High-dimensional targeted blow-up.** Earned Filter's 3000 but not enough to pay hardcore macro trader Wang. |

---

### Outcome B: Calm Waters, Final CPI at 2.50%

(Perfectly matches initial prediction; Wang and Filter both lose)

| Role | Settlement Action | Principal Invested | Final Received | Net Profit | Win/Loss Logic |
| --- | --- | --- | --- | --- | --- |
| **Trader Wang** | Interval vouchers zero out | 2,000 USDC | 0 USDC | **-2,000 USDC** | Misjudged inflation trend, paid tuition. |
| **Trader Filter** | Extreme interval vouchers zero out | 3,000 USDC | 0 USDC | **-3,000 USDC** | Market ultimately chose safest consensus, long volatility bet failed. |
| **Pool LP** | **No redemptions to anyone!** | 100,000 USDC | 105,000 USDC | **+5,000 USDC** | **LP wins effortlessly.** Market seemed noisy (some buying up, some buying volatility) but reality was calm. Both traders' combined 5,000 principal all swallowed by LP. |

---

### Outcome C: Black Swan, Final CPI at 3.60%

(Super malignant inflation, directly hits Vol Filter's $>3.4\%$ extreme interval; Wang fails)

| Role | Settlement Action | Principal Invested | Final Received | Net Profit | Win/Loss Logic |
| --- | --- | --- | --- | --- | --- |
| **Trader Wang** | Interval vouchers zero out | 2,000 USDC | 0 USDC | **-2,000 USDC** | Direction was right but overcommitted — guessed the front but not the ending. |
| **Trader Filter** | Redeem extreme interval vouchers 1:1 | 3,000 USDC | 12,000 USDC | **+9,000 USDC** | **Black swan catcher.** Successfully predicted disagreement amplification, locked cheap extreme interval chips when model curve "widened." |
| **Pool LP** | After paying Filter, Vault has 93,000 | 100,000 USDC | 93,000 USDC | **-7,000 USDC** | Loss. As underwriter, black swan events are LP's natural enemy. |

---

## Core Review: Production Advantages of Continuous Interval AMM

Through this example, we can see two unparalleled advantages of Gaussian parametric AMM in engineering and financial design:

1. **Infinite Markets, One Capital Pool:** Theoretically, CPI could be 2.51%, 2.512%, or any infinite decimal. With traditional Yes/No tokens, you'd need tens of thousands of markets. Here, any slice (interval) on the entire axis is computed by integrating the same curve — **all money flows in the same 105,000 USDC pool**, achieving mathematical limits in capital efficiency.
2. **Volatility Isn't Just Observable — It's Tradable:** Traditional prediction markets only bet "what the outcome is" (buy $\mu$). Parametric AMM gives users the ability to trade "uncertainty" (buy/sell $\sigma$). When capital at both ends begins balanced competition, even if $\mu$ doesn't move, LP can automatically complete defensive repricing by increasing $\sigma$ — this is the core charm of modern on-chain micro-financial engineering.

# LP Loss Probability Seems High — How Many Trades Does Implicit Slippage Per Trade Need to Generate How Much Revenue for LP?

Your intuition is very sharp. Looking at single matches or elections alone, if savvy quant hackers (Informed Traders) harvest precisely each time, LP (liquidity provider) does look like a "sucker."

But the magic of financial engineering is: **parametric AMM doesn't earn from "final outcomes" — it uses mathematical formulas to voraciously extract "path integral premium" like a vampire screw during traders' back-and-forth price tugging.**

To let you see the profit clearly, let's go straight to hardcore math formulas and quantitative estimates.

---

## I. Core Math Principle: Why Does Round-Trip Trading Make the Pool Grow Money Out of Thin Air?

In parametric AMM, funds users pay when buying aren't simply "quantity $\times$ current price" — they're the **integral of the price curve (Cost Function)**.

Suppose a simplified parametric model where an asset's instant price is $P(x)$. When a trader pushes market state from $x_1$ to $x_2$, they must pay total funds:

$$\text{Cost} = \int_{x_1}^{x_2} P(x) \, dx$$

Because price keeps rising as they buy ($P(x)$ is monotonically increasing), **their average payment price is always higher than the initial price before their buy.**

### 1. What Is "Round-Trip Toll" (Round-Trip Churn)?

The most extreme example: two fools in the market, Old Wang and Old Li.

* Initial state: both teams at $50\%$ win rate.
* **Step one:** Old Wang likes Team A, pours money pushing A's win rate to $70\%$. Due to slippage, Old Wang pays a high premium (average cost $60\%$ to buy).
* **Step two:** Old Li likes Team B, reverses with equal money pushing B's win rate back, market returns to $50\%$ each — initial state. Old Li also pays premium.

**The magical thing:** At this point market probability, odds, and initial state are identical — but the pool (Vault) has extra "slippage toll" from Old Wang and Old Li. **As long as the market oscillates back and forth before expiry, regardless of who wins, this money absolutely belongs to LP.**

---

## II. How Many Trades to Break Even? (Quantitative Estimation Model)

Whether LP profits depends on a core game metric: **can retail/noise trader volume cover profits taken by savvy arbitrageurs (Informed Traders)?**

Let's use a standard quant model for deduction:

* **Pool Total Size (Vault):** 100,000 USDC
* **Per-Trade Slippage Rate (Slippage Take):** Average 2% of trade amount (determined by model control parameters)
* **Maximum Directional Profit Arbitrageurs Can Take at Election/Match Reveal:** 10,000 USDC (assuming arbitrageurs are extremely sharp, precisely draining 10% of pool at the end)

### LP Break-Even Formula:

$$\text{LP Profit} = (\text{Total Volume} \times \text{Average Slippage Rate}) - \text{Informed Arbitrageur Profit}$$

To achieve break-even (profit $> 0$):


$$\text{Total Volume} \times 2\% > 10,000 \implies \text{Total Volume} > 500,000 \text{ USDC}$$

### Converted to Specific Trade Count:

If this pool runs 7 days from opening to settlement:

* 100 retail small orders daily (average 500 USDC each), daily volume 50,000 USDC.
* 7-day total volume = $50,000 \times 7 = 350,000$ USDC.
* **LP profit at this point:** $350,000 \times 2\% = 7,000$ USDC. Below the 500k threshold — LP ultimately loses 3,000 USDC after settlement.

**But! For hot events (e.g., US election or Champions League final):**

* 500 buy-sell frictions daily (average 1,000 USDC each), daily volume up to 500,000 USDC.
* 7-day total volume = 3,500,000 USDC.
* **LP profit at this point:** $3,500,000 \times 2\% = 70,000$ USDC.
* **Final net profit:** $70,000 - 10,000 (\text{payout}) = \mathbf{+60,000\text{ USDC}}$. **LP achieves 60% ROI in just 7 days!**

---

## III. Real Production Data Comparison

In actual on-chain prediction markets, retail frenzy and trading turnover often far exceed imagination.

| Metric Dimension | Niche Event (e.g., obscure tech prediction) | Hot Event (e.g., election, World Cup) |
| --- | --- | --- |
| **Pool Depth (TVL)** | 10,000 USDC | 1,000,000 USDC |
| **Turnover Rate (Volume / TVL)** | 0.5x (slow capital rotation) | **15 - 30x** (capital frantically churning) |
| **Total Trade Count** | ~50 - 100 trades | **5,000 - 20,000 trades** |
| **Slippage & Premium Settlement** | Minimal, can't cover directional payouts | Extremely rich, forming huge safety cushion |
| **LP Final Outcome** | **Likely losing** (becomes asymmetric information victim) | **Very likely winning** (law of large numbers kicks in) |

---

## IV. Top-Tier Engineering Defense: How to Keep LP from Becoming Cannon Fodder?

As architects, we absolutely cannot rely on "praying retail trades more." To firmly protect LP's bottom line, real parametric AMMs embed three **defense algorithms** in smart contracts:

1. **Dynamic Fee Layer:**
Just like Uniswap v4 raises fees when liquidity faces violent one-sided volatility — when detecting $\mu$ or $\alpha$ being continuously hammered one-sided in extremely short time (indicating insider info or whale directional harvesting), the contract **automatically raises slippage coefficient or fees from 2% instantly to 8%**. Forcing savvy traders to pay extremely high costs, vomiting profits back to the pool.
2. **Virtual Liquidity and Volatility Decay:**
During early opening when trading volume is low, the system artificially increases $\sigma$ (standard deviation) in parameters or adds virtual principal. This makes every early small trade attempting to harvest the pool produce enormous slippage like hitting a tsunami — deterring high-frequency arbitrageurs at the source.
3. **Delayed Settlement and Time Lock (Oracle Resolution Window):**
On the eve of event outcome reveal, the system forcibly closes real-time repricing trading, or introduces an "optimistic settlement window" the instant results come out. This directly eliminates quant sandwich bots exploiting 100-millisecond real-world information gaps for risk-free on-chain arbitrage.

### Summary

The single losses you see are **microscopic point risks**; what LPs survive on is **macroscopic statistical dividends**. As long as the event itself has sufficient topicality and turnover rate (greater than 5 to 10x pool TVL), parametric AMM's underlying math automatically turns LP into a decentralized trading network steadily earning "toll fees."

# LP Returns? Especially When LP Join Timing Differs.

This is a very profound architecture design question. In traditional Uniswap, LPs can join anytime by depositing two tokens proportionally — because pool value is fully real-time.

But in parametric AMM prediction markets, **the pool holds not just cash (USDC) but also outstanding "payout option liabilities."** If LPs join at different times and the system crudely distributes by capital proportion, early LPs get severely exploited, or late LPs purely "freeload" on fees.

To solve this, parametric AMM must introduce modern hedge fund **NAV (Net Asset Value) pricing mechanism**.

---

## I. Core Underlying Mechanism: "Net-Value" LP Tokens

In parametric AMM, LPs deposit capital in exchange for **LP-Token**. This LP-Token price isn't fixed at 1 USDC — it fluctuates dynamically:

$$\text{LP-Token NAV} = \frac{\text{Total Vault Cash} - \text{Mark-to-Market Liability of All Outstanding Orders}}{\text{Total LP-Token Supply}}$$

* **Book Liability:** The match hasn't ended yet, but based on current system parameters (e.g., $\mu$ or $\alpha$), the system can precisely calculate expected payout if settled immediately.

Whenever new LPs join at different time points, the system **computes current NAV in real time and "subscribes" LP-Tokens at net value**.

---

## II. Different Join Timing — LP Risk and Return Breakdown

We can divide the event lifecycle into three phases — LPs entering at different phases have completely different profit logic and risks:

### 1. $T_0$ Phase Entry: Pioneer LP (High Risk, Captures Maximum Fees)

* **Timing:** Just opened, market not yet battered by heavy trading, maximum disagreement.
* **Profit Logic:** **They're the biggest beneficiaries of fees (slippage).** Early curve is most sensitive — every retail buy produces huge slippage premium. These continuous information friction costs 100% inject into $T_0$ LP's share, pushing their LP-Token NAV rapidly from 1.0 to 1.1, 1.2.
* **Risk:** **Directional blow-up risk.** If opening price (Prior) is wrong, or super informed traders (with absolute insider info) appear, $T_0$ LP bears the full first wave of directional harvesting losses alone.

### 2. $T_1$ Phase Entry: Mid-Game/Takeover LP (Medium Risk, Amplifies System Rigidity)

* **Timing:** Market has traded for days, prices converged (e.g., election probability stable at 55%), trading volume in high-frequency burst.
* **Profit Logic:** Entering now, though missing early slippage windfall, current NAV already includes previously settled fees — they must **subscribe at premium** (e.g., pay 1.2 USDC for 1 LP-Token). After entering, they proportionally scale parameters (e.g., scale $\boldsymbol{\alpha}$ 3x), providing deeper depth, then earn fees from subsequent large institutional capital entry.
* **Risk:** Bears shared risk of subsequent sudden black swan events.

### 3. $T_2$ Phase Entry: Late-Stage/Vulture LP (Extremely Low Risk, Protocol Strictly Limits)

* **Timing:** Match has 5 minutes left, or election vote count is 99% complete, outcome essentially decided.
* **Profit Logic:** These LPs are typically "Vulture LPs" — they see outcome is decided, pool is guaranteed profit, wanting to pour large capital in the final minutes to freeload final settlement windfall.
* **Protocol Defense:** Real parametric AMM locks $T_2$ phase liquidity injection in code (e.g., ban subscriptions in final 10% time window), or forcibly deducts expensive "entry penalty fee" on $T_2$ injection to protect early risk-bearing LPs.

---

## III. Extreme Walkthrough: Allocation Ledger for Different Join Timing

Let's use a very intuitive table and numbers to see how **LP arriving 1 hour early** and **LP arriving 1 hour late** ultimately divide interests.

Assume event: **A tech giant reports earnings tonight — predict whether stock rises over 5%.**

| Timeline & Event State | LP 1 (Early) Action & Pool State | LP 2 (Late) Action & Pool State | Retail/Trader Impact | LP-Token NAV Calculation |
| --- | --- | --- | --- | --- |
| **$T_0$ Opening** | **LP 1 injects 10,000 USDC**.<br>

<br>System issues 10,000 LP-Tokens.<br>

<br>**NAV = 1.0** at this point. | Still asleep, not entered. | No trading yet, no liability. | $\text{NAV} = \frac{10000 - 0}{10000} = \mathbf{1.0}$ |
| **$T_1$ Battle (1 hour later)** | Lying still. | Sees market hot, **LP 2 brings 12,000 USDC to apply for entry**. | Past hour, retail frantically buying/selling back and forth, **settling 2,000 USDC pure slippage profit** into pool. Pool cash now 12,000. | **Pool NAV appreciates:**<br>

<br>$\text{NAV} = \frac{12000}{10000} = \mathbf{1.2}$.<br>

<br>

<br>**LP 2 enters at 1.2 NAV:**<br>

<br>He pays 12,000 cash, but system only mints $12000 / 1.2 = \mathbf{10,000}$ LP-Tokens. |
| **$T_1$ Post-Expansion State** | Holds 10,000 LP-Tokens. | Holds 10,000 LP-Tokens. | Both **split equity equally** (50% each). Total LP-Tokens = 20,000, total pool cash = 24,000 USDC. | $\text{NAV} = \frac{24000}{20000} = \mathbf{1.2}$ (price unchanged, pool thickened). |
| **$T_2$ Final Settlement** | Earnings released, perfectly matches expectations! No large payouts. Market generated **4,000 USDC new fees** over time. | Pool total cash becomes: $24000 + 4000 = \mathbf{28,000\text{ USDC}}$. | **Final NAV settlement:**<br>

<br>$\text{NAV} = \frac{28000}{20000} = \mathbf{1.4}$. |  |

---

### Final Distribution Results (Withdrawal):

* **LP 1 (Early Pioneer):**
Holds 10,000 LP-Tokens, redeems at final NAV 1.4 $\to$ receives **14,000 USDC**.
* *Net profit:* $14000 - 10000 = \mathbf{+4,000\text{ USDC}}$ (return rate **$40\%$**).


* **LP 2 (Late Takeover):**
Holds 10,000 LP-Tokens, redeems at final NAV 1.4 $\to$ receives **14,000 USDC**.
* *Net profit:* $14000 - 12000 = \mathbf{+2,000\text{ USDC}}$ (return rate **$16.6\%$**).



### Why Is This Distribution Absolutely Fair?

1. LP 1 got $40\%$ high return because they not only enjoyed full-event final gains but also **solely captured** the 2,000 profit from retail during their solo market-making period (first hour).
2. LP 2 got $16.6\%$ lower return because they arrived late — they can't freeload on predecessors' work. After entering, they **split equally** with LP 1 the 4,000 profit from the second half.

This NAV mechanism fully references traditional Wall Street open-end mutual fund subscription/redemption logic. It ensures that no matter how high pool turnover or how frequently LPs enter/exit, **every profit and loss from time and risk asymmetry is precisely booked to the LPs present at that moment.**
