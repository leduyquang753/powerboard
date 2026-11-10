import {Bezier} from "bezier-js";

import {findBezierCriticalPoints} from "./BezierCriticalPointFinder.js";

const DISCONNECTION_THRESHOLD = 1e-6;
const COLLINEAR_THRESHOLD = 1e-6;

function bezierBeginTangent(bezier) {
	const points = bezier.points;
	for (let i = 1; i < 4; ++i) {
		const dx = points[i].x - points[0].x;
		const dy = points[i].y - points[0].y;
		const length = Math.sqrt(dx * dx + dy * dy);
		if (length !== 0) return [dx / length, dy / length];
	}
	return [0, 1];
}

function bezierEndTangent(bezier) {
	const points = bezier.points;
	for (let i = 2; i >= 0; --i) {
		const dx = points[3].x - points[i].x;
		const dy = points[3].y - points[i].y;
		const length = Math.sqrt(dx * dx + dy * dy);
		if (length !== 0) return [dx / length, dy / length];
	}
	return [0, 1];
}

function normalVector(vector) {
	return [-vector[1], vector[0]];
}

function solveQuadratic(a, b, c) {
	if (a === 0) return b === 0 ? [] : [-c/b];
	const d = b*b - 4*a*c;
	if (d < 0) return [];
	if (d === 0) return [b / a / -2];
	const sqrtD = Math.sqrt(d);
	return [(b + sqrtD) / a / -2, (b - sqrtD) / a / -2];
}

function pointsAreCollinear(a, b, c) {
	const dx1 = b.x - a.x;
	const dy1 = b.y - a.y;
	const dx2 = c.x - a.x;
	const dy2 = c.y - a.y;
	// Magnitude of cross product is very small compared to absolute value of dot product.
	return Math.abs(dx1*dy2 - dy1*dx2) / Math.abs(dx1*dy1 + dx2*dy2) < COLLINEAR_THRESHOLD;
}

// When the cubic Bezier curve is approximately a straight line (all control points are collinear), find t values where
// the curve changes direction.
function findStraightLineTurns(points) {
	if (!pointsAreCollinear(points[0], points[1], points[2]) || !pointsAreCollinear(points[1], points[2], points[3]))
		return [];
	const [a, b, c, d] = Math.abs(points[3].x - points[0].x) > Math.abs(points[3].y - points[0].y)
		? points.map(p => p.x)
		: points.map(p => p.y);
	const ba = b - a;
	const cb = c - b;
	const dc = d - c;
	// Solve for B'(t) = 3(1 - t)²(b - a) + 6(1 - t)t(c - b) + 3t²(d - c) = 0.
	return solveQuadratic(
		3*ba - 6*cb + 3*dc,
		-6*ba + 6*cb,
		3*ba
	).filter(t => t > 0 && t < 1);
}

const add = (x,y) => x.map((e,i)=>e+y[i]);
const sub = (x,y) => x.map((e,i)=>e-y[i]);
const mul = (x,s) => x.map(e=>e*s);
const dot = (x,y) => x.map((e,i)=>e*y[i]).reduce((s,t)=>s+t);
const dist2 = (x,y) => x.map((e,i)=>(e-y[i])**2).reduce((a,b)=>a+b);
const midp = (x,y) => x.map((e,i)=>(e+y[i])/2);
const cross = (x,y) => x[0]*y[1] - x[1]*y[0];
const mirror = (x,across) => across.map((e,i)=>2*e-x[i]);
const hodograph = b => b.slice(1).map((e,i) => mul(sub(e,b[i]),b.length-1));

function deCasteljauSplit(bezier) {
	const n = bezier.length - 1;
	const back = Array(bezier.length);
	back[n] = bezier[n];
	for (let i = 1; i <= n; ++i) {
		for (let j = n; j >= i; --j) {
			bezier[j] = midp(bezier[j], bezier[j-1]);
		}
		back[n-i] = bezier[n];
	}
	return back;
}

function convexHullContainsOrigin(pts) {
	let l = false, r = false;
	for(let low of pts)
		if (low[1] < 0) {
			for(let high of pts) if (high[1] > 0) {
				const x = cross(low,high);
				l |= x <= 0;
				r |= x >= 0;
			}
		} else if (low[1] == 0) {
			l |= low[0] <= 0;
			r |= low[0] >= 0;
		}
	return l && r;
}

