// Based on part of source code for the paper "Converting stroked primitives to filled primitives" by Diego Nehab.
// https://github.com/diegonehab/stroke-to-fill

const EPSILON = 1e-6;
const SOLVER_ITERATIONS = 50;

function arrayOp(a1, a2, op) {
	return a1.map((e, i) => op(e, a2[i]));
}

function precomputeCombination(n, k) {
	return 2*k > n ? precomputeCombination(n, n - k)
		: k < 0 || k > n ? 0
		: k == 0 || k == n ? 1
		: (n - k + 1) * precomputeCombination(n, k - 1) / k;
}

const combinationTable = [];
for (let i = 0; i < 7; ++i) {
	const subTable = [];
	for (let j = 0; j < 7; ++j) {
		subTable.push(precomputeCombination(i, j));
	}
	combinationTable.push(subTable);
}

function combination(n, k) {
	return combinationTable[n][k];
}

function bezierDerivative(bezier) {
	const degree = bezier.length - 1;
	const derivative = [];
	for (let i = 0; i < degree; ++i) {
		derivative.push(degree * (bezier[i + 1] - bezier[i]));
	}
	return derivative;
}

// Compute a lower-degree Bezier curve, assuming the original curve is actually of a lower level.
function bezierLowerDegree(bezier) {
	const degree = bezier.length - 1;
	const lowerDegree = [bezier[0]];
	for (let i = 1; i <= degree - 2; ++i) {
		lowerDegree.push((degree * bezier[i] - i * lowerDegree[i - 1]) / (degree - 1));
	}
	lowerDegree.push(bezier[degree]);
	return lowerDegree;
}

function bezierProduct(bezierA, bezierB) {
	const bezierADegree = bezierA.length - 1;
	const bezierBDegree = bezierB.length - 1;
	const productDegree = bezierADegree + bezierBDegree;
	const product = [];
	for (let k = 0; k <= productDegree; ++k) {
		const iStart = Math.max(0, k - bezierBDegree);
		const iEnd = Math.min(bezierADegree, k);
		let sum = 0;
		for (let i = iStart; i <= iEnd; ++i) {
			sum += bezierA[i] * bezierB[k - i] * combination(bezierADegree, i) * combination(bezierBDegree, k - i);
		}
		product.push(sum / combination(productDegree, k));
	}
	return product;
}

function evaluateBezier(bezier, t) {
	const degree = bezier.length - 1;
	const u = 1 - t;
	let pt = 1;
	let c = 1;
	let p = bezier[0];
	for (let i = 1; i <= degree; ++i) {
		pt *= t;
		c = c * (degree - (i - 1)) / i;
		p = p * u + bezier[i] * c * pt;
	}
	return p;
}

function bisectInRange(f, a, b, z) {
	let m;
	for (let i = 0; i < SOLVER_ITERATIONS; ++i) {
		m = a + (b - a) / 2;
		if (m === a || m === b) return m;
		if (f(m) > z) b = m;
		else a = m;
	}
	return m;
}

function bisectBetweenPoints(f, points, z) {
	const roots = [points[0]];
	const pointCount = points.length;
	for (let i = 1; i < pointCount; ++i) {
		const a = points[i - 1];
		const b = points[i];
		const fa = f(a);
		if (Math.abs(fa - z) < EPSILON) {
			roots.push(a);
			continue;
		}
		const fb = f(b);
		if (Math.abs(fb - z) < EPSILON) {
			roots.push(b);
			continue;
		}
		if (fa < z && fb > z) roots.push(bisectInRange(f, a, b, z));
		if (fa > z && fb < z) roots.push(bisectInRange(f, b, a, z));
	}
	roots.push(points[pointCount - 1]);
	return roots;
}

function newtonInRange(f, df, a, b, z) {
	const fa = f(a);
	const fb = f(b);
	if ((fa > z && fb > z) || (fa < z && fb < z)) return null;
	if (Math.abs(fa - z) < EPSILON) return a;
	if (Math.abs(fb - z) < EPSILON) return b;
	let r0 = a;
	let r1 = b;
	if (fa >= z) {
		r0 = b;
		r1 = a;
	}
	let r = r0 + (r1 - r0) / 2;
	let oldDr = Math.abs(r1 - r0);
	let dr = oldDr;
	let fr = f(r);
	let dfr = df(r);
	for (let i = 0; i < SOLVER_ITERATIONS; ++i) {
		if (
			((r - r0) * dfr + z - fr) * ((r - r1) * dfr + z - fr) > 0
			|| Math.abs(2 * fr) > Math.abs(oldDr * dfr)
		) {
			oldDr = dr;
			dr = (r1 - r0) / 2;
			r = r0 + dr;
			if (Math.abs(r0 - r) < EPSILON) break;
		} else {
			oldDr = dr;
			dr = (z - fr) / dfr;
			r += dr;
			if (Math.abs(dr) < EPSILON) break;
		}
		if (Math.abs(dr) < EPSILON) break;
		fr = f(r);
		dfr = df(r);
		if (fr < 0) r0 = r;
		else r1 = r;
	}
	return r;
}

