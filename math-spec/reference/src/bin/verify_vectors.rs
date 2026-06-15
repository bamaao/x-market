// Copyright (c) 2026 zouyc zouyccq@gmail.com.
// All rights reserved.
//
// Licensed under the Business Source License 1.1 (BSL 1.1).
// You may not use this file except in compliance with the License.
//
// Change Date: 2031-01-01
// On the Change Date, or the fourth anniversary of the first publicly available
// distribution of the code under the BSL, whichever comes first, the code
// automatically becomes available under the Apache License 2.0.

use std::fs;
use std::path::PathBuf;

use serde::Deserialize;
use x_market_math_ref as math;

#[derive(Deserialize)]
struct Vectors {
    poisson_pmf: Vec<PoissonPmfCase>,
    poisson_interval: Vec<PoissonIntervalCase>,
    poisson_tail: Vec<PoissonTailCase>,
    exp_neg: Vec<ExpNegCase>,
    dirichlet_prob: Vec<DirichletCase>,
    normal_interval: Vec<NormalCase>,
}

#[derive(Deserialize)]
struct PoissonPmfCase {
    lambda: f64,
    k: u8,
    expected: f64,
}

#[derive(Deserialize)]
struct PoissonIntervalCase {
    lambda: f64,
    a: u8,
    b: u8,
    expected: f64,
}

#[derive(Deserialize)]
struct PoissonTailCase {
    lambda: f64,
    k_min: u8,
    expected: f64,
}

#[derive(Deserialize)]
struct ExpNegCase {
    lambda: f64,
    expected: f64,
}

#[derive(Deserialize)]
struct DirichletCase {
    alphas: Vec<f64>,
    i: usize,
    expected: f64,
}

#[derive(Deserialize)]
struct NormalCase {
    mu: f64,
    sigma: f64,
    a: f64,
    b: f64,
    expected: f64,
}

fn main() {
    let path = std::env::args()
        .nth(1)
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("../test-vectors.json"));

    let raw = fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
    let v: Vectors = serde_json::from_str(&raw).expect("parse test-vectors.json");

    let tol = 1e-9;
    let mut failed = 0u32;

    for c in &v.poisson_pmf {
        let got = math::poisson_pmf(c.lambda, c.k);
        if !approx_eq(got, c.expected, tol) {
            eprintln!("FAIL poisson_pmf λ={} k={}: got {got}, want {}", c.lambda, c.k, c.expected);
            failed += 1;
        }
    }

    for c in &v.poisson_interval {
        let got = math::poisson_interval(c.lambda, c.a, c.b);
        if !approx_eq(got, c.expected, tol) {
            eprintln!(
                "FAIL poisson_interval λ={} [{},{}]: got {got}, want {}",
                c.lambda, c.a, c.b, c.expected
            );
            failed += 1;
        }
    }

    for c in &v.poisson_tail {
        let got = math::poisson_tail(c.lambda, c.k_min);
        if !approx_eq(got, c.expected, tol) {
            eprintln!(
                "FAIL poisson_tail λ={} k_min={}: got {got}, want {}",
                c.lambda, c.k_min, c.expected
            );
            failed += 1;
        }
    }

    for c in &v.exp_neg {
        let got = math::exp_neg_lut(c.lambda);
        if !approx_eq(got, c.expected, 5e-4) {
            eprintln!("FAIL exp_neg_lut λ={}: got {got}, want {}", c.lambda, c.expected);
            failed += 1;
        }
    }

    for c in &v.dirichlet_prob {
        let got = math::dirichlet_prob(&c.alphas, c.i);
        if !approx_eq(got, c.expected, tol) {
            eprintln!("FAIL dirichlet_prob i={}: got {got}, want {}", c.i, c.expected);
            failed += 1;
        }
    }

    for c in &v.normal_interval {
        let got = math::normal_interval(c.mu, c.sigma, c.a, c.b);
        if !approx_eq(got, c.expected, 1e-6) {
            eprintln!(
                "FAIL normal_interval μ={} σ={} [{},{}]: got {got}, want {}",
                c.mu, c.sigma, c.a, c.b, c.expected
            );
            failed += 1;
        }
    }

    if failed > 0 {
        eprintln!("\n{failed} vector(s) failed");
        std::process::exit(1);
    }

    println!("All test vectors passed ({})", path.display());
}

fn approx_eq(a: f64, b: f64, tol: f64) -> bool {
    (a - b).abs() <= tol
}