function minimizeStrainHermite(p0,v0,v1,p1) {
	// See https://doi.org/10.1016/j.cagd.2003.08.003
	// input: cubic hermite polynomial: endpoints and tangent directions
	// output: scalars to multiply v0 and v1 by to minimize strain
	let p10 = sub(p1,p0);
	let v00 = dot(v0,v0), v11 = dot(v1,v1), v01 = dot(v0,v1), pv0 = dot(p10,v0), pv1 = dot(p10,v1);
	let a0 = (6*pv0*v11 - 3*pv1*v01) / (4*v00*v11 - v01**2);
	let a1 = (6*pv1*v00 - 3*pv0*v01) / (4*v00*v11 - v01**2);
	return [a0,a1];
}

function minimizeStrainBezier(p0,pa,pb,p1) {
	// input: cubic Bézier control points
	// output: adjusted p1,p2 to minimize strain
	let v0 = sub(pa,p0), v1=sub(pb,p1);
	let [a0,a1] = minimizeStrainHermite(p0,v0,v1,p1);
	return [add(p0,mul(v0, Math.abs(a0)/3)), add(p1, mul(v1, Math.abs(a1)/3))]
}

function getSidePointsAndDerivatives(xyr, h) {
	const n = xyr.length-1;
	// points
	const H = [h[0],h[n-1]]
	const a = H.map(e=>e.slice(0,2));
	const ell = a.map(e=>dot(e,e));
	const Hr2 = H.map(e=>e[2]**2);
	const bad = ell.map((e,i) => e==0 || e<Hr2[i]);
	if (bad[0]) ell[0] = Hr2[0]+0.001;
	if (bad[1]) ell[1] = Hr2[1]+0.001;
	const p = [xyr[0], xyr[n]].map(e=>e.slice(0,2));
	const r = [xyr[0], xyr[n]].map(e=>e[2]);
	const s = a.map(e=>[-e[1], e[0]]);
	const am = H.map((e,i)=>-e[2]/ell[i]);
	const sm = ell.map((e,i)=>(e - Hr2[i])**0.5/e);

	// build the result
	const p_a = p.map((e,i)=>add(e, mul(a[i], am[i]*r[i])));
	const ss = s.map((e,i)=>mul(e,	sm[i]*r[i]));
	const pts = p_a.map((e,i)=>[add(e, ss[i]), sub(e, ss[i])]);

	// non-normalized derivatives: perpendicular of vector to circle centers
	const deriv = pts.map((end,i) => end.map(pt => sub(pt,p[i])).map(w=>[-w[1],w[0]]))

	// remove bad data
	if (bad[0]) { pts[0] = false; deriv[0] = false; }
	if (bad[1]) { pts[1] = false; deriv[0] = false; }

	// scale derivatives to minimize strain
	if (!bad[0] && !bad[1]) {
		for(let side=0; side<2; side+=1) {
			let [a0,a1] = minimizeStrainHermite(pts[0][side], deriv[0][side], deriv[1][side], pts[1][side]);
			deriv[0][side] = mul(deriv[0][side], a0/3);
			deriv[1][side] = mul(deriv[1][side], a1/3);
		}
	}

	return [pts,deriv] // [[[left,right],[left,right]], [[dleft,dright],[dleft,dright]]]
}