function newtonBetweenPoints(f, df, points, z) {
	const roots = [points[0]];
	const pointCount = points.length;
	for (let i = 1; i < pointCount; ++i) {
		const root = newtonInRange(f, df, points[i - 1], points[i], z);
		if (root !== null) roots.push(root);
	}
	roots.push(points[pointCount - 1]);
	return roots;
}

function bezierRoots(bezier, a, b, z) {
	if (bezier.length === 2) {
		const roots = [a];
		let d = bezier[1] - bezier[0];
		let n = z - bezier[0];
		const s = Math.sign(d);
		d *= s;
		n *= s;
		if (d !== 0 && n >= a*d && n <= b*d) roots.push(n / d);
		roots.push(b);
		return roots;
	} else {
		const derivative = bezierDerivative(bezier);
		return newtonBetweenPoints(
			t => evaluateBezier(bezier, t),
			t => evaluateBezier(derivative, t),
			bezierRoots(derivative, a, b, z),
			z
		);
	}
}

/*
	Find t values where the radius of curvature of the given cubic Bezier curve is equal to half the stroke width.
	The half-width s(t) varies linearly from `sa` to `sb`.

	The radius of curvature of a curve a(t) = (x(t); y(t)) is:
		r(t) = p(t)^(3:2) : q(t)
	where:
		p(t) = x'(t)² + y'(t)²
		q(t) = x'(t)y''(t) - x''(t)y'(t)
	We want to solve for r(t) = ±s(t) as r(t) can be both positive and negative.

	We have:
		r'(t) = √(p(t))(3p'(t)q(t) - 2p(t)q'(t)) : q(t)²
		s'(t) = `sb` - `sa` = C (constant)
	As √(p(t)) and q(t)² cannot be negative, r'(t) only changes sign when 3p'(t)q(t) - 2p(t)q'(t) = 0.
	However, the real equation we have to solve is r(t) ± s(t) = 0, not r(t) = ±S where S is a constant like in the
	original paper.
	Therefore, the derivative of the left side is r'(t) ± C, which seems extremely hard, if not impossible, to factor,
	and I do not have the necessary expertise to crack this.
	So the compromise is that we still find the roots of 3p'(t)q(t) - 2p(t)q'(t) = 0 to split r(t) into monotonic
	segments for bisection, instead of trying to properly split r(t) ± s(t). We might miss a few roots, but
	empirical results so far still seem usable.

	FIXME: If there are any math wizards who can either properly solve this or give an alternative method to prevent
	degenerate stroke outlines, I would appreciate your enlightenment in the issues section. Maybe it could even become
	a proper paper on approximating the vector outline of a fat curve.
*/
export function findBezierCriticalPoints(bezier, sa, sb) {
	// These functions are kept in the Bernstein basis, i.e. in the form of Bezier control points.
	const x = bezier.map(p => p[0]);
	const y = bezier.map(p => p[1]);
	const dx = bezierDerivative(x);
	const dy = bezierDerivative(y);
	const ddx = bezierDerivative(dx);
	const ddy = bezierDerivative(dy);
	const q = bezierLowerDegree(arrayOp(
		bezierProduct(dx, ddy),
		bezierProduct(dy, ddx),
		(a, b) => a - b
	));
	const dq = bezierDerivative(q);
	const p = arrayOp(
		bezierProduct(dx, dx),
		bezierProduct(dy, dy),
		(a, b) => a + b
	);
	const dp = bezierDerivative(p);
	const c = arrayOp(
		bezierProduct(dp, q),
		bezierProduct(p, dq),
		(a, b) => 1.5*a - b
	);
	const result = [];
	const criticalPoints = bezierRoots(c, 0, 1, 0);
	const s = t => sa + (sb - sa) * t;
	const tp = bisectBetweenPoints(
		t => {
			const pt = evaluateBezier(p, t);
			const qt = evaluateBezier(q, t);
			return pt**1.5 - s(t) * qt;
		},
		criticalPoints, 0
	);
	tp.pop();
	tp.shift();
	for (const t of tp) if (Math.abs(t) >= EPSILON && Math.abs(t - 1) >= EPSILON) result.push(t);
	const tn = bisectBetweenPoints(
		t => {
			const pt = evaluateBezier(p, t);
			const qt = evaluateBezier(q, t);
			return pt**1.5 + s(t) * qt;
		},
		criticalPoints, 0
	);
	tn.pop();
	tn.shift();
	for (const t of tn) if (Math.abs(t) >= EPSILON && Math.abs(t - 1) >= EPSILON) result.push(t);
	result.sort((a, b) => a - b);
	return result;
}