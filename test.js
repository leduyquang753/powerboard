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

function approx5(xyr) {
	const bq = [];
	let h = hodograph(xyr);
	let [[p,q],[hp,hq]] = getSidePointsAndDerivatives(xyr, h);
	let gap = Math.max(xyr[0][2], xyr[3][2])**2;
	let tipgap = gap / 5**2;

	const ll = [];
	const rl = [];
	const segments = [];
	const discontinuity = [!p];
	if (p) {
		ll.push([p[0]]);
		rl.push([p[1]]);
	}

	while(true) {
		let advance = true;
		if (Math.max(...h.map(e => dot(e,e))) > gap) { // large motion, force recursion
			advance = false;
		} else if (!p && q && dist2(q[0],q[1]) < tipgap) {
			// open a segment
			ll.push([q[0]]);
			rl.push([q[1]]);
			discontinuity.push(true);
		} else if (!q && p && dist2(p[0], p[1]) < tipgap) {
			// close a segment (nothing to do)
		} else if (!p && !q) {
			// between segments (no work needed)
		} else if (convexHullContainsOrigin(h)) {
			if (Math.max(...h.map(e => dot(e,e))) < 0.5) { // 0.5 for "half a pixel"; maybe change?
				// found bowtie
				if(q) { // open a segment
					ll.push([q[0]]);
					rl.push([q[1]]);
					discontinuity.push(true);
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
			segments.push(xyr);
			if ((ll[ll.length-1].length%3) != 1) throw Error(JSON.stringify(ll[ll.length-1]) + ll[ll.length-1].length)
		} else { // too big a gap; subdivide
			advance = false;
		}
		if (advance) {
			if (!bq.length) break;
			xyr = bq.pop();
			h = hodograph(xyr);
			[[p,q],[hp,hq]] = getSidePointsAndDerivatives(xyr, h);
			gap = Math.max(xyr[0][2], xyr[3][2])**2;
			tipgap = gap / 5**2;
		} else { // subdivide
			bq.push(deCasteljauSplit(xyr));
			h = hodograph(xyr);
			[[p,q],[hp,hq]] = getSidePointsAndDerivatives(xyr, h);
			discontinuity.push(!p);
		}
	}
	if ((ll[0].length%3) != 1) throw Error(JSON.stringify(ll[0]) + ll[0].length)
	if ((ll[ll.length-1].length%3) != 1) throw Error(JSON.stringify(ll[ll.length-1]) + ll[ll.length-1].length)

	let forwardPath = "";
	let reversePath = "";
	const ans = []
	for(let i=0; i<ll.length; i+=1) if (ll[i].length > 1) { // if needed because bowtie might be followed by empty
		const si = ans.length;
		ans.push('M', ll[i][0])
		for(let j=1; j+2<ll[i].length; j+=3) ans.push('C',ll[i][j],ll[i][j+1],ll[i][j+2]);
		rl[i].reverse()
		let bridge = [ans[ans.length-1], mirror(ans[ans.length-2],ans[ans.length-1]), mirror(rl[i][1],rl[i][0]), rl[i][0]]
		let newmid = minimizeStrainBezier(...bridge)
		ans.push('C', newmid[0], newmid[1], bridge[3])
		for(let j=1; j+2<rl[i].length; j+=3) ans.push('C',rl[i][j],rl[i][j+1],rl[i][j+2]);
		bridge = [ans[ans.length-1], mirror(ans[ans.length-2],ans[ans.length-1]), mirror(ans[si+3],ans[si+1]), ans[si+1]]
		newmid = minimizeStrainBezier(...bridge)
		ans.push('C', newmid[0], newmid[1], bridge[3])
		ans.push('Z')
	}
	let segmentString = "";
	for (const segment of segments) segmentString
		+= `M ${segment[0][0]} ${segment[0][1]} `
		+ `C ${segment[1][0]} ${segment[1][1]} `
		+ `${segment[2][0]} ${segment[2][1]} `
		+ `${segment[3][0]} ${segment[3][1]}`;
	return {
		path: ans.join(' '),
		segmentString,
		discontinuity
	};
}

function split(xyr) {
	const bq = [];
	const pendingSegmentStack = [];
	let h = hodograph(xyr);
	let [[p,q],[hp,hq]] = getSidePointsAndDerivatives(xyr, h);
	let gap = Math.max(xyr[0][2], xyr[3][2])**2;
	let tipgap = gap / 5**2;

	const segments = [];
	if (p) segments.push([0]);

	let tStart = 0;
	let tEnd = 1;
	while(true) {
		let advance = true;
		if (Math.max(...h.map(e => dot(e,e))) > gap) { // large motion, force recursion
			advance = false;
		} else if (!p && q && dist2(q[0],q[1]) < tipgap) {
			// open a segment
			segments.push(null, [tEnd, null]);
		} else if (!q && p && dist2(p[0], p[1]) < tipgap) {
			// close a segment (nothing to do)
		} else if (!p && !q) {
			// between segments (no work needed)
		} else if (convexHullContainsOrigin(h)) {
			if (Math.max(...h.map(e => dot(e,e))) < 0.5) { // 0.5 for "half a pixel"; maybe change?
				// found bowtie
				if(q) { // open a segment
					segments.push(null, [tEnd, null]);
				}
			} else {
				advance = false;
			}
		} else if (p && q && dist2(p[0],q[0]) < gap && dist2(p[1],q[1]) < gap) {
			segments[segments.length - 1][1] = tEnd;
		} else { // too big a gap; subdivide
			advance = false;
		}
		if (advance) {
			if (!bq.length) break;
			xyr = bq.pop();
			[tStart, tEnd] = pendingSegmentStack.pop();
			h = hodograph(xyr);
			[[p,q],[hp,hq]] = getSidePointsAndDerivatives(xyr, h);
			gap = Math.max(xyr[0][2], xyr[3][2])**2;
			tipgap = gap / 5**2;
		} else { // subdivide
			bq.push(deCasteljauSplit(xyr));
			const tMiddle = tStart + (tEnd - tStart) / 2;
			pendingSegmentStack.push([tMiddle, tEnd]);
			tEnd = tMiddle;
			h = hodograph(xyr);
			[[p,q],[hp,hq]] = getSidePointsAndDerivatives(xyr, h);
		}
	}
	if (!q) segments.push(null);
	return segments;
}

/*
const result = approx5([
	[0, 0, 50],
	[0, 0, 50],
	[20, 0, 20],
	[20, 0, 20]
]);

console.log(result.path);
console.log("---");
console.log(result.segmentString);
console.log("---");
console.log(JSON.stringify(result.discontinuity));
*/

console.log(JSON.stringify(split([
	[0, 0, 50],
	[50, 0, 50],
	[30, 1, 10],
	[26, 1, 10]
]), undefined, 4));