function processIntoSubsegments(segment, halfStrokeSize) {
	const bezier = segment.bezier;
	const startSize = halfStrokeSize * segment.startWeight;
	const endSize = halfStrokeSize * segment.endWeight;
	let xyr = [
		[bezier.points[0].x, bezier.points[0].y, startSize],
		[bezier.points[1].x, bezier.points[1].y, startSize + (endSize - startSize) / 3],
		[bezier.points[2].x, bezier.points[2].y, endSize - (endSize - startSize) / 3],
		[bezier.points[3].x, bezier.points[3].y, endSize]
	];
	const bq = [];
	const pendingIntervals = [];
	let h = hodograph(xyr);
	let [[p,q],[hp,hq]] = getSidePointsAndDerivatives(xyr, h);
	let gap = Math.max(xyr[0][2], xyr[3][2])**2;
	let tipgap = gap / 5**2;

	const ll = [];
	const rl = [];
	const intervals = [];
	if (p) {
		ll.push([p[0]]);
		rl.push([p[1]]);
		intervals.push([0]);
	}

	let tStart = 0;
	let tEnd = 1;
	while(true) {
		let advance = true;
		if (Math.max(...h.map(e => dot(e,e))) > gap) { // large motion, force recursion
			advance = false;
		} else if (!p && q && dist2(q[0],q[1]) < tipgap) {
			// open a segment
			ll.push(null, [q[0]]);
			rl.push(null, [q[1]]);
			intervals.push(null, [tEnd, null]);
		} else if (!q && p && dist2(p[0], p[1]) < tipgap) {
			// close a segment (nothing to do)
		} else if (!p && !q) {
			// between intervals (no work needed)
		} else if (convexHullContainsOrigin(h)) {
			if (Math.max(...h.map(e => dot(e,e))) < 0.5) { // 0.5 for "half a pixel"; maybe change?
				// found bowtie
				if (q) { // open a segment
					ll.push(null, [q[0]]);
					rl.push(null, [q[1]]);
					intervals.push(null, [tEnd, null]);
				}
			} else {
				advance = false;
			}
		} else if (p && q && dist2(p[0],q[0]) < gap && dist2(p[1],q[1]) < gap) {
			ll[ll.length-1].push(add(p[0],hp[0]));
			ll[ll.length-1].push(sub(q[0],hq[0])); // add tangent
			ll[ll.length-1].push(q[0]); // extend segment
			rl[rl.length-1].push(add(p[1],hp[1]));
			rl[rl.length-1].push(sub(q[1],hq[1])); // add tangent
			rl[rl.length-1].push(q[1]); // extend segment
			intervals[intervals.length - 1][1] = tEnd;
		} else { // too big a gap; subdivide
			advance = false;
		}
		if (advance) {
			if (!bq.length) break;
			xyr = bq.pop();
			[tStart, tEnd] = pendingIntervals.pop();
			h = hodograph(xyr);
			[[p,q],[hp,hq]] = getSidePointsAndDerivatives(xyr, h);
			gap = Math.max(xyr[0][2], xyr[3][2])**2;
			tipgap = gap / 5**2;
		} else { // subdivide
			bq.push(deCasteljauSplit(xyr));
			const tMiddle = tStart + (tEnd - tStart) / 2;
			pendingIntervals.push([tMiddle, tEnd]);
			tEnd = tMiddle;
			h = hodograph(xyr);
			[[p,q],[hp,hq]] = getSidePointsAndDerivatives(xyr, h);
		}
	}
	if (!q) {
		ll.push(null);
		rl.push(null);
		intervals.push(null);
	}
	const subsegments = [];
	for (let i = 0; i < intervals.length; ++i) {
		const interval = intervals[i];
		if (interval === null || interval[1] === null) {
			subsegments.push(null);
			continue;
		}
		const [startT, endT] = interval;
		const forwardPoints = ll[i];
		const reversePoints = rl[i];
		const subBezier = bezier.split(startT, endT);
		const startOffset = (segment.startWeight + (segment.endWeight - segment.startWeight) * startT) * halfStrokeSize;
		const endOffset = (segment.startWeight + (segment.endWeight - segment.startWeight) * endT) * halfStrokeSize;
		let forwardPath = "C";
		for (let j = 1; j < forwardPoints.length; ++j)
			forwardPath += ` ${forwardPoints[j][0]} ${forwardPoints[j][1]}`;
		let reversePath = "C";
		for (let j = reversePoints.length - 2; j >= 0; --j)
			reversePath += ` ${reversePoints[j][0]} ${reversePoints[j][1]}`;
		const subBezierBoundingBox = subBezier.bbox();
		const halfMaxOffset = Math.max(startOffset, endOffset) / 2;
		subsegments.push({
			bezier: subBezier,
			startOffset, endOffset, forwardPath, reversePath,
			boundingBox: {
				minX: subBezierBoundingBox.x.min - halfMaxOffset,
				minY: subBezierBoundingBox.y.min - halfMaxOffset,
				maxX: subBezierBoundingBox.x.max + halfMaxOffset,
				maxY: subBezierBoundingBox.y.max + halfMaxOffset
			}
		});
	}
	return subsegments;
}

