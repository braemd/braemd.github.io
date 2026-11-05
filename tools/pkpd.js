// PKPD model and OptiDose-style dose optimiser, running entirely in the browser.
//
// PK: one compartment, first-order absorption with lag time, linear elimination.
// PD: indirect response, inhibition of production:
//     dR/dt = kin * (1 - Imax * C / (C + IC50)) - kout * R,  kin = R0 * kout
//
// Units: dose mg, concentration mg/L, time h.

export const defaultParams = {
  tlag: 0.91995867706076,
  ka: 1.40450348840306,
  V: 7.89272638535945,
  CL: 0.133514721223596,
  R0: 96.5324897552223,
  kout: 0.0542159433196799,
  Imax: 0.995999660996867,
  IC50: 1.15221671864975
};

// Concentration at time t for doses of size `dose` given at `doseTimes` (superposition)
export function concentration(t, dose, doseTimes, p) {
  const k = p.CL / p.V;
  let c = 0;
  for (const td of doseTimes) {
    const s = t - td - p.tlag;
    if (s > 0) {
      c += (dose * p.ka) / (p.V * (p.ka - k)) * (Math.exp(-k * s) - Math.exp(-p.ka * s));
    }
  }
  return c;
}

// Simulate concentration and PD response on a fixed grid (RK4 for the PD ODE)
export function simulate(dose, regimen, p, tEnd, dt = 0.1) {
  const doseTimes = Array.from({ length: regimen.nDoses }, (_, i) => i * regimen.interval);
  const kin = p.R0 * p.kout;
  const dR = (t, R) => {
    const c = concentration(t, dose, doseTimes, p);
    return kin * (1 - (p.Imax * c) / (c + p.IC50)) - p.kout * R;
  };
  const n = Math.round(tEnd / dt);
  const time = new Float64Array(n + 1);
  const conc = new Float64Array(n + 1);
  const resp = new Float64Array(n + 1);
  let R = p.R0;
  for (let i = 0; i <= n; i++) {
    const t = i * dt;
    time[i] = t;
    conc[i] = concentration(t, dose, doseTimes, p);
    resp[i] = R;
    if (i < n) {
      const k1 = dR(t, R);
      const k2 = dR(t + dt / 2, R + (dt / 2) * k1);
      const k3 = dR(t + dt / 2, R + (dt / 2) * k2);
      const k4 = dR(t + dt, R + dt * k3);
      R += (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    }
  }
  return { time, conc, resp, dt };
}

// Trapezoidal integral of f(i) over grid points whose time lies in [from, to]
function integrate(sim, from, to, f) {
  let sum = 0;
  for (let i = 1; i < sim.time.length; i++) {
    const t0 = sim.time[i - 1], t1 = sim.time[i];
    if (t0 >= from && t1 <= to) sum += ((f(i - 1) + f(i)) / 2) * (t1 - t0);
  }
  return sum;
}

// OptiDose-style objective: a heavily weighted constraint penalty plus a weak
// secondary target that makes the optimum unique.
//   pd_min:   response must not fall below threshold  -> prefer high exposure
//   cmax_max: concentration must not exceed threshold -> prefer high exposure
//   auc_mic:  AUC(window) / MIC must reach threshold  -> prefer low exposure
export function objective(sim, target) {
  const { type, threshold, from, to } = target;
  const aucAll = integrate(sim, from, to, (i) => sim.conc[i]);
  let constraint, secondary;
  if (type === "pd_min") {
    constraint = integrate(sim, from, to, (i) => Math.max(0, threshold - sim.resp[i]));
    secondary = Math.exp(-0.01 * aucAll);
  } else if (type === "cmax_max") {
    constraint = integrate(sim, from, to, (i) => Math.max(0, sim.conc[i] - threshold));
    secondary = Math.exp(-0.01 * aucAll);
  } else if (type === "auc_mic") {
    constraint = Math.max(0, threshold - aucAll / target.mic);
    secondary = 1 - Math.exp(-0.01 * aucAll);
  } else {
    throw new Error(`Unknown target type: ${type}`);
  }
  return { value: 100 * constraint + secondary, constraint, secondary };
}

// Summary measures used to report whether a dose meets the target
export function metrics(sim, target) {
  const { from, to } = target;
  let minR = Infinity, cmax = 0, tmax = 0;
  for (let i = 0; i < sim.time.length; i++) {
    const t = sim.time[i];
    if (t < from || t > to) continue;
    if (sim.resp[i] < minR) minR = sim.resp[i];
    if (sim.conc[i] > cmax) { cmax = sim.conc[i]; tmax = t; }
  }
  const auc = integrate(sim, from, to, (i) => sim.conc[i]);
  return { minR, cmax, tmax, auc, aucMic: target.mic ? auc / target.mic : NaN };
}

// Grid scan to locate the basin of the minimum, then golden-section refinement.
export function optimiseDose(regimen, p, target, tEnd, doseMax, nGrid = 120) {
  const f = (d) => objective(simulate(d, regimen, p, tEnd), target).value;
  const grid = Array.from({ length: nGrid + 1 }, (_, i) => (i * doseMax) / nGrid);
  const values = grid.map(f);
  let iBest = 0;
  for (let i = 1; i < values.length; i++) if (values[i] < values[iBest]) iBest = i;

  let a = grid[Math.max(0, iBest - 1)], b = grid[Math.min(nGrid, iBest + 1)];
  const g = (Math.sqrt(5) - 1) / 2;
  let c = b - g * (b - a), d = a + g * (b - a);
  let fc = f(c), fd = f(d);
  for (let it = 0; it < 60 && b - a > 1e-4; it++) {
    if (fc < fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = f(c); }
    else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = f(d); }
  }
  const dose = (a + b) / 2;
  return {
    dose,
    landscape: grid.map((x, i) => ({ dose: x, objective: values[i] })),
    atBound: iBest === nGrid
  };
}
