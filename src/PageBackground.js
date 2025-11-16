const vertexShaderSource =
`attribute vec2 viewportPosition;
uniform vec2 viewportSize;
uniform vec2 viewportOffset;
uniform vec2 cellSize;
varying vec2 canvasPosition;
void main() {
	gl_Position = vec4(viewportPosition, 0., 1.);
	vec2 screenPosition = vec2(viewportPosition.x + 1., 1. - viewportPosition.y) / 2.;
	canvasPosition = -viewportOffset + viewportSize * screenPosition + cellSize / 2.;
}`;

const fragmentShaderSource =
`precision highp float;
uniform vec2 cellSize;
uniform float lineHalfWidth;
uniform float dotRadius;
uniform vec4 backgroundColor;
uniform vec4 lineColor;
uniform vec4 dotColor;
varying vec2 canvasPosition;
void main() {
	vec2 cellPosition = mod(canvasPosition, cellSize);
	vec2 cellCenter = cellSize / 2.;
	float distanceToLineMiddle = min(abs(cellPosition.x - cellCenter.x), abs(cellPosition.y - cellCenter.y));
	float distanceToCenter = distance(cellPosition, cellCenter);
	vec4 foregroundColor = vec4(lineColor.rgb, lineColor.a * clamp(lineHalfWidth - distanceToLineMiddle + 0.5, 0., 1.));
	vec4 result = mix(backgroundColor, foregroundColor, foregroundColor.a);
	foregroundColor = vec4(dotColor.rgb, dotColor.a * clamp(dotRadius - distanceToCenter + 0.5, 0., 1.));
	result = mix(result, foregroundColor, foregroundColor.a);
	gl_FragColor = result;
}`;

export default class PageBackground {
	#canvas;
	#context;
	#shaderProgram;
	#positionAttribute;
	#uniforms;
	#positionBuffer;

	constructor(canvas) {
		this.#canvas = canvas;
		this.#context = canvas.getContext("webgl", {alpha: false});
		this.#context.clearColor(1, 1, 1, 1);
		this.#context.clear(this.#context.COLOR_BUFFER_BIT);

		const vertexShader = this.#context.createShader(this.#context.VERTEX_SHADER);
		this.#context.shaderSource(vertexShader, vertexShaderSource);
		this.#context.compileShader(vertexShader);
		const fragmentShader = this.#context.createShader(this.#context.FRAGMENT_SHADER);
		this.#context.shaderSource(fragmentShader, fragmentShaderSource);
		this.#context.compileShader(fragmentShader);
		this.#shaderProgram = this.#context.createProgram();
		this.#context.attachShader(this.#shaderProgram, vertexShader);
		this.#context.attachShader(this.#shaderProgram, fragmentShader);
		this.#context.linkProgram(this.#shaderProgram);
		this.#context.useProgram(this.#shaderProgram);

		this.#positionAttribute = this.#context.getAttribLocation(this.#shaderProgram, "viewportPosition");
		this.#uniforms = Object.fromEntries([
			"viewportSize", "viewportOffset", "cellSize",
			"lineHalfWidth", "dotRadius", "backgroundColor", "lineColor", "dotColor"
		].map(name => [name, this.#context.getUniformLocation(this.#shaderProgram, name)]));

		this.#positionBuffer = this.#context.createBuffer();
		this.#context.bindBuffer(this.#context.ARRAY_BUFFER, this.#positionBuffer);
		this.#context.bufferData(
			this.#context.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), this.#context.STATIC_DRAW
		);
		this.#context.vertexAttribPointer(this.#positionAttribute, 2, this.#context.FLOAT, false, 0, 0);
		this.#context.enableVertexAttribArray(this.#positionAttribute);

		this.#context.uniform2f(this.#uniforms.cellSize, 100, 100);
		this.#context.uniform1f(this.#uniforms.lineHalfWidth, 0.5);
		this.#context.uniform1f(this.#uniforms.dotRadius, 2);
		this.#context.uniform4f(this.#uniforms.backgroundColor, 1, 1, 1, 1);
		this.#context.uniform4f(this.#uniforms.dotColor, 0, 0, 0, 0.5);
		this.#context.uniform4f(this.#uniforms.lineColor, 0, 0, 0, 0.1);
	}

	updateCanvasSize(width, height) {
		this.#canvas.width = width;
		this.#canvas.height = height;
		this.#context.viewport(0, 0, width, height);
		this.#context.uniform2f(this.#uniforms.viewportSize, width, height);
	}

	render(offsetX, offsetY) {
		this.#context.clear(this.#context.COLOR_BUFFER_BIT);
		this.#context.uniform2f(this.#uniforms.viewportOffset, offsetX, offsetY);
		this.#context.drawArrays(this.#context.TRIANGLES, 0, 3);
	}
}