function updateBoundingBox(current, incomingMinX, incomingMinY, incomingMaxX, incomingMaxY) {
	current.minX = Math.min(current.minX, incomingMinX);
	current.minY = Math.min(current.minY, incomingMinY);
	current.maxX = Math.max(current.maxX, incomingMaxX);
	current.maxY = Math.max(current.maxY, incomingMaxY);
}

function generateOutlineAndBoundingBoxForProcessedSegments(segments, halfStrokeSize) {
	const segmentCount = segments.length;
	const firstSegment = segments[0];
	const firstSegmentPoints = firstSegment.bezier.points;
	const firstTangent = bezierBeginTangent(firstSegment.bezier);
	const firstNormal = normalVector(firstTangent);
	const firstOffset = firstSegment.startOffset;
	let pathString
		= `M${firstSegmentPoints[0].x - firstNormal[0] * firstOffset}`
		+ ` ${firstSegmentPoints[0].y - firstNormal[1] * firstOffset}`
		+ `A${firstOffset} ${firstOffset} 0 0 0`
		+ ` ${firstSegmentPoints[0].x - firstTangent[0] * firstOffset}`
		+ ` ${firstSegmentPoints[0].y - firstTangent[1] * firstOffset}`
		+ `A${firstOffset} ${firstOffset} 0 0 0`
		+ ` ${firstSegmentPoints[0].x + firstNormal[0] * firstOffset}`
		+ ` ${firstSegmentPoints[0].y + firstNormal[1] * firstOffset}`;
	for (const segment of segments) pathString += segment.forwardPath;
	const lastSegment = segments[segmentCount - 1];
	const lastSegmentPoints = lastSegment.bezier.points;
	const lastTangent = bezierEndTangent(lastSegment.bezier);
	const lastNormal = normalVector(lastTangent);
	const lastOffset = lastSegment.endOffset;
	pathString
		+= `A${lastOffset} ${lastOffset} 0 0 0`
		+ ` ${lastSegmentPoints[3].x + lastTangent[0] * lastOffset}`
		+ ` ${lastSegmentPoints[3].y + lastTangent[1] * lastOffset}`
		+ `A${lastOffset} ${lastOffset} 0 0 0`
		+ ` ${lastSegmentPoints[3].x - lastNormal[0] * lastOffset}`
		+ ` ${lastSegmentPoints[3].y - lastNormal[1] * lastOffset}`;
	for (let i = segmentCount - 1; i >= 0; --i) pathString += segments[i].reversePath;
	pathString += "Z";

	const boundingBox = {...segments[0].boundingBox};
	for (let i = 1; i < segmentCount; ++i) {
		const segmentBoundingBox = segments[i].boundingBox;
		updateBoundingBox(
			boundingBox,
			segmentBoundingBox.minX, segmentBoundingBox.minY,
			segmentBoundingBox.maxX, segmentBoundingBox.maxY
		);
	}
	return {pathString, boundingBox};
}

function processSubsegment(segment, halfStrokeSize, startT, endT) {
	const bezier = segment.bezier.split(startT, endT);
	const startOffset = (segment.startWeight + (segment.endWeight - segment.startWeight) * startT) * halfStrokeSize;
	const endOffset = (segment.startWeight + (segment.endWeight - segment.startWeight) * endT) * halfStrokeSize;

	const firstPoint = bezier.points[0];
	const lastPoint = bezier.points[3];
	let boundingBox = {
		minX: firstPoint.x - halfStrokeSize,
		minY: firstPoint.y - halfStrokeSize,
		maxX: firstPoint.x + halfStrokeSize,
		maxY: firstPoint.y + halfStrokeSize
	};
	updateBoundingBox(
		boundingBox,
		lastPoint.x - halfStrokeSize,
		lastPoint.y - halfStrokeSize,
		lastPoint.x + halfStrokeSize,
		lastPoint.y + halfStrokeSize
	);


	let forwardPath = "";
	let lastT = 0;
	for (const subcurve of bezier.reduce()) {
		const subcurveStartOffset = startOffset + (endOffset - startOffset) * subcurve._t1;
		const subcurveEndOffset = startOffset + (endOffset - startOffset) * subcurve._t2;
		const offsetPoints
			= subcurve.scale(t => subcurveStartOffset + (subcurveEndOffset - subcurveStartOffset) * t).points;
		// `bezier.reduce()` may have missing segments. Recover from those situations by drawing a straight line
		// as a substitute for the offset segment of those missing segments.
		if (Math.abs(subcurve._t1 - lastT) > DISCONNECTION_THRESHOLD)
			forwardPath += `L${offsetPoints[0].x} ${offsetPoints[0].y}`;
		forwardPath
			+= `C${offsetPoints[1].x} ${offsetPoints[1].y}`
			+ ` ${offsetPoints[2].x} ${offsetPoints[2].y}`
			+ ` ${offsetPoints[3].x} ${offsetPoints[3].y}`;
		const subBoundingBox = subcurve.bbox();
		updateBoundingBox(
			boundingBox,
			subBoundingBox.x.min - halfStrokeSize,
			subBoundingBox.y.min - halfStrokeSize,
			subBoundingBox.x.max - halfStrokeSize,
			subBoundingBox.y.max - halfStrokeSize
		);
		lastT = subcurve._t2;
	}
	if (lastT !== 1) {
		const endPoint = bezier.points[3];
		const endNormal = normalVector(bezierEndTangent(bezier));
		forwardPath += `L${endPoint.x + endNormal[0] * endOffset} ${endPoint.y + endNormal[1] * endOffset}`;
	}
	const reverseBezier = new Bezier(...bezier.points.toReversed().map(p => ({x: p.x, y: p.y})));
	let reversePath = "";
	lastT = 0;
	for (const subcurve of reverseBezier.reduce()) {
		const subcurveStartOffset = endOffset + (startOffset - endOffset) * subcurve._t1;
		const subcurveEndOffset = endOffset + (startOffset - endOffset) * subcurve._t2;
		const offsetPoints
			= subcurve.scale(t => subcurveStartOffset + (subcurveEndOffset - subcurveStartOffset) * t).points;
		if (Math.abs(subcurve._t1 - lastT) > DISCONNECTION_THRESHOLD)
			reversePath += `L${offsetPoints[0].x} ${offsetPoints[0].y}`;
		reversePath
			+= `C${offsetPoints[1].x} ${offsetPoints[1].y}`
			+ ` ${offsetPoints[2].x} ${offsetPoints[2].y}`
			+ ` ${offsetPoints[3].x} ${offsetPoints[3].y}`;
		const subBoundingBox = subcurve.bbox();
		updateBoundingBox(
			boundingBox,
			subBoundingBox.x.min - halfStrokeSize,
			subBoundingBox.y.min - halfStrokeSize,
			subBoundingBox.x.max - halfStrokeSize,
			subBoundingBox.y.max - halfStrokeSize
		);
		lastT = subcurve._t2;
	}
	if (lastT !== 1) {
		const endPoint = reverseBezier.points[3];
		const endNormal = normalVector(bezierEndTangent(bezier));
		reversePath += `L${endPoint.x - endNormal[0] * startOffset} ${endPoint.y - endNormal[1] * startOffset}`;
	}
	return {bezier, startOffset, endOffset, forwardPath, reversePath, boundingBox};
}

export function generateOutlineAndBoundingBox(stroke) {
	const halfStrokeSize = stroke.size / 2;
	const spline = stroke.spline;
	if (stroke.isSimple) {
		const points = stroke.basePath;
		if (points.length === 1) {
			const point = points[0];
			const radius = point[2] * halfStrokeSize;
			return {
				pathString: `M${point[0]} ${point[1] - radius}`
					+ `A${radius} ${radius} 0 0 0 ${point[0]} ${point[1] + radius}`
					+ `A${radius} ${radius} 0 0 0 ${point[0]} ${point[1] - radius}`
					+ `Z`,
				minX: point[0] - radius,
				minY: point[1] - radius,
				maxX: point[0] + radius,
				maxY: point[1] + radius
			};
		} else if (points.length === 2) {
			const dx = points[1][0] - points[0][0];
			const dy = points[1][1] - points[0][1];
			const length = Math.sqrt(dx * dx + dy * dy);
			const normal = [-dy / length, dx / length];
			const startOffset = points[0][2] * halfStrokeSize;
			const endOffset = points[1][2] * halfStrokeSize;
			const firstPointSmaller = points[0][2] < points[1][2];
			return {
				pathString: `M${points[0][0] + normal[0] * startOffset} ${points[0][1] + normal[1] * startOffset}`
					+ `L${points[1][0] + normal[0] * endOffset} ${points[1][1] + normal[1] * endOffset}`
					+ `A${endOffset} ${endOffset} 0 ${firstPointSmaller ? 1 : 0} 0`
					+ ` ${points[1][0] - normal[0] * endOffset} ${points[1][1] - normal[1] * endOffset}`
					+ `L${points[0][0] - normal[0] * startOffset} ${points[0][1] - normal[1] * startOffset}`
					+ `A${startOffset} ${startOffset} 0 ${firstPointSmaller ? 0 : 1} 0`
					+ ` ${points[0][0] + normal[0] * startOffset} ${points[0][1] + normal[1] * startOffset}`
					+ `Z`,
				minX: Math.min(points[0][0] - startOffset, points[1][0] - endOffset),
				minY: Math.min(points[0][1] - startOffset, points[1][1] - endOffset),
				maxX: Math.max(points[0][0] + startOffset, points[1][0] + endOffset),
				maxY: Math.max(points[0][1] + startOffset, points[1][1] + endOffset)
			};
		} else {
			throw new Error("Supposedly \"simple\" stroke has too many points.");
		}
		return;
	}
	for (const segment of spline) {
		if ("processed" in segment) continue;
		const processed = [];
		const {bezier, startWeight, endWeight} = segment;
		const startOffset = startWeight * halfStrokeSize;
		const endOffset = endWeight * halfStrokeSize;
		// If this happens, chances are the current and previous segments make a sharp turn.
		// Render them separately to reduce ugly artifacts.
		if (bezier.points[0].x === bezier.points[1].x && bezier.points[0].y === bezier.points[1].y)
			processed.push(null);
		for (const subsegment of processIntoSubsegments(segment, halfStrokeSize)) {
			if (subsegment === null) {
				if (processed.length !== 0 && processed[processed.length - 1] !== null) processed.push(null);
			} else {
				processed.push(subsegment);
			}
		}
		// Handle possible sharp turn between the current and next segments.
		if (bezier.points[2].x === bezier.points[3].x && bezier.points[2].y === bezier.points[3].y)
			processed.push(null);
		segment.processed = processed;
	}
	let pathString = "";
	let boundingBox = null;
	let pendingSubsegments = [];
	for (const segment of spline) {
		for (const subsegment of segment.processed) {
			if (subsegment === null) {
				if (pendingSubsegments.length !== 0) {
					const subdata
						= generateOutlineAndBoundingBoxForProcessedSegments(pendingSubsegments, halfStrokeSize);
					pathString += subdata.pathString;
					const subBoundingBox = subdata.boundingBox;
					if (boundingBox === null) boundingBox = {...subBoundingBox};
					else updateBoundingBox(
						boundingBox,
						subBoundingBox.minX,
						subBoundingBox.minY,
						subBoundingBox.maxX,
						subBoundingBox.maxY
					);
					pendingSubsegments = [];
				}
			} else {
				pendingSubsegments.push(subsegment);
			}
		}
	}
	if (pendingSubsegments.length !== 0) {
		const subdata
			= generateOutlineAndBoundingBoxForProcessedSegments(pendingSubsegments, halfStrokeSize);
		pathString += subdata.pathString;
		const subBoundingBox = subdata.boundingBox;
		if (boundingBox === null) boundingBox = {...subBoundingBox};
		else updateBoundingBox(
			boundingBox,
			subBoundingBox.minX,
			subBoundingBox.minY,
			subBoundingBox.maxX,
			subBoundingBox.maxY
		);
	}
	if (pathString.length === 0) {
		const fallbackStroke = {...stroke, isSimple: true, basePath: stroke.basePath.slice(0, 2)};
		return generateOutlineAndBoundingBox(fallbackStroke);
	}
	return {pathString, ...boundingBox};
}